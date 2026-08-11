package com.trioloo.erp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Trioloo ERP backend entry point.
 *
 * <p>One deployable backend against one authoritative PostgreSQL database, with hard
 * internal module boundaries and no microservices in V1 ({@code TEC-002}).
 *
 * <p>Business modules are added under {@code com.trioloo.erp.<module>} in later bounded
 * steps, each with the four layers fixed by {@code PRJ-030}: {@code domain},
 * {@code application}, {@code infrastructure}, {@code api}. Dependency direction is
 * inward ({@code PRJ-021}) and {@code domain} imports no framework.
 *
 * <p>No business module exists yet. This is the application foundation only.
 */
@SpringBootApplication
public class TriolooErpApplication {

    public static void main(String[] args) {
        SpringApplication.run(TriolooErpApplication.class, args);
    }
}
