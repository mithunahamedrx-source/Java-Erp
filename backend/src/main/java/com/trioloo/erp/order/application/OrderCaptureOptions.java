package com.trioloo.erp.order.application;

import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * The lists the New order form chooses from: shops and users.
 *
 * <p>🔴 GATED BY `order.order.create`, the permission of the form itself ({@code PRM-004}), so a person
 * who may create an order can pick a shop and a salesperson without also holding the admin rights to list
 * every user. ⚠ Only what the form needs is returned — id and display name — never a login, email or role.
 *
 * <p>✅ SHOPS ARE LISTED FROM THE REGISTER, NOT FROM ORDERS. The earlier source (the order summary) only
 * knew shops that already had an order, so a new shop could never take its first manual order.
 * {@code ARCHIVED} shops are excluded; a {@code DRAFT} shop is offered because a direct order is not a
 * marketplace pull ({@code BR-181} governs ingestion only).
 */
@Service
public class OrderCaptureOptions {

    private final JdbcTemplate jdbc;

    public OrderCaptureOptions(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Options read() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = auth != null && auth.getAuthorities().stream()
                .anyMatch(g -> OrderPermissions.ORDER_CREATE.equals(g.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedByPermissionException(OrderPermissions.ORDER_CREATE);
        }
        List<Shop> shops = jdbc.query("""
                SELECT id, code, name, channel_type FROM channel_instance
                 WHERE record_status <> 'ARCHIVED' ORDER BY name ASC, code ASC
                """, (rs, n) -> new Shop((UUID) rs.getObject("id"), rs.getString("code"),
                rs.getString("name"), rs.getString("channel_type")));
        List<User> users = jdbc.query("""
                SELECT id, full_name FROM operational_user_profile
                 WHERE lifecycle_state = 'ACTIVE' ORDER BY full_name ASC
                """, (rs, n) -> new User((UUID) rs.getObject("id"), rs.getString("full_name")));
        return new Options(shops, users);
    }

    public record Shop(UUID id, String code, String name, String channelType) {
    }

    public record User(UUID id, String fullName) {
    }

    public record Options(List<Shop> shops, List<User> users) {
    }
}
