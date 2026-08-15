package com.trioloo.erp.product.domain;

/**
 * The {@code E-060} Build Template lifecycle — {@code DRAFT → ACTIVE → SUPERSEDED → WITHDRAWN}.
 *
 * <p>🔴 Transcribed from {@code DOMAIN_MODEL.md} {@code E-060}. It is NOT the {@code SYS §7.1}
 * master record lifecycle and must never be conflated with it: a template version is a
 * versioned specification, not a master record, and {@code SUPERSEDED} has no {@code SYS §7.1}
 * counterpart.
 *
 * <p>🔴 {@code INV-60.4} / {@code PRD-068} — a {@code SUPERSEDED} version is retained
 * PERMANENTLY, because As-Built Records reference it and {@code DB-003} forbids the past
 * moving. There is no delete transition and none may be added.
 */
public enum BuildTemplateStatus {

    /** Under authorship. 🔴 The ONLY state in which BOM lines may be changed ({@code PRD-069}). */
    DRAFT,

    /** {@code INV-60.1} / {@code PRD-067} — exactly one per Sellable Product at any effective date. */
    ACTIVE,

    /** Replaced by a later version. Retained permanently ({@code PRD-068}). */
    SUPERSEDED,

    /** Withdrawn without a replacement. Equally permanent. */
    WITHDRAWN
}
