package com.trioloo.erp.access.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Ends the session of a person whose account is no longer {@code ACTIVE}.
 *
 * <p>🔴 WHY THIS EXISTS. A signed-in session never times out (owner decision, 2026-10-06: "never logout until I
 * manually log out") and is carried across restarts. Authority is read from the account once, at sign-in, so without
 * this a person who is later SUSPENDED, DISABLED or EXPIRED would stay signed in indefinitely. Account state
 * ({@code PRM-021}) takes effect on the next request instead: the session is invalidated and the request proceeds
 * unauthenticated, which every protected endpoint answers {@code 401}.
 *
 * <p>🔴 IT ALSO KEEPS AUTHORITY CURRENT. For the same reason, what a person may DO is re-read from the account (roles,
 * overrides, and the whole catalogue for an Owner - {@code AGV-037}) at most every {@link #CACHE_MS}, and the signed-in
 * session is updated to it. Otherwise a capability added by a later release would never reach someone who stays signed in
 * (an Owner would not see it), and one that was revoked would never leave them. It re-reads; it grants nothing of its own.
 *
 * <p>The check is one indexed read per person, cached for {@link #CACHE_MS} so it does not run on every request of a
 * busy screen. It never keeps a session alive and never grants anything; it can only end one.
 */
@Component
public class ActiveAccountFilter extends OncePerRequestFilter {

    /** How long one "is this account still ACTIVE?" answer is trusted. */
    static final long CACHE_MS = 30_000;

    private record Checked(boolean active, long at) {
    }

    private final JdbcTemplate jdbc;
    private final AccessUserDetailsService userDetails;
    private final Map<UUID, Checked> recent = new ConcurrentHashMap<>();
    private final Map<UUID, Long> refreshed = new ConcurrentHashMap<>();

    public ActiveAccountFilter(JdbcTemplate jdbc, AccessUserDetailsService userDetails) {
        this.jdbc = jdbc;
        this.userDetails = userDetails;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AccessUserDetails details
                && !isActive(details.getProfileId())) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            SecurityContextHolder.clearContext();
        } else if (authentication != null && authentication.getPrincipal() instanceof AccessUserDetails details) {
            refreshAuthority(request, authentication, details);
        }
        chain.doFilter(request, response);
    }

    /** Re-reads what the person may do and, if it changed, replaces it in this request and in the session. */
    private void refreshAuthority(HttpServletRequest request, Authentication authentication, AccessUserDetails details) {
        long now = System.currentTimeMillis();
        Long last = refreshed.get(details.getProfileId());
        if (last != null && now - last < CACHE_MS) {
            return;
        }
        refreshed.put(details.getProfileId(), now);
        UserDetails fresh;
        try {
            fresh = userDetails.loadUserByUsername(details.getUsername());
        } catch (RuntimeException e) {
            return; // never ends a session by itself: the account-state check above is what does that
        }
        if (fresh.getAuthorities().equals(details.getAuthorities()) || java.util.Set.copyOf(fresh.getAuthorities()).equals(java.util.Set.copyOf(details.getAuthorities()))) {
            return;
        }
        UsernamePasswordAuthenticationToken updated = UsernamePasswordAuthenticationToken.authenticated(fresh, null, fresh.getAuthorities());
        updated.setDetails(authentication.getDetails());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(updated);
        SecurityContextHolder.setContext(context);
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        }
    }

    private boolean isActive(UUID profileId) {
        long now = System.currentTimeMillis();
        Checked known = recent.get(profileId);
        if (known != null && now - known.at() < CACHE_MS) {
            return known.active();
        }
        List<String> states = jdbc.queryForList(
                "SELECT lifecycle_state FROM operational_user_profile WHERE id = ?", String.class, profileId);
        boolean active = !states.isEmpty() && "ACTIVE".equals(states.getFirst());
        recent.put(profileId, new Checked(active, now));
        return active;
    }

    /** Forgets cached answers - used by tests, and harmless anywhere else. */
    void forget() {
        recent.clear();
        refreshed.clear();
    }
}
