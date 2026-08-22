package com.trioloo.erp.integration.infrastructure.diagnostic;

import com.trioloo.erp.integration.application.DarazOrderPullProbe;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * The one-off, server-side Daraz order pull probe.
 *
 * <p>🔴 IT IS NOT AN HTTP ENDPOINT AND NO ROUTE REACHES IT. Invocation needs shell access to the
 * host — an order read reachable from a browser would expose a seller's buyers to anyone.
 *
 * <p>🔴 IT DEFAULTS TO CONTACTING NOTHING. Without {@code --daraz.confirm-read=true} this prints the
 * request it WOULD send and stops. ⚠ That is the opposite default from the listing shape probe and
 * deliberately so: this one reads REAL CUSTOMER ORDERS, so the safe path is the one you get by
 * forgetting a flag.
 *
 * <p>🔴 ORDINARY STARTUP PROBES NOTHING. Without the command this returns immediately, so
 * {@code java -jar backend.jar} can never read orders from Daraz as a side effect.
 *
 * <p>🔴 IT WRITES NOTHING, ON EITHER PATH. No order is stored, no operation recorded, no migration
 * exists to store one in ({@code OSC-060} — no migration number may be assigned while the
 * {@code V15} contradiction stands).
 *
 * <p><strong>Invocation:</strong>
 * {@code java -jar backend.jar daraz-order-pull-probe --daraz.channel-instance-id=<uuid>
 * --daraz.created-after=<iso-instant> --daraz.created-before=<iso-instant> --daraz.dry-run=true}
 * then, only after review,
 * {@code … --daraz.confirm-read=true}
 */
@Component
public class DarazOrderPullRunner implements ApplicationRunner {

    /** The explicit, non-default argument that turns an ordinary start into the probe. */
    public static final String COMMAND = "daraz-order-pull-probe";

    /** ⚠ Named, not positional: a bare UUID on a command line is too easy to paste by mistake. */
    public static final String CHANNEL_ARGUMENT = "daraz.channel-instance-id";

    /** 🔴 {@code DZC-045.a} — an after-date is mandatory; a probe never reads unbounded. */
    public static final String CREATED_AFTER_ARGUMENT = "daraz.created-after";

    /** 🔴 A probe reads a SMALL window, so the far end is required too. */
    public static final String CREATED_BEFORE_ARGUMENT = "daraz.created-before";

    /** ⚠ Prints the request and contacts nothing. This is also what happens by default. */
    public static final String DRY_RUN_ARGUMENT = "daraz.dry-run";

    /** 🔴 THE SECOND GATE. Absent or not exactly {@code true}, no seller API is contacted. */
    public static final String CONFIRM_ARGUMENT = "daraz.confirm-read";

    private final DarazOrderPullProbe probe;
    private final ApplicationContext context;

    public DarazOrderPullRunner(DarazOrderPullProbe probe, ApplicationContext context) {
        this.probe = probe;
        this.context = context;
    }

    /**
     * Whether this JVM was started as the order pull probe.
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
            // 🔴 An ordinary start. Ask nothing, print nothing, read nothing.
            return;
        }

        int exitCode = 0;
        try {
            UUID channelInstanceId = UUID.fromString(required(args, CHANNEL_ARGUMENT));
            Instant createdAfter = instant(args, CREATED_AFTER_ARGUMENT);
            Instant createdBefore = instant(args, CREATED_BEFORE_ARGUMENT);

            /*
              🔴 THE DEFAULT IS THE SAFE PATH. An explicit dry run and a forgotten confirmation
              both land here, and neither contacts the marketplace or the token endpoint.
            */
            if (flag(args, DRY_RUN_ARGUMENT) || !flag(args, CONFIRM_ARGUMENT)) {
                System.out.println("Daraz order pull probe — DRY RUN. Nothing was contacted.");
                System.out.println("----------------------------------------------------------");
                for (String line : probe.describeRequest(channelInstanceId, createdAfter, createdBefore)) {
                    System.out.println(line);
                }
                System.out.println("----------------------------------------------------------");
                if (!flag(args, DRY_RUN_ARGUMENT)) {
                    System.out.println("This is the default. Re-run with --" + CONFIRM_ARGUMENT
                            + "=true to perform ONE real read.");
                }
                System.exit(SpringApplication.exit(context, () -> 0));
                return;
            }

            System.out.println("Daraz order pull probe — ONE read, nothing stored in Trioloo.");
            System.out.println("----------------------------------------------------------");
            for (String line : probe.probe(channelInstanceId, createdAfter, createdBefore)) {
                System.out.println(line);
            }
            System.out.println("----------------------------------------------------------");
            System.out.println("Outcome, counts and field names only. No buyer, address, phone,");
            System.out.println("price, order number or SKU value was printed.");
        } catch (DarazOrderPullProbe.ProbeRefusedException e) {
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

    /** ⚠ Only the exact string {@code true} authorises. Anything else is a refusal. */
    private static boolean flag(ApplicationArguments args, String name) {
        List<String> values = args.getOptionValues(name);
        return values != null && !values.isEmpty() && "true".equalsIgnoreCase(values.getFirst());
    }

    private static String required(ApplicationArguments args, String name) {
        List<String> values = args.getOptionValues(name);
        if (values == null || values.isEmpty() || values.getFirst() == null || values.getFirst().isBlank()) {
            throw new DarazOrderPullProbe.ProbeRefusedException("Refused: --" + name + "=… is required.");
        }
        return values.getFirst();
    }

    /** ⚠ An unparseable instant is a refusal, never a silently defaulted window. */
    private static Instant instant(ApplicationArguments args, String name) {
        String raw = required(args, name);
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException e) {
            throw new DarazOrderPullProbe.ProbeRefusedException(
                    "Refused: --" + name + "=… must be an ISO-8601 instant, e.g. 2026-08-23T00:00:00Z.");
        }
    }
}
