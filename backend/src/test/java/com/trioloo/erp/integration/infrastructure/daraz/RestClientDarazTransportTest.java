package com.trioloo.erp.integration.infrastructure.daraz;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The Daraz transport, against a REAL HTTP server.
 *
 * <p>🔴 A LOOPBACK SERVER, NEVER THE MARKETPLACE. Every request here goes to a JDK
 * {@link HttpServer} bound to {@code 127.0.0.1} on an ephemeral port. No Daraz host is resolved,
 * no credential exists, and nothing leaves the machine.
 *
 * <p>✅ IT USES THE JDK'S OWN SERVER RATHER THAN A NEW TEST DEPENDENCY. The claims under test are
 * about bytes on the wire — the exact body, the declared content type, the status handling — and
 * only a real server can observe those. A mocking layer would assert what the test itself stubbed.
 */
class RestClientDarazTransportTest {

    private final RestClientDarazTransport transport = new RestClientDarazTransport();

    private HttpServer server;
    private URI base;

    /** What the last request actually carried. */
    private final AtomicReference<String> method = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();
    private final AtomicReference<String> contentType = new AtomicReference<>();

    private int status = 200;
    private String response = "{\"code\":\"0\"}";

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
        base = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/rest/probe?sign=abc");
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private void handle(HttpExchange exchange) throws IOException {
        method.set(exchange.getRequestMethod());
        body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
        byte[] out = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, out.length);
        exchange.getResponseBody().write(out);
        exchange.close();
    }

    /** A port nothing is listening on, for the unreachable case. */
    private static URI deadPort() throws IOException {
        int port;
        try (ServerSocket socket = new ServerSocket(0)) {
            port = socket.getLocalPort();
        }
        return URI.create("http://127.0.0.1:" + port + "/rest/probe");
    }

    // ================================================================ GET, unchanged

    @Test
    @DisplayName("GET still returns the raw body and judges nothing")
    void getIsUnchanged() {
        response = "{\"code\":\"IllegalAccessToken\",\"type\":\"ISV\"}";

        String returned = transport.get(base);

        /* 🔴 A provider failure inside an HTTP 200 reaches the caller untouched (`DZC-011`). */
        assertThat(returned).isEqualTo(response);
        assertThat(method.get()).isEqualTo("GET");
    }

    @Test
    @DisplayName("GET carries no request body")
    void getSendsNoBody() {
        transport.get(base);
        assertThat(body.get()).isEmpty();
    }

    // ================================================================ POST

    @Test
    @DisplayName("POST sends the exact body it was given, byte for byte")
    void postSendsExactBody() {
        String payload = "{\"item_id\":180226526,\"nested\":{\"quoted\":\"a \\\"b\\\" c\"}}";

        transport.post(base, payload, "application/json");

        assertThat(method.get()).isEqualTo("POST");
        /* 🔴 Not re-encoded, not pretty-printed: the signature spans these bytes (`DZC-008`). */
        assertThat(body.get()).isEqualTo(payload);
    }

    @Test
    @DisplayName("POST declares the content type it was told to, and invents none")
    void postDeclaresGivenContentType() {
        transport.post(base, "a=1", "application/x-www-form-urlencoded");
        assertThat(contentType.get()).startsWith("application/x-www-form-urlencoded");

        transport.post(base, "{}", "application/json");
        assertThat(contentType.get()).startsWith("application/json");
    }

    @Test
    @DisplayName("POST returns the response body on 2xx")
    void postReturnsBodyOn2xx() {
        response = "{\"code\":\"0\",\"data\":{\"total_products\":\"0\"}}";
        assertThat(transport.post(base, "{}", "application/json")).isEqualTo(response);
    }

    /** ⚠ `DZC-008` allows a POST with no body; it must not be rejected locally. */
    @Test
    @DisplayName("a null body is sent as empty rather than refused")
    void nullBodyIsSentEmpty() {
        transport.post(base, null, "application/json");
        assertThat(method.get()).isEqualTo("POST");
        assertThat(body.get()).isEmpty();
    }

    /** 🔴 A bad content type is a LOCAL fault and must not be blamed on the marketplace. */
    @Test
    @DisplayName("an unusable content type fails before the call, not as a transport failure")
    void badContentTypeIsNotATransportFailure() {
        assertThatThrownBy(() -> transport.post(base, "{}", "not a media type"))
                .isNotInstanceOf(DarazTransportException.class);
        assertThat(method.get()).isNull();   // nothing was sent
    }

    // ================================================================ failure classification

    @Test
    @DisplayName("POST reports a bad status as reached, carrying the status")
    void postNonSuccessIsReached() {
        status = 503;

        assertThatThrownBy(() -> transport.post(base, "{}", "application/json"))
                .isInstanceOf(DarazTransportException.class)
                .satisfies(e -> {
                    DarazTransportException t = (DarazTransportException) e;
                    assertThat(t.httpStatus()).isEqualTo(503);
                    assertThat(t.isHttpStatusFailure()).isTrue();
                });
    }

    @Test
    @DisplayName("POST reports an unreachable host as not reached, with no status")
    void postUnreachableIsNotReached() throws IOException {
        URI dead = deadPort();

        assertThatThrownBy(() -> transport.post(dead, "{}", "application/json"))
                .isInstanceOf(DarazTransportException.class)
                .satisfies(e -> {
                    DarazTransportException t = (DarazTransportException) e;
                    assertThat(t.httpStatus()).isNull();
                    assertThat(t.isHttpStatusFailure()).isFalse();
                });
    }

    /** ✅ GET and POST classify identically — no endpoint gets special error behaviour. */
    @Test
    @DisplayName("GET and POST classify the same failure the same way")
    void classificationIsShared() throws IOException {
        status = 500;
        Integer postStatus = statusOf(() -> transport.post(base, "{}", "application/json"));
        Integer getStatus = statusOf(() -> transport.get(base));
        assertThat(postStatus).isEqualTo(getStatus).isEqualTo(500);

        URI dead = deadPort();
        assertThat(statusOf(() -> transport.post(dead, "{}", "application/json"))).isNull();
        assertThat(statusOf(() -> transport.get(dead))).isNull();
    }

    private static Integer statusOf(Runnable call) {
        try {
            call.run();
            throw new AssertionError("expected a transport failure");
        } catch (DarazTransportException e) {
            return e.httpStatus();
        }
    }

    // ================================================================ leak hygiene

    /**
     * 🔴 THE SIGNED URI AND THE BODY ARE THE TWO MOST DANGEROUS STRINGS IN THIS CLASS. The query
     * carries the App Key and, on seller-scoped calls, the access token; the body carries tokens
     * outright. Neither may survive into a message a log will print.
     */
    @Test
    @DisplayName("no failure carries the URI, the body, the signature or a token")
    void failuresLeakNothing() throws IOException {
        URI signed = URI.create(base + "&app_key=100000&access_token=50000-SECRET-TOKEN");
        String secretBody = "{\"refresh_token\":\"50000-SECRET-REFRESH\"}";
        status = 401;

        String fromStatus = messageOf(() -> transport.post(signed, secretBody, "application/json"));
        String fromUnreachable = messageOf(() -> transport.post(deadPort(), secretBody, "application/json"));
        String fromGet = messageOf(() -> transport.get(signed));

        for (String message : new String[]{fromStatus, fromUnreachable, fromGet}) {
            assertThat(message).doesNotContain("50000-SECRET-TOKEN");
            assertThat(message).doesNotContain("50000-SECRET-REFRESH");
            assertThat(message).doesNotContain("refresh_token");
            assertThat(message).doesNotContain("app_key");
            assertThat(message).doesNotContain("sign=");
            assertThat(message).doesNotContain("127.0.0.1");
            assertThat(message).doesNotContain("http");
        }
    }

    /** 🔴 The cause is not chained either — a client exception's own message quotes the URI. */
    @Test
    @DisplayName("no failure chains a cause that could carry the URI")
    void failuresChainNothing() throws IOException {
        assertThatThrownBy(() -> transport.post(deadPort(), "{}", "application/json"))
                .isInstanceOf(DarazTransportException.class)
                .satisfies(e -> assertThat(e.getCause()).isNull());
    }

    private static String messageOf(ThrowingCall call) {
        try {
            call.run();
            throw new AssertionError("expected a transport failure");
        } catch (DarazTransportException e) {
            return String.valueOf(e.getMessage());
        } catch (IOException e) {
            throw new AssertionError(e);
        }
    }

    @FunctionalInterface
    private interface ThrowingCall {
        void run() throws IOException;
    }
}
