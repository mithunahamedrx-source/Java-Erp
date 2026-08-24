package com.trioloo.erp.order.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import com.trioloo.erp.platform.money.MonetaryAmount;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ChannelOrderQueryService {

    private static final int MAX_PAGE_SIZE = 200;

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;
    private final ObjectMapper json = new ObjectMapper();

    public ChannelOrderQueryService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    @Transactional(readOnly = true)
    public Page<ChannelOrderRow> list(Filter filter, Pageable pageable) {
        requireViewer();
        Filter f = filter == null ? new Filter(null, null, null, null, null) : filter;
        int size = Math.min(Math.max(pageable.getPageSize(), 1), MAX_PAGE_SIZE);
        int page = Math.max(pageable.getPageNumber(), 0);
        long offset = (long) page * size;
        String where = where(f);
        Object[] args = args(f);
        List<ChannelOrderRow> rows = jdbc.query("""
                SELECT o.id, o.channel_instance_id, ci.name AS channel_name,
                       o.external_order_id, o.order_number, o.trioloo_invoice_number, o.ownership, o.statuses_json::text,
                       o.canonical_statuses_json::text, o.dispatch_observed_at,
                       o.provider_created_at, o.provider_updated_at, o.last_seen_at,
                       o.price, o.payment_method, o.items_count, o.customer_first_name, o.customer_last_name,
                       o.shipping_phone, o.shipping_address1, o.shipping_address3, o.shipping_city,
                       o.shipping_post_code, o.buyer_note,
                       i.item_name, i.tracking_code, i.invoice_number, i.purchase_order_id,
                       s.consignment_id AS courier_consignment_id,
                       s.tracking_code  AS courier_tracking_code,
                       s.state          AS shipment_state,
                       s.provider_status_raw AS courier_status_raw
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                  -- ⚠ The card shows ONE representative line. LEFT JOIN LATERAL keeps an order with
                  -- no imported item visible rather than dropping it from the workspace.
                  LEFT JOIN LATERAL (
                      SELECT item_name, tracking_code, invoice_number, purchase_order_id
                        FROM channel_order_item
                       WHERE channel_order_id = o.id
                       ORDER BY external_order_item_id ASC
                       LIMIT 1
                  ) i ON true
                  -- ⚠ The ACTIVE shipment only. `BR-023` allows at most one, and `BD-442` keeps
                  -- successive shipments normal - so an order that was returned and re-sent has
                  -- history here, and the card must show the live parcel rather than the first one.
                  LEFT JOIN LATERAL (
                      SELECT consignment_id, tracking_code, state, provider_status_raw
                        FROM shipment
                       WHERE channel_order_id = o.id
                         AND state NOT IN ('DELIVERED', 'RETURNED_TO_WAREHOUSE', 'LOST',
                                           'DAMAGED', 'CANCELLED')
                       ORDER BY created_at DESC
                       LIMIT 1
                  ) s ON true
                """ + where + """
                 ORDER BY o.provider_created_at DESC NULLS LAST, o.imported_at DESC, o.external_order_id ASC
                 LIMIT ? OFFSET ?
                """, append(args, size, offset), (rs, rowNum) -> row(rs));
        Long total = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where, args, Long.class);
        return new PageImpl<>(rows, pageable, total == null ? 0 : total);
    }

    /**
     * The four workspace summary figures, plus the item count the footer strip already showed.
     *
     * <p>🔴 EVERY FIGURE HONOURS THE ACTIVE FILTER. A card that ignored the filter would state a
     * different population from the cards below it on the same screen.
     *
     * <p>⚠ {@code TEC-050} / {@code TEC-052} — "today" is a BUSINESS DATE in {@code Asia/Dhaka}
     * and is never a UTC-truncated instant. The zone is applied in SQL rather than inherited
     * from the session, so the boundary does not move with the host.
     */
    @Transactional(readOnly = true)
    public Summary summary(Filter filter) {
        requireViewer();
        Filter f = filter == null ? new Filter(null, null, null, null, null) : filter;
        String where = where(f);
        Object[] args = args(f);

        Long total = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where, args, Long.class);

        // Today's orders — counted on the MARKETPLACE's own creation time, which is the basis the
        // product owner chose on 2026-08-23, superseding the earlier imported_at basis.
        //
        // ⚠ THE EARLIER BASIS WAS NOT WRONG, IT WAS FORCED: provider_created_at was NULL on every
        // order because the adapter silently dropped every provider timestamp. Once that defect
        // was fixed and the stored values repaired, the marketplace's own time became available
        // and it is the one an operator recognises — it matches what the seller panel shows.
        //
        // 🔴 An order whose provider time is ABSENT falls into no period bucket rather than into
        // today's (SYS-034 — absent is not a date, and certainly not "now").
        Long todaysOrders = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where + and(where) + """
                 o.provider_created_at IS NOT NULL
                   AND (o.provider_created_at AT TIME ZONE 'Asia/Dhaka')::date
                     = (now() AT TIME ZONE 'Asia/Dhaka')::date
                """, args, Long.class);

        // Today's dispatched — counted on the ERP's own first observation of DISPATCHED.
        // 🔴 Daraz publishes no dispatch timestamp (DZC-045.e, DZC-047.c), so this is what the
        // system saw and when, never a claim about when the carrier actually took the parcel.
        Long todaysDispatched = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where + and(where) + """
                 o.dispatch_observed_at IS NOT NULL
                   AND (o.dispatch_observed_at AT TIME ZONE 'Asia/Dhaka')::date
                     = (now() AT TIME ZONE 'Asia/Dhaka')::date
                """, args, Long.class);

        // Total collectable — the obligation follows DELIVERED goods and never ordered goods
        // (BR-033, INV-32.5), and money is Trioloo's only once it has ARRIVED (BR-035). SM-5's
        // DUE is "Delivered; payment expected", so an undelivered order contributes nothing.
        //
        // ⚠ Nothing is subtracted because nothing has been received: no receipt, remittance or
        // settlement record exists in this slice, so there is no collected amount to net off.
        // This figure therefore states the delivered-and-unsettled position in full.
        BigDecimal collectable = jdbc.queryForObject("""
                SELECT COALESCE(sum(o.price), 0)
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where + and(where) + """
                 o.canonical_statuses_json ?? ?
                """, append(args, CanonicalOrderStatus.DELIVERED.name()), BigDecimal.class);

        Long items = jdbc.queryForObject("""
                SELECT count(*)
                  FROM channel_order_item i
                  JOIN channel_order o ON o.id = i.channel_order_id
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + where, args, Long.class);

        // The facet deliberately drops f.channelType() (see ChannelTypeFacet): a control that
        // erased its own other options the moment one was chosen would be unusable.
        Filter withoutChannelType = new Filter(f.channelInstanceId(), null, f.status(), f.search(), f.period());
        String facetWhere = where(withoutChannelType);
        List<ChannelTypeFacet> channelTypes = jdbc.query("""
                SELECT ci.channel_type, count(*) AS order_count
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + facetWhere + """
                 GROUP BY ci.channel_type
                 ORDER BY ci.channel_type ASC
                """, args(withoutChannelType),
                (rs, rowNum) -> new ChannelTypeFacet(rs.getString("channel_type"),
                        rs.getLong("order_count")));

        // Status counts drop f.status() for the same reason the channel facet drops
        // f.channelType(): the strip must keep describing the whole filtered population.
        Filter withoutStatus = new Filter(f.channelInstanceId(), f.channelType(), null,
                f.search(), f.period());
        String countWhere = where(withoutStatus);
        List<StatusFacet> statusCounts = jdbc.query("""
                SELECT s.status, count(*) AS order_count
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                  CROSS JOIN LATERAL jsonb_array_elements_text(o.canonical_statuses_json) AS s(status)
                """ + countWhere + """
                 GROUP BY s.status
                """, args(withoutStatus),
                (rs, rowNum) -> new StatusFacet(rs.getString("status"), rs.getLong("order_count")));

        // Shops keep f.channelType() (a Daraz-only view should list Daraz shops) but drop the
        // shop filter itself, so choosing one never hides the others.
        Filter withoutShop = new Filter(null, f.channelType(), f.status(), f.search(), f.period());
        String shopWhere = where(withoutShop);
        List<ShopFacet> shops = jdbc.query("""
                SELECT ci.id, ci.code, ci.name, count(*) AS order_count
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                """ + shopWhere + """
                 GROUP BY ci.id, ci.code, ci.name
                 ORDER BY ci.code ASC
                """, args(withoutShop),
                (rs, rowNum) -> new ShopFacet(rs.getString("id"), rs.getString("code"),
                        rs.getString("name"), rs.getLong("order_count")));

        return new Summary(n(total), n(todaysOrders), n(todaysDispatched),
                collectable == null ? BigDecimal.ZERO : collectable, n(items), channelTypes,
                statusCounts, shops);
    }

    @Transactional(readOnly = true)
    public ChannelOrderDetail detail(UUID id) {
        requireViewer();
        List<ChannelOrderDetail> found = jdbc.query("""
                SELECT o.*, ci.name AS channel_name, ci.channel_type
                  FROM channel_order o
                  JOIN channel_instance ci ON ci.id = o.channel_instance_id
                 WHERE o.id = ?
                """, (rs, rowNum) -> detail(rs), id);
        ChannelOrderDetail detail = found.stream().findFirst()
                .orElseThrow(() -> new ChannelOrderNotFoundException(id));
        List<ChannelOrderItemRow> items = jdbc.query("""
                SELECT id, external_order_item_id, external_order_id, sku, shop_sku, sku_id,
                       item_name, variation, item_price, paid_price, status, reason,
                       tracking_code, shipment_provider, shipping_provider_type, invoice_number,
                       purchase_order_id, digital_delivery_info, provider_created_at, provider_updated_at
                  FROM channel_order_item
                 WHERE channel_order_id = ?
                 ORDER BY external_order_item_id ASC
                """, (rs, rowNum) -> item(rs), id);
        return detail.withItems(items);
    }

    private void requireViewer() {
        if (currentActor.current().filter(a -> a.hasPermission(OrderPermissions.CHANNEL_ORDER_VIEW)).isEmpty()) {
            throw new AccessDeniedByPermissionException(OrderPermissions.CHANNEL_ORDER_VIEW);
        }
    }

    private String where(Filter f) {
        StringBuilder sql = new StringBuilder(" WHERE 1 = 1");
        if (f.channelInstanceId() != null) {
            sql.append(" AND o.channel_instance_id = ?");
        }
        if (present(f.channelType())) {
            sql.append(" AND upper(ci.channel_type) = ?");
        }
        // 🔴 Tab filtering reads the CANONICAL mirror, never the raw channel vocabulary. The
        // tabs are named for SM-1 states (OM §6.2), so filtering on a channel's own spelling
        // would put channel-conditional behaviour in a downstream stage (BR-005).
        if (present(f.status())) {
            sql.append(" AND o.canonical_statuses_json ?? ?");
        }
        Period period = Period.resolve(f.period());
        if (period != null) {
            // 🔴 The zone is applied explicitly (TEC-052) rather than inherited from the session,
            // so the boundary does not move with the host's timezone.
            //
            // 🔴 The basis is the MARKETPLACE's creation time, the same one `Today's orders`
            // counts. Two period bases on one screen is the exact defect GAP-004 recorded.
            sql.append(" AND o.provider_created_at IS NOT NULL")
               .append(" AND date_trunc('").append(period.truncation())
               .append("', o.provider_created_at AT TIME ZONE 'Asia/Dhaka')")
               .append(" = date_trunc('").append(period.truncation())
               .append("', now() AT TIME ZONE 'Asia/Dhaka')");
        }
        if (present(f.search())) {
            sql.append("""
                     AND (
                       lower(o.external_order_id) LIKE ?
                       OR lower(coalesce(o.order_number, '')) LIKE ?
                       -- ⚠ The Trioloo invoice number is the reference a person READS off the
                       -- card, so it is the one they will type. Omitting it would make the
                       -- number searchable nowhere.
                       OR lower(coalesce(o.trioloo_invoice_number, '')) LIKE ?
                       OR lower(coalesce(o.customer_first_name, '') || ' ' || coalesce(o.customer_last_name, '')) LIKE ?
                     )
                    """);
        }
        return sql.toString();
    }

    private Object[] args(Filter f) {
        java.util.ArrayList<Object> values = new java.util.ArrayList<>();
        if (f.channelInstanceId() != null) {
            values.add(f.channelInstanceId());
        }
        if (present(f.channelType())) {
            values.add(f.channelType().trim().toUpperCase(java.util.Locale.ROOT));
        }
        if (present(f.status())) {
            // An unrecognised tab value is not passed through as a free-text probe: it resolves
            // to a ratified state name or it matches nothing.
            CanonicalOrderStatus requested = CanonicalOrderStatus.resolve(f.status());
            values.add(requested == null ? "" : requested.name());
        }
        if (present(f.search())) {
            String needle = "%" + f.search().trim().toLowerCase() + "%";
            // Four placeholders: external id, order number, Trioloo invoice number, customer name.
            values.add(needle);
            values.add(needle);
            values.add(needle);
            values.add(needle);
        }
        return values.toArray();
    }

    /** Continues an existing WHERE. {@link #where(Filter)} always opens one, so this is always AND. */
    private static String and(String currentWhere) {
        return currentWhere.contains(" WHERE ") ? " AND" : " WHERE";
    }

    private ChannelOrderRow row(ResultSet rs) throws SQLException {
        return new ChannelOrderRow(
                uuid(rs, "id"), uuid(rs, "channel_instance_id"), rs.getString("channel_name"),
                rs.getString("external_order_id"), rs.getString("order_number"),
                rs.getString("trioloo_invoice_number"), rs.getString("ownership"),
                statuses(rs.getString("statuses_json")),
                statuses(rs.getString("canonical_statuses_json")), instant(rs, "dispatch_observed_at"),
                instant(rs, "provider_created_at"),
                instant(rs, "provider_updated_at"), instant(rs, "last_seen_at"),
                rs.getBigDecimal("price"), rs.getString("payment_method"), integer(rs, "items_count"),
                rs.getString("customer_first_name"), rs.getString("customer_last_name"),
                rs.getString("shipping_phone"), shippingLine(rs), rs.getString("buyer_note"),
                rs.getString("item_name"), rs.getString("tracking_code"),
                rs.getString("invoice_number"), rs.getString("purchase_order_id"),
                rs.getString("courier_consignment_id"), rs.getString("courier_tracking_code"),
                rs.getString("shipment_state"));
    }

    private ChannelOrderDetail detail(ResultSet rs) throws SQLException {
        return new ChannelOrderDetail(
                uuid(rs, "id"), uuid(rs, "channel_instance_id"), rs.getString("channel_name"),
                rs.getString("channel_type"), rs.getString("external_order_id"),
                rs.getString("order_number"), rs.getString("ownership"),
                statuses(rs.getString("statuses_json")),
                statuses(rs.getString("canonical_statuses_json")), instant(rs, "dispatch_observed_at"),
                instant(rs, "provider_created_at"),
                instant(rs, "provider_updated_at"), instant(rs, "imported_at"), instant(rs, "last_seen_at"),
                rs.getBigDecimal("price"), rs.getBigDecimal("shipping_fee"),
                rs.getBigDecimal("shipping_fee_original"), rs.getBigDecimal("shipping_fee_discount_platform"),
                rs.getBigDecimal("shipping_fee_discount_seller"), rs.getBigDecimal("voucher"),
                rs.getBigDecimal("voucher_platform"), rs.getBigDecimal("voucher_seller"),
                rs.getBigDecimal("cash_payment_fee"), rs.getString("payment_method"),
                rs.getString("voucher_code"), integer(rs, "items_count"), rs.getString("promised_shipping_times"),
                rs.getString("warehouse_code"), rs.getString("delivery_info"), rs.getString("buyer_note"),
                rs.getString("remarks"), rs.getString("gift_option"), rs.getString("gift_message"),
                rs.getString("national_registration_number1"), rs.getString("branch_number"),
                rs.getString("tax_code"), rs.getString("extra_attributes"),
                rs.getString("customer_first_name"), rs.getString("customer_last_name"),
                address(rs, "billing"), address(rs, "shipping"), List.of());
    }

    private ChannelOrderItemRow item(ResultSet rs) throws SQLException {
        return new ChannelOrderItemRow(uuid(rs, "id"), rs.getString("external_order_item_id"),
                rs.getString("external_order_id"), rs.getString("sku"), rs.getString("shop_sku"),
                rs.getString("sku_id"), rs.getString("item_name"), rs.getString("variation"),
                rs.getBigDecimal("item_price"), rs.getBigDecimal("paid_price"), rs.getString("status"),
                rs.getString("reason"), rs.getString("tracking_code"), rs.getString("shipment_provider"),
                rs.getString("shipping_provider_type"), rs.getString("invoice_number"),
                rs.getString("purchase_order_id"), rs.getString("digital_delivery_info"),
                instant(rs, "provider_created_at"), instant(rs, "provider_updated_at"));
    }

    private AddressView address(ResultSet rs, String prefix) throws SQLException {
        return new AddressView(rs.getString(prefix + "_first_name"), rs.getString(prefix + "_last_name"),
                rs.getString(prefix + "_phone"), rs.getString(prefix + "_phone2"),
                rs.getString(prefix + "_address1"), rs.getString(prefix + "_address2"),
                rs.getString(prefix + "_address3"), rs.getString(prefix + "_address4"),
                rs.getString(prefix + "_address5"), rs.getString(prefix + "_city"),
                rs.getString(prefix + "_post_code"), rs.getString(prefix + "_country"));
    }

    private List<String> statuses(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return json.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static UUID uuid(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        return value instanceof UUID id ? id : null;
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp ts = rs.getTimestamp(column);
        return ts == null ? null : ts.toInstant();
    }

    private static Integer integer(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    /**
     * The delivery address as one readable line.
     *
     * <p>⚠ {@code DZC-045.f} — Daraz's address numbering does NOT correspond to a simple two-line
     * street address: {@code address3} is the STATE name and {@code address4} the CITY name, so
     * they are never concatenated blindly. Only parts whose meaning the provider publishes join.
     */
    private static String shippingLine(ResultSet rs) throws SQLException {
        List<String> parts = new java.util.ArrayList<>();
        for (String column : List.of("shipping_address1", "shipping_address3", "shipping_city",
                "shipping_post_code")) {
            String value = rs.getString(column);
            if (value != null && !value.isBlank()) {
                parts.add(value.trim());
            }
        }
        // SYS-034 — an order with no recorded address renders an absence, never an empty string.
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private static long n(Long value) {
        return value == null ? 0 : value;
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    private static Object[] append(Object[] base, Object... suffix) {
        Object[] combined = java.util.Arrays.copyOf(base, base.length + suffix.length);
        System.arraycopy(suffix, 0, combined, base.length, suffix.length);
        return combined;
    }

    /**
     * The workspace filter.
     *
     * <p>⚠ {@code channelType} and {@code channelInstanceId} are BOTH carried because
     * {@code BR-002} attributes every order to a channel type AND a channel instance, and
     * reporting, settlement and reconciliation all operate at instance level. Filtering by type
     * is a convenience over the type column; it never collapses the instance attribution.
     */
    public record Filter(UUID channelInstanceId, String channelType, String status, String search,
                        String period) {}

    /**
     * The period filter.
     *
     * <p>🔴 IT FILTERS ON THE SAME TIMESTAMP THE `Today's orders` CARD COUNTS — the MARKETPLACE's
     * own creation time. ⚠ Two period bases on one screen is precisely the defect
     * {@code GAP-004} recorded when it asked what period boundary the shipped `This month` KPI
     * used and found no answer.
     *
     * <p>🔴 THE BOUNDARIES ARE CALENDAR BOUNDARIES IN {@code Asia/Dhaka} ({@code TEC-050},
     * {@code TEC-052}) — today, the current calendar month, the current calendar year. ⚠ A
     * rolling window (last 30 days, last 12 months) is NOT offered: no rolling-period concept
     * exists anywhere in the corpus, and inventing one would make `Month` mean something the
     * business never decided.
     */
    public enum Period {
        DAY, MONTH, YEAR;

        static Period resolve(String name) {
            if (name == null || name.isBlank()) {
                return null;
            }
            for (Period period : values()) {
                if (period.name().equalsIgnoreCase(name.trim())) {
                    return period;
                }
            }
            return null;
        }

        /** The `date_trunc` unit this period truncates to. */
        String truncation() {
            return switch (this) {
                case DAY -> "day";
                case MONTH -> "month";
                case YEAR -> "year";
            };
        }
    }

    /**
     * The four Orders workspace summary figures.
     *
     * <p>🔴 {@code totalCollectable} crosses the boundary as a JSON STRING ({@code TEC-015},
     * {@code DB-079}). It is {@code BigDecimal} on this side and never a {@code double}
     * ({@code PRJ-040}), and the browser performs no arithmetic on it ({@code TEC-095}).
     */
    public record Summary(long totalOrders, long todaysOrders, long todaysDispatched,
                          @MonetaryAmount BigDecimal totalCollectable, long totalItems,
                          List<ChannelTypeFacet> channelTypes,
                          List<StatusFacet> statusCounts,
                          List<ShopFacet> shops) {}

    /**
     * A channel type that actually has orders, with how many.
     *
     * <p>🔴 THE CHANNEL FILTER IS BUILT FROM THIS, NOT FROM A HARD-CODED LIST. A fixed list of
     * channel names in the browser would be a second register of a set {@code SYS-108} already
     * owns, and it would offer the operator a filter that can only ever return nothing.
     *
     * <p>⚠ The facet is computed IGNORING the active channel filter, so choosing one channel
     * does not erase the other options from the control the operator chose it with.
     */
    public record ChannelTypeFacet(String channelType, long orderCount) {}

    /**
     * One canonical status and how many orders currently carry it.
     *
     * <p>⚠ Like {@link ChannelTypeFacet}, this is computed IGNORING the active STATUS filter:
     * a tab strip whose other counts collapsed to nothing the moment one tab was selected would
     * tell the operator less than a strip with no counts at all.
     *
     * <p>🔴 An order carrying several canonical statuses is counted under EACH of them, because
     * {@code statuses} is an array of the item statuses in the order ({@code DZC-045.e}) and
     * choosing a winner would be inventing a precedence the provider does not publish. ⚠ The
     * counts therefore need not sum to the order total, which is correct rather than a defect.
     */
    public record StatusFacet(String status, long orderCount) {}

    /**
     * One shop that actually has orders, with how many.
     *
     * <p>🔴 {@code BR-002} — <em>"Reporting, settlement, and reconciliation all operate at
     * instance level. 'Daraz' is NEVER A SUFFICIENT ATTRIBUTION, because settlement arrives per
     * shop and margin differs per shop."</em> A channel-type filter therefore cannot answer
     * "which shop did this order come from"; only this one can.
     *
     * <p>⚠ Computed ignoring the active shop filter, for the same reason the other facets are:
     * a control that erased its own other options once one was chosen would be unusable.
     */
    public record ShopFacet(String channelInstanceId, String code, String name, long orderCount) {}

    /**
     * One Orders card.
     *
     * <p>🔴 {@code statuses} and {@code canonicalStatuses} ARE TWO FACTS AND ARE NEVER MERGED
     * ({@code BR-171}, {@code UX-182}, {@code OSC-036}). The first is the marketplace's own
     * vocabulary, retained exactly as reported ({@code BR-173}); the second is the canonical
     * mirror the adapter produced from it.
     *
     * <p>⚠ {@code dispatchObservedAt} is when THIS SYSTEM first saw the order as
     * {@code DISPATCHED}, not when the carrier took it — Daraz publishes no such timestamp.
     */
    public record ChannelOrderRow(UUID id, UUID channelInstanceId, String channelName,
                                  String externalOrderId, String orderNumber,
                                  /*
                                    🔴 THE TRIOLOO-ISSUED NUMBER, AND IT IS NOT `invoiceNumber`.
                                    That name already belongs on this row to the MARKETPLACE's
                                    invoice number, which `BR-171` keeps as an external fact.
                                    Two invoice numbers, two owners, never conflated (`PRN-014`).
                                  */
                                  String triolooInvoiceNumber, String ownership,
                                  List<String> statuses, List<String> canonicalStatuses,
                                  Instant dispatchObservedAt, Instant providerCreatedAt,
                                  Instant providerUpdatedAt, Instant lastSeenAt,
                                  @MonetaryAmount BigDecimal price, String paymentMethod,
                                  Integer itemsCount,
                                  String customerFirstName, String customerLastName,
                                  String shippingPhone, String shippingLine, String buyerNote,
                                  String itemName, String trackingCode, String invoiceNumber,
                                  String purchaseOrderId,
                                  /*
                                    🔴 THE COURIER'S OWN IDENTIFIERS, AND THEY ARE NOT THE
                                    MARKETPLACE'S. `trackingCode` above is DARAZ's; these two are
                                    STEADFAST's. `DB-013` exists for exactly this case - an
                                    external identifier is only meaningful alongside the party that
                                    issued it, and two parties may legitimately issue the same
                                    string. Merging them into one "tracking" field would make the
                                    card unable to say who to ask about a parcel.
                                  */
                                  String courierConsignmentId, String courierTrackingCode,
                                  String shipmentState) {}

    public record ChannelOrderDetail(UUID id, UUID channelInstanceId, String channelName,
                                     String channelType, String externalOrderId, String orderNumber,
                                     String ownership, List<String> statuses,
                                     List<String> canonicalStatuses, Instant dispatchObservedAt,
                                     Instant providerCreatedAt,
                                     Instant providerUpdatedAt, Instant importedAt, Instant lastSeenAt,
                                     @MonetaryAmount BigDecimal price,
                                     @MonetaryAmount BigDecimal shippingFee,
                                     @MonetaryAmount BigDecimal shippingFeeOriginal,
                                     @MonetaryAmount BigDecimal shippingFeeDiscountPlatform,
                                     @MonetaryAmount BigDecimal shippingFeeDiscountSeller,
                                     @MonetaryAmount BigDecimal voucher,
                                     @MonetaryAmount BigDecimal voucherPlatform,
                                     @MonetaryAmount BigDecimal voucherSeller,
                                     @MonetaryAmount BigDecimal cashPaymentFee,
                                     String paymentMethod, String voucherCode,
                                     Integer itemsCount, String promisedShippingTimes,
                                     String warehouseCode, String deliveryInfo, String buyerNote,
                                     String remarks, String giftOption, String giftMessage,
                                     String nationalRegistrationNumber1, String branchNumber,
                                     String taxCode, String extraAttributes, String customerFirstName,
                                     String customerLastName, AddressView billingAddress,
                                     AddressView shippingAddress, List<ChannelOrderItemRow> items) {
        ChannelOrderDetail withItems(List<ChannelOrderItemRow> items) {
            return new ChannelOrderDetail(id, channelInstanceId, channelName, channelType,
                    externalOrderId, orderNumber, ownership, statuses,
                    canonicalStatuses, dispatchObservedAt, providerCreatedAt,
                    providerUpdatedAt, importedAt, lastSeenAt, price, shippingFee,
                    shippingFeeOriginal, shippingFeeDiscountPlatform, shippingFeeDiscountSeller,
                    voucher, voucherPlatform, voucherSeller, cashPaymentFee, paymentMethod,
                    voucherCode, itemsCount, promisedShippingTimes, warehouseCode, deliveryInfo,
                    buyerNote, remarks, giftOption, giftMessage, nationalRegistrationNumber1,
                    branchNumber, taxCode, extraAttributes, customerFirstName, customerLastName,
                    billingAddress, shippingAddress, items == null ? List.of() : List.copyOf(items));
        }
    }

    public record AddressView(String firstName, String lastName, String phone, String phone2,
                              String address1, String address2, String address3, String address4,
                              String address5, String city, String postCode, String country) {}

    public record ChannelOrderItemRow(UUID id, String externalOrderItemId, String externalOrderId,
                                      String sku, String shopSku, String skuId, String name,
                                      String variation,
                                      @MonetaryAmount BigDecimal itemPrice,
                                      @MonetaryAmount BigDecimal paidPrice,
                                      String status, String reason, String trackingCode,
                                      String shipmentProvider, String shippingProviderType,
                                      String invoiceNumber, String purchaseOrderId,
                                      String digitalDeliveryInfo, Instant providerCreatedAt,
                                      Instant providerUpdatedAt) {}
}
