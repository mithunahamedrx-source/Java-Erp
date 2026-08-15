package com.trioloo.erp.product.domain;

/**
 * The role a media reference plays for the thing it is attached to, {@code PRD-168}.
 *
 * <p>🔴 The role belongs to the REFERENCE, never to {@code E-105} itself ({@code INV-105.6}).
 * The same asset may be {@code PRIMARY} for one Sellable Product and {@code GALLERY} for
 * another.
 *
 * <p>🔴 {@code PRIMARY} is OPTIONAL and is NEVER auto-selected ({@code PRD-168.b},
 * {@code PRD-168.c}). No first-uploaded, lowest-sort, most-recent or largest-file rule
 * promotes a {@code GALLERY} reference.
 */
public enum MediaRole {
    PRIMARY,
    GALLERY
}
