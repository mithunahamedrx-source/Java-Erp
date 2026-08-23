package com.trioloo.erp.order.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.trioloo.erp.order.application.ChannelOrderQueryService;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;
import tools.jackson.databind.ObjectMapper;

/**
 * Locks the {@code TEC-015} wire contract on EVERY Orders response DTO.
 *
 * <p>🔴 This test exists because the rule was already broken here once. The Orders read-only
 * slice shipped with unannotated {@code BigDecimal} fields on {@code ChannelOrderRow},
 * {@code ChannelOrderDetail} and {@code ChannelOrderItemRow}, so every order amount crossed as
 * a bare JSON number and the browser parsed each one into an IEEE-754 double
 * ({@code TEC-015}, {@code DB-079}, {@code OSC-043}).
 *
 * <p>⚠ {@code MonetaryAmountSerializationTest} proves the annotation WORKS. It cannot prove the
 * annotation is PRESENT, and absence is the failure that actually occurred — silently, with no
 * error anywhere. This test walks the record components reflectively so a money field added
 * later without the annotation fails immediately rather than shipping.
 */
@JsonTest
@DisplayName("OSC-043 - every Orders monetary field crosses the API as a string")
class ChannelOrderMoneyWireContractTest {

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Every DTO the Orders endpoints return. A new one belongs in this list.
     *
     * <p>{@code Summary} carries {@code totalCollectable}; the other three carry the imported
     * order economics.
     */
    private static final List<Class<?>> ORDER_RESPONSE_RECORDS = List.of(
            ChannelOrderQueryService.Summary.class,
            ChannelOrderQueryService.ChannelOrderRow.class,
            ChannelOrderQueryService.ChannelOrderDetail.class,
            ChannelOrderQueryService.ChannelOrderItemRow.class);

    @Test
    @DisplayName("no BigDecimal field is left without @MonetaryAmount")
    void everyMonetaryFieldIsAnnotated() {
        List<String> unannotated = new ArrayList<>();
        for (Class<?> type : ORDER_RESPONSE_RECORDS) {
            for (RecordComponent component : type.getRecordComponents()) {
                if (component.getType() == BigDecimal.class
                        && component.getAnnotation(com.trioloo.erp.platform.money.MonetaryAmount.class) == null) {
                    unannotated.add(type.getSimpleName() + "." + component.getName());
                }
            }
        }

        assertThat(unannotated)
                .as("a BigDecimal on an Orders response DTO without @MonetaryAmount crosses as a "
                        + "JSON number, which TEC-015 prohibits")
                .isEmpty();
    }

    @Test
    @DisplayName("float and double never appear on an Orders response DTO")
    void noBinaryFloatingPointOnAnyOrdersDto() {
        List<String> forbidden = new ArrayList<>();
        for (Class<?> type : ORDER_RESPONSE_RECORDS) {
            for (RecordComponent component : type.getRecordComponents()) {
                Class<?> componentType = component.getType();
                if (componentType == float.class || componentType == double.class
                        || componentType == Float.class || componentType == Double.class) {
                    forbidden.add(type.getSimpleName() + "." + component.getName());
                }
            }
        }

        // PRJ-040 / TEC-010 - authoritative money is never float or double, DTOs included.
        assertThat(forbidden).isEmpty();
    }

    @Test
    @DisplayName("the collectable total serialises as a quoted exact decimal")
    void collectableTotalIsAQuotedString() {
        var summary = new ChannelOrderQueryService.Summary(
                4, 2, 1, new BigDecimal("842300.55"), 9, List.of(), List.of());

        String json = objectMapper.writeValueAsString(summary);

        assertThat(json).contains("\"totalCollectable\":\"842300.55\"");
        assertThat(json).doesNotContain("\"totalCollectable\":842300.55");

        // ⚠ The counts are genuine counts and stay JSON numbers. Only money is a string, and
        // stringifying a count would misstate what the rule is for.
        assertThat(json).contains("\"totalOrders\":4");
        assertThat(json).contains("\"todaysDispatched\":1");
    }

    @Test
    @DisplayName("trailing zeros survive - 2.50 never arrives as 2.5")
    void scaleIsPreserved() {
        var summary = new ChannelOrderQueryService.Summary(1, 1, 0, new BigDecimal("2.50"), 1, List.of(), List.of());

        assertThat(objectMapper.writeValueAsString(summary)).contains("\"totalCollectable\":\"2.50\"");
    }
}
