package com.trioloo.erp.accounting.application;

/**
 * The ratified Sales Invoice capability codes — {@code PRM-094}.
 *
 * <p>🔴 THE MODULE SEGMENT IS {@code accounting}, NOT {@code order}. {@code PRN-023} sources the
 * Sales Invoice printable from {@code E-039}, and {@code DOMAIN_MODEL.md} places that entity with
 * Accounting. {@code PRM-089.a} requires the OWNING module to name the code, because that is the
 * module that enforces it.
 *
 * <p>🔴 ISSUING IS A WRITE AND VIEWING IS NOT, SO THEY ARE SEPARATE ({@code PRM-094.a}). ⚠ An
 * invoice carries commercial and legal weight: the person who prints one for a customer is not
 * necessarily the person authorised to create one.
 */
public final class AccountingPermissions {

    /** {@code PRM-094} — read an issued invoice and its {@code INV-39.2} snapshot. */
    public static final String SALES_INVOICE_VIEW = "accounting.sales-invoice.view";

    /**
     * {@code PRM-094} — issue the invoice for an order, taking the snapshot.
     *
     * <p>🔴 It grants no re-issue and no cancellation. {@code INV-39.1} — one sequence, never
     * reused, and a cancelled number is RETIRED rather than recycled ({@code DB-012}).
     */
    public static final String SALES_INVOICE_ISSUE = "accounting.sales-invoice.issue";

    private AccountingPermissions() {
    }
}
