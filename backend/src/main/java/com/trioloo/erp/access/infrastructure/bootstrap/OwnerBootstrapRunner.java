package com.trioloo.erp.access.infrastructure.bootstrap;

import com.trioloo.erp.access.application.OwnerBootstrapService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.Console;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * The one-time, server-side first-Owner bootstrap command ({@code GAP-120}).
 *
 * <p>🔴 IT IS NOT AN HTTP ENDPOINT, AND THERE IS NO ROUTE THAT REACHES IT. Invocation
 * requires shell access to the production host — which is the whole security model. A public
 * {@code /setup} or {@code /bootstrap} route would let the internet create a privileged
 * account, and none exists anywhere in this application.
 *
 * <p>🔴 ORDINARY STARTUP CREATES NOBODY. Without the explicit argument this runner returns
 * immediately, so {@code java -jar backend.jar} can never bootstrap an Owner as a side
 * effect. Zero Owners stays zero until an operator asks for otherwise, deliberately.
 *
 * <p>🔴 THE PASSWORD IS READ INTERACTIVELY AND NEVER FROM ARGUMENTS OR THE ENVIRONMENT. A
 * command-line password lands in the shell history and in the process list where any local
 * user can read it; an environment variable persists in the service configuration. Neither
 * is acceptable for the highest authority in the system.
 *
 * <p><strong>Invocation:</strong>
 * {@code java -jar backend.jar bootstrap-owner --owner.username=… --owner.full-name=…}
 */
@Component
public class OwnerBootstrapRunner implements ApplicationRunner {

    /** The explicit, non-default argument that turns an ordinary start into the command. */
    public static final String COMMAND = "bootstrap-owner";

    private final OwnerBootstrapService bootstrap;
    private final ApplicationContext context;

    public OwnerBootstrapRunner(OwnerBootstrapService bootstrap, ApplicationContext context) {
        this.bootstrap = bootstrap;
        this.context = context;
    }

    /**
     * Whether this JVM was started as the bootstrap command.
     *
     * <p>⚠ Also consulted by {@code TriolooErpApplication} so the command runs with NO web
     * server — otherwise it would try to bind 8080 and collide with the running service.
     */
    public static boolean isBootstrapInvocation(String[] args) {
        return args != null && Arrays.asList(args).contains(COMMAND);
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!args.getNonOptionArgs().contains(COMMAND)) {
            // 🔴 An ordinary start. Create nothing, say nothing, change nothing.
            return;
        }

        int exitCode = 0;
        try {
            String username = required(args, "owner.username");
            String fullName = required(args, "owner.full-name");
            char[] password = readPassword();
            try {
                UUID id = bootstrap.bootstrapFirstOwner(username, fullName, password);
                System.out.println("Initial Owner created. Profile id: " + id);
                System.out.println("Lifecycle: INVITED — it becomes ACTIVE on the first successful sign-in.");
            } finally {
                /* ⚠ Clear the plaintext from memory as soon as it has been hashed. */
                if (password != null) {
                    Arrays.fill(password, '\0');
                }
            }
        } catch (OwnerBootstrapService.BootstrapRefusedException e) {
            System.out.println(e.getMessage());
            exitCode = 2;
        } catch (Exception e) {
            /* 🔴 Never print the cause chain: it can carry connection strings. */
            System.out.println("Bootstrap failed: " + e.getClass().getSimpleName());
            exitCode = 1;
        }
        final int status = exitCode;
        System.exit(SpringApplication.exit(context, () -> status));
    }

    private static String required(ApplicationArguments args, String name) {
        List<String> values = args.getOptionValues(name);
        if (values == null || values.isEmpty() || values.getFirst() == null || values.getFirst().isBlank()) {
            throw new OwnerBootstrapService.BootstrapRefusedException(
                    "Bootstrap refused: --" + name + "=… is required.");
        }
        return values.getFirst();
    }

    /**
     * Reads the password from the terminal without echoing it.
     *
     * <p>🔴 {@link Console#readPassword} is preferred precisely because it does not echo.
     * ⚠ Where no console is attached the value is read from standard input instead, so the
     * command remains usable in a non-TTY session; it is still never taken from an argument
     * or an environment variable.
     */
    private static char[] readPassword() {
        Console console = System.console();
        if (console != null) {
            char[] first = console.readPassword("New Owner password (input hidden): ");
            char[] again = console.readPassword("Confirm password: ");
            if (first == null || again == null || !Arrays.equals(first, again)) {
                if (again != null) {
                    Arrays.fill(again, '\0');
                }
                if (first != null) {
                    Arrays.fill(first, '\0');
                }
                throw new OwnerBootstrapService.BootstrapRefusedException(
                        "Bootstrap refused: the two passwords did not match.");
            }
            Arrays.fill(again, '\0');
            return first;
        }
        try {
            System.out.println("No terminal available; reading the password from standard input.");
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(System.in, StandardCharsets.UTF_8));
            String line = reader.readLine();
            if (line == null || line.isBlank()) {
                throw new OwnerBootstrapService.BootstrapRefusedException(
                        "Bootstrap refused: a password is required.");
            }
            return line.toCharArray();
        } catch (java.io.IOException e) {
            throw new OwnerBootstrapService.BootstrapRefusedException(
                    "Bootstrap refused: the password could not be read.");
        }
    }
}
