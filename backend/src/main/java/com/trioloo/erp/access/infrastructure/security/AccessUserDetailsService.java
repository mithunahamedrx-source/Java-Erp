package com.trioloo.erp.access.infrastructure.security;

import com.trioloo.erp.access.application.AuthorityResolution;
import com.trioloo.erp.access.application.AuthorityResolution.PermissionOverride;
import com.trioloo.erp.access.application.AuthorityResolution.OverrideDirection;
import com.trioloo.erp.access.infrastructure.persistence.UserCredentialRepository;
import com.trioloo.erp.access.infrastructure.persistence.UserProfileRepository;
import com.trioloo.erp.access.infrastructure.persistence.UserCredentialEntity;
import com.trioloo.erp.access.infrastructure.persistence.UserProfileEntity;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loads an identity and resolves its effective authority for authentication.
 *
 * <p>Assembles the canonical four-part composition ({@code AGV-018}) — profile, roles,
 * overrides — and delegates precedence to {@link AuthorityResolution} so the rules stay in
 * one testable place. Scope is the fourth component and is not applied; see that class.
 */
@Service
public class AccessUserDetailsService implements UserDetailsService {

    private final UserProfileRepository profiles;
    private final UserCredentialRepository credentials;
    private final Clock clock;

    public AccessUserDetailsService(UserProfileRepository profiles, UserCredentialRepository credentials, Clock clock) {
        this.profiles = profiles;
        this.credentials = credentials;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserProfileEntity profile = profiles.findByUsername(username)
                // The message never reaches the client: the login endpoint returns one
                // generic failure so the response cannot be used to enumerate accounts.
                .orElseThrow(() -> new UsernameNotFoundException("no such operational user profile"));

        String hash = credentials.findById(profile.getId())
                .map(UserCredentialEntity::getPasswordHash)
                // An identity with no credential cannot authenticate. Deny by default.
                .orElseThrow(() -> new UsernameNotFoundException("no credential for profile"));

        Set<String> roleCodes = Set.copyOf(profiles.findRoleCodes(profile.getId()));
        Set<String> roleDerived = Set.copyOf(profiles.findRoleDerivedPermissionCodes(profile.getId()));
        Set<String> effective = AuthorityResolution.effectivePermissions(
                roleDerived, readOverrides(profile), Instant.now(clock));

        return new AccessUserDetails(profile.getId(), profile.getUsername(), profile.getFullName(),
                hash, profile.getLifecycleState(), roleCodes, effective);
    }

    private List<PermissionOverride> readOverrides(UserProfileEntity profile) {
        List<PermissionOverride> overrides = new ArrayList<>();
        for (Object[] row : profiles.findOverrideRows(profile.getId())) {
            overrides.add(new PermissionOverride(
                    null,
                    (String) row[0],
                    OverrideDirection.valueOf((String) row[1]),
                    (String) row[2],
                    toInstant(row[3]),
                    toInstant(row[4])));
        }
        return overrides;
    }

    private static Instant toInstant(Object value) {
        return switch (value) {
            case null -> null;
            case Timestamp timestamp -> timestamp.toInstant();
            case Instant instant -> instant;
            case java.time.OffsetDateTime odt -> odt.toInstant();
            default -> throw new IllegalStateException("Unexpected timestamp type: " + value.getClass());
        };
    }
}
