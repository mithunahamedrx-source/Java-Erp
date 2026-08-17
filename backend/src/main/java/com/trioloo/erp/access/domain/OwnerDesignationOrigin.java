package com.trioloo.erp.access.domain;

/**
 * How an Owner authority designation arose ({@code AGV-041}).
 *
 * <p>🔴 EXACTLY TWO, AND THEY ARE NOT INTERCHANGEABLE. The distinction exists so audit data
 * stays TRUTHFUL: the first Owner was not designated by anybody, and saying otherwise would
 * record a grant that never happened.
 *
 * <p>🔴 This is NOT a role and NOT a permission ({@code AGV-037}, {@code AGV-039}). It
 * describes the provenance of a designation carried on {@code E-077}.
 */
public enum OwnerDesignationOrigin {

    /**
     * The one-time first Owner, created by the server-side bootstrap command.
     *
     * <p>🔴 CARRIES NO DESIGNATING OWNER, because at that moment none existed. The database
     * enforces that ({@code V13}), and at most one profile may ever hold this value.
     */
    INITIAL_BOOTSTRAP,

    /**
     * An Owner designated by an existing authorised Owner ({@code AGV-038}).
     *
     * <p>🔴 ALWAYS names the designating Owner. ⚠ No surface performs this yet; the value
     * exists so the ordinary path is representable and the bootstrap stays distinguishable
     * from it forever.
     */
    OWNER_GRANT
}
