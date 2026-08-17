package com.trioloo.erp.integration.infrastructure.daraz;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The SHAPE of a provider response — never its contents.
 *
 * <p>🔴 EVERY STRING IN HERE IS A FIELD NAME OR A NODE TYPE. No value from the response can reach
 * it, which is what makes the whole object safe to put in a log ({@code API-070.a}).
 *
 * <p>⚠ IT EXISTS BECAUSE THE DOCUMENTED SHAPE AND THE LIVE SHAPE DISAGREED. A live Bangladesh
 * seller returned {@code user_info} where the documentation only ever described
 * {@code country_user_info}, and nothing in the log could say what {@code user_info} contained.
 * Knowing the names one level down settles that without anyone printing a token.
 *
 * @param topLevelFields the response's own field names, in encounter order.
 * @param containers     for each allow-listed container: a description of its type and, one level
 *                       down, its field names. Example value: {@code OBJECT[seller_id,user_id]}.
 */
public record DarazResponseShape(List<String> topLevelFields, Map<String, String> containers) {

    /** For failures that happen before any response shape is known. */
    public static final DarazResponseShape UNKNOWN = new DarazResponseShape(List.of(), Map.of());

    public DarazResponseShape {
        topLevelFields = topLevelFields == null ? List.of() : List.copyOf(topLevelFields);
        containers = containers == null ? Map.of() : new LinkedHashMap<>(containers);
    }

    /**
     * Renders the containers for a log line, e.g.
     * {@code {user_info:OBJECT[seller_id,user_id], country_user_info:ABSENT, data:ABSENT}}.
     */
    public String describeContainers() {
        StringBuilder text = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> entry : containers.entrySet()) {
            if (!first) {
                text.append(", ");
            }
            text.append(entry.getKey()).append(':').append(entry.getValue());
            first = false;
        }
        return text.append('}').toString();
    }
}
