package com.trioloo.erp.system.application;

import com.trioloo.erp.system.infrastructure.persistence.ShopEntity;
import com.trioloo.erp.system.infrastructure.persistence.ShopRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Applies the outcome of an authorisation to the System-owned shop record.
 *
 * <p>🔴 THE BINDING RULE IS SYSTEM'S, NOT INTEGRATION'S. {@code INV-16.5} and
 * {@code INV-16.6} are invariants of {@code E-016}, so the decision to bind, to renew, or to
 * REFUSE lives here — beside the aggregate that holds the fact. Integration performs the
 * authorisation and reports what the channel said; it does not decide what that means for
 * the record ({@code PRJ-021}, {@code DM-084.b}).
 *
 * <p>🔴 THIS SERVICE CHECKS NO PERMISSION, AND THAT IS DELIBERATE. It is not a surface: it is
 * reached only from Integration's authorisation service, which has already enforced
 * {@code integration.channel-connection.authorize} ({@code PRM-090}). Adding a second,
 * different check here would let a caller satisfy the wrong capability.
 *
 * <p>🔴 NO SECRET REACHES IT ({@code API-070}). Its inputs are an account identity and an
 * optional link — both non-secret business facts ({@code INV-16.8}).
 */
@Service
public class ShopBindingService {

    private final ShopRepository shops;

    public ShopBindingService(ShopRepository shops) {
        this.shops = shops;
    }

    /**
     * Records what an authorisation established.
     *
     * <p>🔴 {@code SCS-044} — THREE OUTCOMES, AND THE MISMATCH CHANGES NOTHING:
     *
     * <ul>
     *   <li>nothing bound yet → BIND, and the binding time starts now;
     *   <li>the SAME account → RENEW. {@code INV-16.6} — re-authorising does not re-bind, so
     *       the binding time is untouched and the shop's Listings and history stay attached
     *       to the account they were created under;
     *   <li>a DIFFERENT account → 🔴 REFUSED. The existing binding is left exactly as it was
     *       and the caller is told both identities so the operator can be told the truth.
     * </ul>
     *
     * <p>🔴 THE COMPARISON IS AGAINST THE ACCOUNT IDENTITY AND NOTHING ELSE. The external
     * link is never used for the mismatch test ({@code SCS-041.a}, {@code INV-16.14}).
     */
    @Transactional
    public BindingOutcome applyAuthorisation(UUID shopId, String reportedAccountIdentity,
                                             String reportedLink, Instant observedAt) {
        if (reportedAccountIdentity == null || reportedAccountIdentity.isBlank()) {
            throw new IllegalArgumentException(
                    "An authorisation that confirmed no account never reaches binding (SCS-044)");
        }
        ShopEntity shop = shops.findById(shopId).orElseThrow(() -> new ShopNotFoundException(shopId));
        String reported = reportedAccountIdentity.trim();

        if (!shop.isBound()) {
            /*
              🔴 INV-16.6 — one remote account belongs to ONE shop. Binding an account already
              held by a different shop on the same channel type is the same error seen from
              the other side, and is refused for the same reason.
            */
            if (shops.existsByChannelTypeAndExternalAccountIdentity(shop.getChannelType(), reported)) {
                return BindingOutcome.claimedByAnotherShop(reported);
            }
            shop.bindAccount(reported, reportedLink, observedAt);
            return BindingOutcome.bound(reported);
        }

        if (shop.getExternalAccountIdentity().equals(reported)) {
            shop.renewAuthorisation(reportedLink, observedAt);
            return BindingOutcome.renewed(reported);
        }

        /* 🔴 NOTHING IS WRITTEN. The shop leaves this method byte-for-byte as it arrived. */
        return BindingOutcome.differentAccount(shop.getExternalAccountIdentity(), reported);
    }

    /** What the authorisation did to the record, in business terms. */
    public record BindingOutcome(Kind kind, String boundAccount, String attemptedAccount) {

        public enum Kind {
            /** First success — the account is now bound to this shop. */
            BOUND,
            /** The same account re-authorised. 🔴 The binding time did not move. */
            RENEWED,
            /** 🔴 A different account. Refused; the existing binding is unchanged. */
            DIFFERENT_ACCOUNT,
            /** 🔴 The account already belongs to another shop on this channel type. */
            CLAIMED_BY_ANOTHER_SHOP
        }

        static BindingOutcome bound(String account) {
            return new BindingOutcome(Kind.BOUND, account, account);
        }

        static BindingOutcome renewed(String account) {
            return new BindingOutcome(Kind.RENEWED, account, account);
        }

        static BindingOutcome differentAccount(String bound, String attempted) {
            return new BindingOutcome(Kind.DIFFERENT_ACCOUNT, bound, attempted);
        }

        static BindingOutcome claimedByAnotherShop(String attempted) {
            return new BindingOutcome(Kind.CLAIMED_BY_ANOTHER_SHOP, null, attempted);
        }

        /** Whether the authorisation established a working connection. */
        public boolean established() {
            return kind == Kind.BOUND || kind == Kind.RENEWED;
        }
    }
}
