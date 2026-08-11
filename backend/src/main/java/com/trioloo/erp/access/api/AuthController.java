package com.trioloo.erp.access.api;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.application.SignInActivationService;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotBlank;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The minimum authentication surface the frontend needs: login, logout, current user.
 *
 * <p>🔴 No Users, Roles or Permissions CRUD. Administration screens are a later step, and
 * this controller deliberately offers no way to create or modify an identity — which also
 * means it cannot become an accidental bootstrap route around
 * {@code GAP-120}/{@code GAP-121}/{@code GAP-122}.
 *
 * <p>{@code PRJ-031}: a controller never becomes the business-service layer. Lifecycle
 * advancement lives in {@link SignInActivationService}; authority resolution lives in the
 * application layer.
 */
@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SignInActivationService activation;
    private final CurrentActor currentActor;
    private final SecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    /**
     * Session fixation protection.
     *
     * <p>🔴 Applied explicitly here because it has to be. {@code HttpSecurity.sessionFixation()}
     * is honoured by Spring Security's OWN authentication filters, and this controller
     * authenticates directly against the {@code AuthenticationManager} instead — so without
     * this strategy the session id would survive authentication untouched, and an attacker
     * who fixed that id beforehand would inherit the authenticated session. Proven by
     * {@code SecurityBehaviourTest.authenticationRotatesTheSessionIdentifier}.
     */
    private final SessionAuthenticationStrategy sessionStrategy = new ChangeSessionIdAuthenticationStrategy();

    public AuthController(AuthenticationManager authenticationManager,
                          SignInActivationService activation,
                          CurrentActor currentActor) {
        this.authenticationManager = authenticationManager;
        this.activation = activation;
        this.currentActor = currentActor;
    }

    /** Credentials submitted by the login form. */
    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }

    /**
     * What the frontend is told about the signed-in actor.
     *
     * <p>Exposes identity, titles and effective permissions — enough to render
     * permission-aware navigation as an affordance ({@code UX-014}) — and nothing else.
     * 🔴 No password hash, no lifecycle internals, no session identifier, no security
     * metadata.
     */
    public record CurrentUserResponse(UUID id, String username, String fullName,
                                      Set<String> roles, Set<String> permissions) {
        static CurrentUserResponse of(Actor actor) {
            return new CurrentUserResponse(actor.id(), actor.username(), actor.fullName(),
                    actor.roleCodes(), actor.permissions());
        }
    }

    /**
     * Establishes a session.
     *
     * <p>On success the {@code INVITED → ACTIVE} transition is applied — after credential
     * verification, never before.
     *
     * <p>🔴 Every failure returns the same {@code 401} with no body detail. A wrong
     * username, a wrong password, and a {@code SUSPENDED}, {@code DISABLED} or
     * {@code EXPIRED} account are indistinguishable to the caller, so the endpoint cannot
     * be used to enumerate accounts or probe account state. No canonical policy permits
     * disclosing which failed.
     */
    @PostMapping("/login")
    public ResponseEntity<CurrentUserResponse> login(@RequestBody LoginRequest request,
                                                     HttpServletRequest httpRequest,
                                                     HttpServletResponse httpResponse) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        } catch (AuthenticationException failure) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // Rotate the session id BEFORE the authenticated context is stored, so no
        // pre-authentication identifier ever addresses an authenticated session.
        sessionStrategy.onAuthentication(authentication, httpRequest, httpResponse);

        if (authentication.getPrincipal() instanceof AccessUserDetails details) {
            // Canonical lifecycle transition, only now that credentials are proven.
            activation.activateIfFirstSignIn(details.getProfileId());
        }

        // Persist the authenticated context into the (already rotated) session.
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, httpRequest, httpResponse);

        return currentActor.current()
                .map(actor -> ResponseEntity.ok(CurrentUserResponse.of(actor)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    /** The signed-in actor, or {@code 401} when there is none. */
    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> me() {
        return currentActor.current()
                .map(actor -> ResponseEntity.ok(CurrentUserResponse.of(actor)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    /** Invalidates the session and clears the security context. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        var session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    /**
     * Issues the CSRF cookie before login.
     *
     * <p>The login POST is itself CSRF-protected, so the SPA needs a token before it can
     * authenticate. This returns nothing but the cookie.
     */
    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken token) {
        // 🔴 Touching the token is REQUIRED, not ceremonial. Spring Security defers CSRF
        // token loading, so the CookieCsrfTokenRepository only writes the XSRF-TOKEN cookie
        // once the token is actually resolved. Returning without this call issues no cookie,
        // and the SPA can then never send a valid token on its first state-changing request.
        token.getToken();
        return ResponseEntity.noContent().build();
    }
}
