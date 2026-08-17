package com.trioloo.erp.integration.api;

import com.trioloo.erp.integration.application.AuthorisationUnsupportedException;
import com.trioloo.erp.integration.application.ChannelAuthorisationService;
import com.trioloo.erp.system.application.ShopAccessDeniedException;
import com.trioloo.erp.system.application.ShopNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * The business surface's entry point into Integration ({@code API-069.a}).
 *
 * <p>🔴 THIS NOW STARTS AUTHORISATION; IT DOES NOT FINISH IT. The endpoint used to return a
 * binding outcome, which was only possible because the old contract pretended a redirect flow
 * completed synchronously. It now returns the provider destination, and the outcome arrives later
 * on the provider's callback.
 */
@RestController
@RequestMapping("/api/integration/channel-connections")
public class ChannelConnectionController {

    private final ChannelAuthorisationService authorisation;

    public ChannelConnectionController(ChannelAuthorisationService authorisation) {
        this.authorisation = authorisation;
    }

    /**
     * Starts authorisation for one shop.
     *
     * <p>🔴 THE RESPONSE CARRIES THE DESTINATION AND NOTHING ELSE. No state, no App Secret, no
     * token, no credential ({@code API-070.a}). The state is already recorded server-side; echoing
     * it here would put a one-time secret into a place the frontend could log.
     */
    @PostMapping("/{shopId}/authorize")
    public Map<String, Object> authorize(@PathVariable UUID shopId) {
        ChannelAuthorisationService.InitiationResult result = authorisation.initiate(shopId);
        return Map.of("authorizationUrl", result.authorizationUrl());
    }

    @ExceptionHandler(ShopAccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> denied(ShopAccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "FORBIDDEN", "requiredPermission", e.requiredPermission(),
                        "message", e.getMessage()));
    }

    @ExceptionHandler(AuthorisationUnsupportedException.class)
    public ResponseEntity<Map<String, Object>> unsupported(AuthorisationUnsupportedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "AUTHORISATION_UNSUPPORTED", "message", e.getMessage()));
    }

    @ExceptionHandler(ShopNotFoundException.class)
    public ResponseEntity<Map<String, Object>> missing(ShopNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
    }
}
