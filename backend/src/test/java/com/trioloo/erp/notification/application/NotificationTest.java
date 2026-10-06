package com.trioloo.erp.notification.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.order.application.OrderPermissions;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Notification, first slice — recipients by capability, generated once, per-recipient engagement, isolation.
 *
 * <p>🔴 Isolated test database only; every record a test needs, that test creates.
 */
@SpringBootTest
class NotificationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private NotificationEmitter emitter;
    @Autowired private NotificationQueryService queries;

    private AccessFixtures fixtures;
    private UUID holder;
    private UUID outsider;
    private UUID revoked;
    private UUID owner;

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        jdbc.update("DELETE FROM notification");
        fixtures.clear();

        UUID permission = fixtures.createPermission(OrderPermissions.CHANNEL_ORDER_VIEW);
        UUID role = fixtures.createRole("order-viewer");
        fixtures.grantPermissionToRole(role, permission);

        holder = fixtures.createProfile("n-holder", "x", AccountLifecycleState.ACTIVE);
        fixtures.assignRole(holder, role);
        outsider = fixtures.createProfile("n-outsider", "x", AccountLifecycleState.ACTIVE);
        revoked = fixtures.createProfile("n-revoked", "x", AccountLifecycleState.ACTIVE);
        fixtures.assignRole(revoked, role);
        fixtures.addOverride(revoked, permission, "REVOKE", holder);
        owner = fixtures.createProfile("n-owner", "x", AccountLifecycleState.ACTIVE);
        jdbc.update("""
                UPDATE operational_user_profile
                   SET owner_designated_at = now(), owner_designation_origin = 'INITIAL_BOOTSTRAP' WHERE id = ?
                """, owner);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        jdbc.update("DELETE FROM notification");
    }

    private void actingAs(UUID actor, String... permissions) {
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actor, "n-user", "N User", "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var authorities = Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal, null, authorities));
    }

    private int countFor(UUID person) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM notification_recipient WHERE recipient_id = ?", Integer.class, person);
        return n == null ? 0 : n;
    }

    @Test
    @DisplayName("A new order reaches the people who hold the capability and the Owner — never an outsider or a revoked holder")
    void recipientsFollowEffectiveAuthority() {
        emitter.newOrder(UUID.randomUUID(), UUID.randomUUID(), "TR0001", Instant.now());

        assertThat(countFor(holder)).isEqualTo(1);
        assertThat(countFor(owner)).isEqualTo(1);
        assertThat(countFor(outsider)).isZero();
        assertThat(countFor(revoked)).isZero();
        // NOT-017 - each in-app delivery is an attempt row of its own.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notification_delivery WHERE outcome = 'SUCCEEDED'", Integer.class)).isEqualTo(2);
    }

    @Test
    @DisplayName("One event generates its notification ONCE, however many times it is raised")
    void generatedOnce() {
        UUID order = UUID.randomUUID();
        emitter.newOrder(order, UUID.randomUUID(), "TR0002", Instant.now());
        emitter.newOrder(order, UUID.randomUUID(), "TR0002", Instant.now());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notification", Integer.class)).isEqualTo(1);
        assertThat(countFor(holder)).isEqualTo(1);
    }

    @Test
    @DisplayName("An order old enough to be backfill is not news")
    void backfillIsSilent() {
        emitter.newOrder(UUID.randomUUID(), UUID.randomUUID(), "TR0003", Instant.now().minus(10, ChronoUnit.DAYS));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notification", Integer.class)).isZero();
    }

    @Test
    @DisplayName("A shipment problem notifies once per order and state")
    void shipmentProblemOncePerState() {
        UUID order = UUID.randomUUID();
        emitter.shipmentProblem(NotificationType.DELIVERY_FAILED, order, "DELIVERY_ATTEMPTED");
        emitter.shipmentProblem(NotificationType.DELIVERY_FAILED, order, "DELIVERY_ATTEMPTED");
        emitter.shipmentProblem(NotificationType.RETURN_ARRIVED, order, "RETURNING");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notification", Integer.class)).isEqualTo(2);
    }

    @Test
    @DisplayName("Engagement is per recipient: viewing and dismissing affect only the person who did it")
    void engagementIsPerRecipient() {
        emitter.newOrder(UUID.randomUUID(), UUID.randomUUID(), "TR0004", Instant.now());

        actingAs(holder);
        assertThat(queries.unreadCount()).isEqualTo(1);
        UUID id = queries.list(false, 10).getFirst().id();
        queries.markViewed(id);
        assertThat(queries.unreadCount()).isZero();

        // The Owner still has it unread, and the holder dismissing it hides it only for the holder.
        queries.dismiss(id);
        assertThat(queries.list(false, 10)).isEmpty();
        actingAs(owner);
        assertThat(queries.unreadCount()).isEqualTo(1);
        assertThat(queries.list(false, 10)).hasSize(1);

        // A person who was never a recipient can neither read nor dismiss it.
        actingAs(outsider);
        assertThat(queries.list(false, 10)).isEmpty();
        queries.dismiss(id);
        actingAs(owner);
        assertThat(queries.list(false, 10)).hasSize(1);
    }

    @Test
    @DisplayName("Ongoing Conditions appear only to someone who may act on their subject")
    void conditionsAreGatedByCapability() {
        actingAs(outsider);
        assertThat(queries.conditions()).isEmpty();
        actingAs(holder, OrderPermissions.CHANNEL_ORDER_VIEW);
        assertThat(queries.conditions()).isEmpty(); // nothing is on hold or failed in an empty database
    }
}
