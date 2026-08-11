package com.trioloo.erp.platform.money;

import com.fasterxml.jackson.annotation.JacksonAnnotationsInside;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a {@link java.math.BigDecimal} DTO field as an authoritative monetary amount, and
 * forces it across the REST boundary as a JSON <em>string</em>.
 *
 * <p>This exists because of {@code TEC-015}, which the Technology Architecture calls
 * "the single most likely place for {@code DB-037} to be violated in practice":
 *
 * <blockquote>Jackson serialises {@code BigDecimal} as a JSON number by default;
 * JavaScript parses every JSON number as IEEE-754 double. A {@code 8,42,300.55} round-trip
 * through the React client would silently lose exactness.</blockquote>
 *
 * <p>Usage on a response DTO field:
 * <pre>
 *   public record OrderTotalResponse(&#64;MonetaryAmount BigDecimal saleAmount, String currency) {}
 * </pre>
 *
 * <p>Rules this participates in, all owned elsewhere and merely applied here:
 * <ul>
 *   <li>{@code PRJ-040} / {@code TEC-010} - authoritative money is never
 *       {@code float}, {@code double}, {@code Float} or {@code Double}, including DTOs,
 *       projections, test fixtures and mappers. The annotated type is always
 *       {@code BigDecimal}.</li>
 *   <li>{@code TEC-017} - currency travels with every monetary value. BDT is the only V1
 *       currency and the field is still not omitted.</li>
 *   <li>{@code TEC-095} - the client renders server-computed figures. Money arriving as a
 *       string is not arithmetic material on the client.</li>
 * </ul>
 *
 * <p>This annotation is deliberately <em>not</em> a Money domain object. No monetary domain
 * type is created at the foundation layer, because no frozen rule requires one here.
 * It carries no rounding behaviour either - the canonical BDT rounding policy is owned by
 * {@code DB-079} and applied at the calculation site ({@code TEC-011}, {@code PRJ-041}),
 * never by a transport annotation.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
//
// @JacksonAnnotationsInside is REQUIRED, not decorative. Without it Jackson treats this as
// an ordinary custom annotation and silently ignores the @JsonFormat inside it - the
// BigDecimal then goes out as a bare JSON number and TEC-015 is violated with no error
// anywhere. That failure was observed on this stack (Spring Boot 4.1.0 / Jackson 3.1.4)
// and is locked down by MonetaryAmountSerializationTest.
//
@JacksonAnnotationsInside
@JsonFormat(shape = JsonFormat.Shape.STRING)
public @interface MonetaryAmount {
}
