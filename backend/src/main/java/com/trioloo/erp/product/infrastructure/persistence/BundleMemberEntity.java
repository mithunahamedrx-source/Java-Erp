package com.trioloo.erp.product.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * {@code E-063} Bundle Member — one member of a {@code BUNDLE} Sellable Product
 * ({@code PRD §12}).
 *
 * <p>🔴 {@code INV-63.1} / {@code PRD-047} — a member IS a Sellable Product, which may itself be
 * {@code SIMPLE} or {@code ASSEMBLED}.
 *
 * <p>🔴 {@code INV-63.2} / {@code PRD-048} — NO MEMBER IS ITSELF A BUNDLE. Nesting is one level,
 * which prevents the combinatorial explosion in availability derivation and pricing that
 * `PRD-048` exists to stop. Enforced in the command service, because a CHECK constraint cannot
 * read the referenced row's nature.
 *
 * <p>🔴 A bundle definition creates NO physical inventory and NO stock movement. Members remain
 * individually identifiable through fulfilment, delivery and return ({@code INV-63.3}).
 */
@Entity
@Table(name = "bundle_member")
public class BundleMemberEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "bundle_id", nullable = false, updatable = false)
    private UUID bundleId;

    @Column(name = "member_sellable_id", nullable = false)
    private UUID memberSellableId;

    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    /** An optional member does not constrain the bundle's derived availability. */
    @Column(name = "optional", nullable = false)
    private boolean optional;

    /**
     * {@code PRD-053} — the DECLARED allocation basis for partial-return value.
     *
     * <p>⚠ Recorded, not computed. 🔴 No refund calculation, return window or eligibility rule
     * is implemented here — {@code PRD-051} and {@code GAP-064} remain untouched.
     */
    @Column(name = "price_allocation_basis", length = 120)
    private String priceAllocationBasis;

    @Column(name = "position", nullable = false)
    private int position;

    protected BundleMemberEntity() {
        // JPA
    }

    public BundleMemberEntity(UUID id, UUID bundleId, UUID memberSellableId, BigDecimal quantity) {
        this.id = id;
        this.bundleId = bundleId;
        this.memberSellableId = memberSellableId;
        this.quantity = quantity;
    }

    public UUID getId() { return id; }
    public UUID getBundleId() { return bundleId; }
    public UUID getMemberSellableId() { return memberSellableId; }
    public void setMemberSellableId(UUID v) { this.memberSellableId = v; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal v) { this.quantity = v; }
    public boolean isOptional() { return optional; }
    public void setOptional(boolean v) { this.optional = v; }
    public String getPriceAllocationBasis() { return priceAllocationBasis; }
    public void setPriceAllocationBasis(String v) { this.priceAllocationBasis = v; }
    public int getPosition() { return position; }
    public void setPosition(int v) { this.position = v; }
}
