package com.trioloo.erp.integration.api;

import com.trioloo.erp.integration.application.ChannelAuthorisationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProtocolException;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransportException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.UUID;

/**
 * Where Daraz returns the operator after they authorise.
 *
 * <p>This is the route registered on the Daraz App Console as the redirect URI. In production it is
 * {@code https://user.trioloo.com/api/integration/daraz/callback}, and it must match the registered
 * value byte-for-byte ({@code DZC-002}).
 *
 * <p>🔴 THE CALLBACK CANNOT NAME ITS OWN SHOP. It accepts only what the provider sends — a code and
 * the state it echoed back. The shop is recovered from the stored one-time correlation record, so a
 * forged or edited callback cannot steer a successful authorisation onto a different shop. With
 * several Daraz shops connected, that is the difference between binding the right seller and
 * silently binding the wrong one.
 *
 * <p>⚠ IT IS A GET THAT CHANGES STATE, WHICH IS DELIBERATE AND NOT A REST LAPSE. A provider
 * redirect is always a GET; the one-time, expiring, shop-bound state is what authorises the change,
 * and it can be spent exactly once.
 *
 * <p>🔴 NOTHING SECRET IS EVER RENDERED OR REDIRECTED. No token, no code, no state reaches the
 * browser after this point — only the outcome name.
 */
@RestController
@RequestMapping("/api/integration/daraz")
public class DarazCallbackController {

    /**
     * 🔴 WHAT MAY BE LOGGED HERE IS DELIBERATELY NARROW: an exception CLASS, the provider's own
     * error CODE, an outcome name, and a shop id. 
     *
     * <p>🔴 NEVER the authorisation code, the state, a token, the App Secret, the request URI or
     * the response body ({@code API-070.a}). The signed URI carries the App Key; the body carries
     * tokens outright; the state is sufficient to consume an attempt. Exception MESSAGES are not
     * logged either — a provider message can echo request parameters straight back.
     */
    private static final Logger log = LoggerFactory.getLogger(DarazCallbackController.class);

    /** The approved Shops & Channels surfaces the operator is returned to. */
    private static final String SHOP_DETAIL = "/administration/shops/";
    private static final String SHOP_WORKSPACE = "/administration/shops";

    private final ChannelAuthorisationService authorisation;

    public DarazCallbackController(ChannelAuthorisationService authorisation) {
        this.authorisation = authorisation;
    }

    /**
     * Completes authorisation and returns the operator to the exact shop they started from.
     *
     * <p>⚠ {@code code} and {@code state} are OPTIONAL AT THE HTTP LEVEL on purpose. A seller who
     * declines, or a provider error, arrives with them missing; that is an honest
     * {@code NOT_COMPLETED}, not a malformed request to reject with a 400 the operator cannot act
     * on.
     */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam(name = "code", required = false) String code,
                                         @RequestParam(name = "state", required = false) String state) {

        ChannelAuthorisationService.AuthorisationResult result = authorisation.complete(code, state);

        /*
          ⚠ Every callback leaves a trace. Before this, a completed authorisation and a silently
          failing one were indistinguishable in the journal — both produced a 302 and nothing else.
        */
        log.info("Daraz callback completed: outcome={} channelInstance={}",
                result.outcome(),
                result.channelInstanceId() == null ? "unresolved" : result.channelInstanceId());

        /*
          ⚠ ONLY THE OUTCOMES THAT ACTUALLY NAME TWO ACCOUNTS CARRY ONE. On success the bound and
          attempted accounts are the same value, so sending it would put a seller identity in the
          URL and the access log for no benefit — and the page already reads the bound account from
          the record.
        */
        String attempted = switch (result.outcome()) {
            case DIFFERENT_ACCOUNT, CLAIMED_BY_ANOTHER_SHOP -> result.attemptedAccount();
            case AUTHORISED, NOT_COMPLETED -> null;
        };

        return redirectTo(result.channelInstanceId(), result.outcome().name(), attempted);
    }

    /**
     * ⚠ A provider or transport failure is NOT an authorisation verdict ({@code DZC-011}). The
     * operator is returned to the workspace with a neutral outcome rather than being told their
     * seller authorisation has failed — nothing here proves that.
     */
    @ExceptionHandler({DarazProtocolException.class, DarazTransportException.class})
    public ResponseEntity<Void> providerFailure(RuntimeException e) {
        /*
          🔴 THE LINE WHOSE ABSENCE CAUSED THE INCIDENT. Provider failures were redirected silently,
          so five live authorisation attempts produced 302s and ZERO journal entries — there was
          nothing to diagnose from. The shop is not named here because this handler genuinely does
          not know it; the service logs the resolved instance a moment earlier, and the two lines
          pair up by time.

          ⚠ The stack trace is deliberately not attached: these exceptions carry no cause by
          construction, and a provider client's trace can quote the signed request URI.
        */
        if (e instanceof DarazProtocolException protocol) {
            /*
              ✅ EVERY FIELD HERE IS A CLASSIFICATION OR A NAME. reason says WHY, field says WHICH
              field, topLevelFields says what SHAPE arrived, requestId lets Daraz's own support find
              the call. 🔴 Not one of them can hold a token, an authorisation code, a state, the App
              Secret, a body fragment or the signed URI.
            */
            log.warn("Daraz callback failed at the provider: type={} reason={} field={} "
                            + "providerCode={} providerType={} requestId={} topLevelFields={} "
                            + "outcome=PROVIDER_ERROR",
                    e.getClass().getSimpleName(),
                    protocol.reason(),
                    protocol.field(),
                    protocol.providerCode(),
                    protocol.providerType(),
                    protocol.requestId(),
                    protocol.topLevelFields());
        } else if (e instanceof DarazTransportException transport) {
            /* ⚠ httpStatus present = the provider answered badly; absent = it was never reached. */
            log.warn("Daraz callback failed in transport: type={} httpStatus={} reached={} "
                            + "outcome=PROVIDER_ERROR",
                    e.getClass().getSimpleName(),
                    transport.httpStatus(),
                    transport.isHttpStatusFailure());
        } else {
            log.warn("Daraz callback failed: type={} outcome=PROVIDER_ERROR", e.getClass().getSimpleName());
        }

        return redirectTo(null, "PROVIDER_ERROR", null);
    }

    private ResponseEntity<Void> redirectTo(UUID shopId, String outcome, String attemptedAccount) {
        /*
          ⚠ An unusable state resolves to NO shop, so there is nowhere specific to send the
          operator. The workspace is the honest destination — guessing a shop would be worse.
        */
        String path = shopId == null ? SHOP_WORKSPACE : SHOP_DETAIL + shopId;

        UriComponentsBuilder destination = UriComponentsBuilder.fromPath(path)
                .queryParam("authorisation", outcome);

        /*
          ✅ SCS-041.b — the external account identity is a SAFE, NON-SECRET BUSINESS FACT, and
          SCS-044's mismatch notice already displays it on this very page. Carrying it back is what
          lets that ratified sentence — "you signed in as X, but this shop is bound to Y" — still be
          true after a redirect.
          🔴 NOTHING ELSE CROSSES. No token, no authorisation code, no state (API-070.a).
        */
        if (attemptedAccount != null && !attemptedAccount.isBlank()) {
            destination.queryParam("attempted", attemptedAccount);
        }

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(destination.build().encode().toUri())
                .build();
    }
}
