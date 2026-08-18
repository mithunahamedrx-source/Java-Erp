package com.trioloo.erp.integration.infrastructure.diagnostic;

import com.trioloo.erp.integration.application.DarazListingShapeDiagnostic;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * The one-off, server-side Daraz listing shape probe.
 *
 * <p>🔴 IT IS NOT AN HTTP ENDPOINT AND NO ROUTE REACHES IT. Invocation needs shell access to the
 * production host, exactly as the Owner bootstrap does — a probe that could be triggered from the
 * browser would let anyone spend a seller's API quota.
 *
 * <p>🔴 ORDINARY STARTUP PROBES NOTHING. Without the explicit argument this returns immediately,
 * so {@code java -jar backend.jar} can never contact Daraz as a side effect. ⚠ That matters more
 * here than for the bootstrap: this jar also carries the listing adapter, and a probe firing on
 * every restart would be a recurring live call nobody asked for.
 *
 * <p>🔴 IT ASKS ONCE AND WRITES NOTHING. One {@code /products/get}, no paging, no retry, and no
 * path to listing persistence — see {@link DarazListingShapeDiagnostic}.
 *
 * <p><strong>Invocation:</strong>
 * {@code java -jar backend.jar daraz-listing-shape --daraz.channel-instance-id=<uuid>}
 */
@Component
public class DarazListingShapeRunner implements ApplicationRunner {

    /** The explicit, non-default argument that turns an ordinary start into the probe. */
    public static final String COMMAND = "daraz-listing-shape";

    /** ⚠ Named, not positional: a bare UUID on a command line is too easy to paste by mistake. */
    public static final String CHANNEL_ARGUMENT = "daraz.channel-instance-id";

    private final DarazListingShapeDiagnostic diagnostic;
    private final ApplicationContext context;

    public DarazListingShapeRunner(DarazListingShapeDiagnostic diagnostic, ApplicationContext context) {
        this.diagnostic = diagnostic;
        this.context = context;
    }

    /**
     * Whether this JVM was started as the probe.
     *
     * <p>⚠ Consulted by {@code TriolooErpApplication} so the command runs with NO web server —
     * otherwise it would try to bind 8080 and collide with the running service.
     */
    public static boolean isProbeInvocation(String[] args) {
        return args != null && Arrays.asList(args).contains(COMMAND);
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!args.getNonOptionArgs().contains(COMMAND)) {
            // 🔴 An ordinary start. Ask nothing, print nothing, change nothing.
            return;
        }

        int exitCode = 0;
        try {
            UUID channelInstanceId = UUID.fromString(required(args, CHANNEL_ARGUMENT));
            System.out.println("Daraz listing shape probe — one request, nothing written.");
            System.out.println("----------------------------------------------------------");
            for (String line : diagnostic.probe(channelInstanceId)) {
                System.out.println(line);
            }
            System.out.println("----------------------------------------------------------");
            System.out.println("Field names, node types and counts only. No listing value was read out.");
        } catch (DarazListingShapeDiagnostic.DiagnosticRefusedException e) {
            System.out.println(e.getMessage());
            exitCode = 2;
        } catch (IllegalArgumentException e) {
            System.out.println("Refused: --" + CHANNEL_ARGUMENT + "=… must be a valid id.");
            exitCode = 2;
        } catch (Exception e) {
            /* 🔴 Never print the cause chain: it can carry a signed URI or a connection string. */
            System.out.println("Probe failed: " + e.getClass().getSimpleName());
            exitCode = 1;
        }
        final int status = exitCode;
        System.exit(SpringApplication.exit(context, () -> status));
    }

    private static String required(ApplicationArguments args, String name) {
        List<String> values = args.getOptionValues(name);
        if (values == null || values.isEmpty() || values.getFirst() == null || values.getFirst().isBlank()) {
            throw new DarazListingShapeDiagnostic.DiagnosticRefusedException(
                    "Refused: --" + name + "=… is required.");
        }
        return values.getFirst();
    }
}
