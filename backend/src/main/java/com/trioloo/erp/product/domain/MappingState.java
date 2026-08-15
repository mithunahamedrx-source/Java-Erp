package com.trioloo.erp.product.domain;

/**
 * The mapping condition of a listing, {@code PRD-178}.
 *
 * <p>🔴 DERIVED from its orderable channel SKUs, never stored ({@code DB-001}). The
 * authoritative mapping lives on {@code E-106} ({@code INV-106.2}).
 *
 * <p>✅ {@code UNMAPPED} is an ORDINARY working condition, not an error ({@code PRD-178.d}).
 * It is expected to describe most listings immediately after a first discovery.
 */
public enum MappingState {

    /** No orderable SKU carries a Sellable Product. */
    UNMAPPED,

    /** Some, but not all, orderable SKUs are mapped — only possible on a variation listing. */
    PARTIALLY_MAPPED,

    /** Every orderable SKU carries exactly one Sellable Product. */
    MAPPED
}
