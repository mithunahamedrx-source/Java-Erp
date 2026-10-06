package com.trioloo.erp.notification.api;

import com.trioloo.erp.notification.application.NotificationQueryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The signed-in person's own notifications. 🔴 PRJ-031 - HTTP translation only; every rule lives in the service,
 * which binds each read and change to the actor's own recipient row. No permission code is coined (PRM-089.f): seeing
 * your own notifications needs only to be signed in, and each Ongoing Condition is gated by the permission that
 * governs its subject.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationQueryService service;

    public NotificationController(NotificationQueryService service) {
        this.service = service;
    }

    @GetMapping
    public List<NotificationQueryService.Item> list(@RequestParam(defaultValue = "false") boolean unreadOnly,
                                                    @RequestParam(defaultValue = "50") int limit) {
        return service.list(unreadOnly, limit);
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        List<NotificationQueryService.Condition> conditions = service.conditions();
        return Map.of("unread", service.unreadCount(), "conditions", conditions);
    }

    @GetMapping("/conditions")
    public List<NotificationQueryService.Condition> conditions() {
        return service.conditions();
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<Void> view(@PathVariable UUID id) {
        service.markViewed(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/view-all")
    public ResponseEntity<Void> viewAll() {
        service.markAllViewed();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/dismiss")
    public ResponseEntity<Void> dismiss(@PathVariable UUID id) {
        service.dismiss(id);
        return ResponseEntity.noContent().build();
    }
}
