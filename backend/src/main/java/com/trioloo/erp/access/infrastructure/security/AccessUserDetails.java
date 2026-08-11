package com.trioloo.erp.access.infrastructure.security;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.domain.Actor;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * Spring Security's view of an authenticated principal.
 *
 * <p>Confined to {@code infrastructure/security}. Application and domain code sees only
 * {@link Actor} ({@code PRJ-021}).
 *
 * <p>Authorities are the resolved <em>permission</em> codes, not roles. Roles are carried
 * separately for title-bound decisions and are deliberately NOT exposed as
 * {@code ROLE_} authorities, so that no future endpoint can accidentally authorise on a
 * title where the architecture requires a permission ({@code AGV 13.4}, {@code PRM} P6).
 */
public class AccessUserDetails implements UserDetails {

    private final UUID profileId;
    private final String username;
    private final String fullName;
    private final String passwordHash;
    private final AccountLifecycleState lifecycleState;
    private final Set<String> roleCodes;
    private final Set<String> permissions;

    public AccessUserDetails(UUID profileId, String username, String fullName, String passwordHash,
                             AccountLifecycleState lifecycleState, Set<String> roleCodes,
                             Set<String> permissions) {
        this.profileId = profileId;
        this.username = username;
        this.fullName = fullName;
        this.passwordHash = passwordHash;
        this.lifecycleState = lifecycleState;
        this.roleCodes = Set.copyOf(roleCodes);
        this.permissions = Set.copyOf(permissions);
    }

    /** The framework-free actor handed inward to application services. */
    public Actor toActor() {
        return new Actor(profileId, username, fullName, roleCodes, permissions);
    }

    public UUID getProfileId() {
        return profileId;
    }

    public AccountLifecycleState getLifecycleState() {
        return lifecycleState;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return permissions.stream().map(SimpleGrantedAuthority::new).map(GrantedAuthority.class::cast).toList();
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }

    /**
     * Lifecycle gate.
     *
     * <p>{@code ACTIVE} and {@code INVITED} may authenticate — an {@code INVITED} account's
     * first successful sign-in is exactly what activates it. {@code SUSPENDED},
     * {@code DISABLED} and {@code EXPIRED} are refused. Deny by default ({@code PRM} P3).
     */
    @Override
    public boolean isEnabled() {
        return lifecycleState.mayAuthenticate();
    }

    /** No canonical lockout policy exists, and none is invented ({@code PRM 2.2}). */
    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    /** No canonical credential-expiry policy exists, and none is invented. */
    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    static List<String> noAuthorities() {
        return List.of();
    }
}
