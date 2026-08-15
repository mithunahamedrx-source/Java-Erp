package com.trioloo.erp.access.application;

import com.trioloo.erp.access.infrastructure.persistence.UserProfileEntity;
import com.trioloo.erp.access.infrastructure.persistence.UserProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Resolves a stored actor identifier to a display name.
 *
 * <p>🔴 {@code AGV-001} / {@code PRJ-091} — attribution is captured AT WRITE TIME as the
 * {@code E-077} identifier. This service exists so a name may be SHOWN afterwards; it never
 * reconstructs who acted. The identifier on the record remains the authoritative fact, and a
 * profile that has since been renamed or deactivated does not change what happened.
 *
 * <p>{@code PRJ-021} — modules read one another through the application layer. This is the
 * seam other modules use instead of reaching into {@code access} persistence directly.
 */
@Service
public class ActorDirectory {

    private final UserProfileRepository profiles;

    public ActorDirectory(UserProfileRepository profiles) {
        this.profiles = profiles;
    }

    /**
     * Display names for the given actors, keyed by identifier.
     *
     * <p>⚠ An identifier with no surviving profile is simply absent from the map. Callers
     * show the identifier rather than inventing a name.
     */
    @Transactional(readOnly = true)
    public Map<UUID, String> namesOf(Collection<UUID> actorIds) {
        if (actorIds == null || actorIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> names = new HashMap<>();
        for (UserProfileEntity profile : profiles.findAllById(actorIds)) {
            names.put(profile.getId(), profile.getFullName() == null
                    ? profile.getUsername() : profile.getFullName());
        }
        return names;
    }

    /** The display name for one actor, or {@code null} when no profile survives. */
    @Transactional(readOnly = true)
    public String nameOf(UUID actorId) {
        return actorId == null ? null : namesOf(java.util.List.of(actorId)).get(actorId);
    }
}
