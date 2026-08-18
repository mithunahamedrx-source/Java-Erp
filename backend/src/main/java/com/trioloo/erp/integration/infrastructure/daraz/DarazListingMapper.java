package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.product.application.channel.ReportedListingSnapshot;
import com.trioloo.erp.product.application.channel.ReportedSkuSnapshot;
import com.trioloo.erp.product.domain.ListingStatus;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Turns one Daraz product into a {@link ReportedListingSnapshot} — {@code DZC-026}.
 *
 * <p>🔴 EVERY FIELD IS SOURCED OR EXPLICITLY UNREADABLE. There is no third option here: a value
 * this mapper cannot read from a documented field is reported {@code readable=false}, never
 * defaulted, never inferred from a sibling, and never zero. {@code PRD-181} decides divergence by
 * comparing intent against what the channel reported, so a fabricated "0" would not merely be
 * wrong — it would make a listing look diverged and invite an operator to "fix" a price the
 * marketplace never quoted.
 *
 * <p>🔴 IT REPORTS. IT NEVER WRITES INTENT ({@code API-062.c}, {@code DZC-027.a}).
 * {@code attributes.name} becomes the REPORTED title and nothing else.
 *
 * <p>🔴 IT CREATES NO MAPPING ({@code DZC-027.b}). {@code SellerSku} often looks exactly like an
 * ERP SKU, which is precisely the temptation {@code PRD-179} forbids: a mapping needs confirmation
 * and is never made by matching strings. A discovered listing stays {@code UNMAPPED}
 * ({@code PRD-178}).
 */
final class DarazListingMapper {

    private DarazListingMapper() {
    }

    /**
     * ⚠ {@code DZC-024.d} — the reference prints {@code status} as a comma-joined list of the
     * POSSIBLE values, so the true per-product value set is NOT PUBLISHED. Only the three values
     * {@code ListingStatus} actually holds are recognised; anything else yields {@code null},
     * which {@code applySnapshot} treats as "no status change" rather than a guess.
     */
    private static ListingStatus status(String reported) {
        if (reported == null) {
            return null;
        }
        return switch (reported.trim().toLowerCase()) {
            case "active", "live" -> ListingStatus.ACTIVE;
            case "suspended", "inactive" -> ListingStatus.SUSPENDED;
            case "rejected" -> ListingStatus.REJECTED;
            default -> null;
        };
    }

    static ReportedListingSnapshot toSnapshot(JsonNode product) {
        JsonNode attributes = product.get("attributes");

        String title = text(attributes, "name");
        String description = text(attributes, "description");
        String category = text(product, "primary_category");

        List<ReportedSkuSnapshot> skus = skus(product.get("skus"));

        /*
          🔴 DZC-026 — THERE IS NO PRODUCT-LEVEL PRICE IN THE DARAZ RESPONSE. Price, promotion and
          stock live on the SKU. For a single-SKU product the listing-level value is unambiguous.
          ⚠ For several SKUs it is not, and no published rule says which SKU speaks for the
          listing — so the listing level reports UNREADABLE and the real numbers stay on the SKUs
          where the provider put them.
        */
        BigDecimal salePrice = single(skus, ReportedSkuSnapshot::salePrice, ReportedSkuSnapshot::salePriceReadable);
        BigDecimal promotionPrice =
                single(skus, ReportedSkuSnapshot::promotionPrice, ReportedSkuSnapshot::promotionPriceReadable);
        BigDecimal stock = single(skus, ReportedSkuSnapshot::stock, ReportedSkuSnapshot::stockReadable);

        List<String> media = media(product);

        return new ReportedListingSnapshot(
                text(product, "item_id"),
                title, title != null,
                description, description != null,
                salePrice, salePrice != null,
                promotionPrice, promotionPrice != null,
                /*
                  🔴 DZC-024.c — the promotion window's format is NOT PUBLISHED. The official sample
                  shows "2015-07-3100:00", which is not a format any parser should be asked to
                  guess at, so the window is reported unreadable at both levels.
                */
                null, null, false,
                stock, stock != null,
                category, category != null,
                status(text(product, "status")),
                attributeMap(attributes),
                media,
                /*
                  ⚠ DZC-024.b — images arrive either as an array or as a STRING containing one, and
                  nothing published says which is authoritative. Order therefore cannot be trusted
                  as meaningful, so it is not claimed to be.
                */
                false,
                skus);
    }

    /**
     * A listing-level value, but ONLY when the product has exactly one SKU.
     *
     * <p>⚠ Deliberately not "when all SKUs agree". Two SKUs that happen to share a price today are
     * still two prices, and reporting their coincidence as a listing fact would make the listing
     * look settled until the day one of them moves.
     */
    private static BigDecimal single(List<ReportedSkuSnapshot> skus,
                                     java.util.function.Function<ReportedSkuSnapshot, BigDecimal> value,
                                     java.util.function.Predicate<ReportedSkuSnapshot> readable) {
        if (skus.size() != 1) {
            return null;
        }
        ReportedSkuSnapshot only = skus.getFirst();
        return readable.test(only) ? value.apply(only) : null;
    }

    private static List<ReportedSkuSnapshot> skus(JsonNode node) {
        List<ReportedSkuSnapshot> out = new ArrayList<>();
        if (node == null || !node.isArray()) {
            return out;
        }
        for (JsonNode sku : node) {
            /* 🔴 DZC-026 — SellerSku is the channel SKU. ShopSku and SkuId are marketplace-side
               identifiers and are never substituted for it. */
            String channelSku = text(sku, "SellerSku");
            BigDecimal price = decimal(sku, "price");
            BigDecimal special = decimal(sku, "special_price");
            BigDecimal quantity = decimal(sku, "quantity");
            out.add(new ReportedSkuSnapshot(
                    channelSku,
                    price, price != null,
                    special, special != null,
                    /* The window is unreadable for the reason given above. */
                    (Instant) null, (Instant) null, false,
                    quantity, quantity != null,
                    /* 🔴 DZC-026 — variationLabel is NOT PUBLISHED as a field. The sample's
                       "39817:01:01" hints at encoded variation, and decoding it would be
                       invention. */
                    null));
        }
        return out;
    }

    /**
     * ⚠ {@code DZC-024.b} — {@code images} may be a real array or a string holding one, and
     * {@code marketImages} is the documented alternate. Both are tolerated; neither is required.
     */
    private static List<String> media(JsonNode product) {
        List<String> refs = new ArrayList<>();
        for (String field : List.of("images", "marketImages")) {
            JsonNode node = product.get(field);
            if (node == null) {
                continue;
            }
            if (node.isArray()) {
                node.forEach(image -> addRef(refs, image.asText("")));
            } else {
                /* A string containing a JSON array. Quotes and brackets are stripped rather than
                   parsed: this is a reference list, not a document. */
                for (String piece : node.asText("").split("[\\[\\],]")) {
                    addRef(refs, piece.replace("\"", "").trim());
                }
            }
            if (!refs.isEmpty()) {
                return refs;   // the first field that yielded anything wins
            }
        }
        return refs;
    }

    private static void addRef(List<String> refs, String value) {
        if (value != null && !value.isBlank()) {
            refs.add(value.trim());
        }
    }

    /**
     * ⚠ The attribute set is CATEGORY-DEPENDENT and has no published exhaustive list
     * ({@code DZC-023}), so every scalar is passed through as text and none is validated against a
     * schema this side does not own.
     */
    private static Map<String, String> attributeMap(JsonNode attributes) {
        Map<String, String> out = new LinkedHashMap<>();
        if (attributes == null || !attributes.isObject()) {
            return out;
        }
        attributes.properties().forEach(entry -> {
            JsonNode value = entry.getValue();
            if (value != null && value.isValueNode()) {
                String text = value.asText("");
                if (!text.isBlank()) {
                    out.put(entry.getKey(), text);
                }
            }
        });
        return out;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.asText("").isBlank() ? null : value.asText().trim();
    }

    /**
     * 🔴 {@code DZC-024.a} — price scale and currency are NOT PUBLISHED, and the sample shows bare
     * JSON numbers. Values are read as TEXT and converted with exact decimal semantics
     * ({@code DB-037}, {@code TEC-010}); a binary float never touches a monetary path.
     * ⚠ Anything that will not convert is unreadable rather than zero.
     */
    private static BigDecimal decimal(JsonNode node, String field) {
        String raw = text(node, field);
        if (raw == null) {
            return null;
        }
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
