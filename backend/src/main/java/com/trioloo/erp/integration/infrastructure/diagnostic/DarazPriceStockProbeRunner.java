package com.trioloo.erp.integration.infrastructure.diagnostic;

import com.trioloo.erp.integration.application.DarazPriceStockProbe;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * The one-off, server-side Daraz price and stock write probe.
 *
 * <p>🔴 IT IS NOT AN HTTP ENDPOINT AND NO ROUTE REACHES IT. Invocation needs shell access to the
 * production host — a write probe reachable from a browser would let anyone change a seller's price.
 *
 * <p>🔴 IT IS GATED TWICE, WHICH THE READ PROBE IS NOT. The command name selects it and a separate
 * {@code --daraz.confirm-same-value-write=true} authorises it. ⚠ ONE ARGUMENT IS ENOUGH FOR A READ
 * AND NOT FOR A WRITE: a command that only had to be named could be re-run from shell history, and
 * this one contacts a live marketplace with a write verb.
 *
 * <p>🔴 ORDINARY STARTUP PROBES NOTHING. Without the command this returns immediately, so
 * {@code java -jar backend.jar} can never write to Daraz as a side effect.
 *
 * <p>⚠ {@code --daraz.dry-run=true} PRINTS THE PAYLOAD AND CONTACTS NOTHING, so the exact bytes can
 * be reviewed before anyone authorises the real thing.
 *
 * <p><strong>Invocation:</strong>
 * {@code java -jar backend.jar daraz-price-stock-probe --daraz.channel-listing-id=<uuid> --daraz.dry-run=true}
 * then, only after review,
 * {@code java -jar backend.jar daraz-price-stock-probe --daraz.channel-listing-id=<uuid> --daraz.confirm-same-value-write=true}
 */
@Component
public class DarazPriceStockProbeRunner implements ApplicationRunner {

    /** The explicit, non-default argument that turns an ordinary start into the probe. */
    public static final String COMMAND = "daraz-price-stock-probe";

    /** ⚠ Named, not positional: a bare UUID on a command line is too easy to paste by mistake. */
    public static final String LISTING_ARGUMENT = "daraz.channel-listing-id";

    /** 🔴 THE SECOND GATE. Absent or not exactly {@code true}, nothing is sent. */
    public static final String CONFIRM_ARGUMENT = "daraz.confirm-same-value-write";

    /** ⚠ Prints the payload and contacts nothing. */
    public static final String DRY_RUN_ARGUMENT = "daraz.dry-run";

    private final DarazPriceStockProbe probe;
    private final ApplicationContext context;

    public DarazPriceStockProbeRunner(DarazPriceStockProbe probe, ApplicationContext context) {
        this.probe = probe;
        this.context = context;
    }

    /**
     * Whether this JVM was started as the write probe.
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
            UUID listingId = UUID.fromString(required(args, LISTING_ARGUMENT));

            if (flag(args, DRY_RUN_ARGUMENT)) {
                /* ⚠ NOTHING IS CONTACTED ON THIS PATH. The payload is built and printed, full stop. */
                System.out.println("Daraz price/stock probe — DRY RUN. Nothing was sent.");
                System.out.println("----------------------------------------------------------");
                System.out.println(probe.payloadFor(listingId));
                System.out.println("----------------------------------------------------------");
                System.out.println("Price and quantity above are the values Daraz itself last reported,");
                System.out.println("so sending them changes nothing. No promotion field is present.");
                System.exit(SpringApplication.exit(context, () -> 0));
                return;
            }

            /*
              🔴 THE SECOND GATE. A write must be authorised in its own words, not merely reached.
            */
            if (!flag(args, CONFIRM_ARGUMENT)) {
                System.out.println("Refused: this probe SENDS A WRITE to a live marketplace.");
                System.out.println("Re-run with --" + DRY_RUN_ARGUMENT + "=true to see the exact payload,");
                System.out.println("or with --" + CONFIRM_ARGUMENT + "=true to send it.");
                System.exit(SpringApplication.exit(context, () -> 2));
                return;
            }

            System.out.println("Daraz price/stock probe — one same-value write, nothing stored in Trioloo.");
            System.out.println("----------------------------------------------------------");
            for (String line : probe.probe(listingId)) {
                System.out.println(line);
            }
            System.out.println("----------------------------------------------------------");
            System.out.println("Outcome, provider code and envelope shape only. No listing value was printed.");
        } catch (DarazPriceStockProbe.ProbeRefusedException e) {
            System.out.println(e.getMessage());
            exitCode = 2;
        } catch (IllegalArgumentException e) {
            System.out.println("Refused: --" + LISTING_ARGUMENT + "=… must be a valid id.");
            exitCode = 2;
        } catch (Exception e) {
            /* 🔴 Never print the cause chain: it can carry a signed body or a connection string. */
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
            throw new DarazPriceStockProbe.ProbeRefusedException(
                    "Refused: --" + name + "=… is required.");
        }
        return values.getFirst();
    }
}
