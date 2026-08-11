package com.trioloo.erp.access.infrastructure.security;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * The single adapter between Spring Security and the framework-free {@link Actor}.
 *
 * <p>🔴 This is the ONLY class in the application permitted to touch
 * {@code SecurityContextHolder}. Everything else — application services, and later every
 * domain module — depends on the {@link CurrentActor} port instead ({@code PRJ-021}).
 *
 * <p>When a future order confirmation records {@code Confirmed By}, or a stock movement
 * records who moved it, it resolves the actor through this port at the moment of the write
 * ({@code AGV-001}) rather than reconstructing attribution from logs afterwards.
 */
@Component
public class SessionCurrentActor implements CurrentActor {

    @Override
    public Optional<Actor> current() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }
        if (!(authentication.getPrincipal() instanceof AccessUserDetails details)) {
            // Anonymous authentication carries a String principal. That is not an actor.
            return Optional.empty();
        }
        return Optional.of(details.toActor());
    }
}
