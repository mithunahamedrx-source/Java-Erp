package com.trioloo.erp.platform.time;

import jakarta.annotation.PostConstruct;
import java.time.Clock;
import java.time.ZoneId;
import java.util.TimeZone;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Canonical business timezone.
 *
 * <p>{@code TEC-050} fixes {@code Asia/Dhaka} as the canonical business timezone.
 *
 * <p>{@code TEC-052} is the rule this class exists to protect: a business date is never
 * derived from an instant without applying {@code Asia/Dhaka}. A UTC-truncated timestamp
 * near midnight lands attendance, orders and payroll on the wrong day.
 *
 * <p>The {@link Clock} bean is published so that later modules derive business dates from
 * an injected, zone-correct clock rather than from {@code LocalDate.now()}, which silently
 * reads the host's zone.
 *
 * <p>This is technical platform code. It carries no business concept ({@code PRJ-023}).
 */
@Configuration
public class TimeZoneConfiguration {

    /** Canonical business timezone ({@code TEC-050}). */
    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Dhaka");

    /**
     * Aligns the JVM default with the canonical business timezone so that any code path
     * that has not yet been given an explicit zone still resolves to {@code Asia/Dhaka}
     * rather than the host's zone.
     *
     * <p>This is a safety net, not a licence: {@code TEC-052} still requires the zone to be
     * applied explicitly when converting an instant to a business date.
     */
    @PostConstruct
    void applyCanonicalDefaultZone() {
        TimeZone.setDefault(TimeZone.getTimeZone(BUSINESS_ZONE));
    }

    /**
     * The clock every module uses to obtain "now".
     *
     * <p>Instants keep INSTANT semantics ({@code TEC-051}); business dates are derived from
     * this clock so the zone is always applied ({@code TEC-052}).
     */
    @Bean
    public Clock businessClock() {
        return Clock.system(BUSINESS_ZONE);
    }
}
