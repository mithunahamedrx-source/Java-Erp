package com.trioloo.erp.access.application;

import com.trioloo.erp.access.domain.Actor;
import java.util.Optional;

/**
 * The one way application and domain code obtains the authenticated actor.
 *
 * <p>🔴 This port exists so that no service outside {@code infrastructure/security} ever
 * touches {@code SecurityContextHolder}, {@code HttpSession}, or any Spring Security type
 * ({@code PRJ-021}). The adapter may use Spring Security; everything inward sees only
 * {@link Actor}.
 *
 * <p>It is the foundation for write-time attribution ({@code AGV-001}): every future write
 * that must record who acted resolves the actor here, at the moment of the action — never
 * by reconstructing it from an audit log afterwards.
 */
public interface CurrentActor {

    /**
     * The authenticated actor, or empty when the request is unauthenticated.
     *
     * <p>Returning {@link Optional} rather than throwing keeps "no actor" a normal,
     * expressible state — {@code SYS-034}'s absent-is-not-zero discipline applied to identity.
     */
    Optional<Actor> current();

    /**
     * The authenticated actor, or a failure when there is none.
     *
     * <p>For write paths where architecture requires attribution and proceeding without an
     * actor would produce an unattributable record.
     */
    default Actor require() {
        return current().orElseThrow(() ->
                new IllegalStateException("No authenticated actor: this action requires attribution (AGV-001)"));
    }
}
