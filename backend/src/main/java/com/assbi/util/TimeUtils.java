package com.assbi.util;

import java.time.temporal.ChronoUnit;

public final class TimeUtils {

    private TimeUtils() {}

    /** Convert a raw JDBC hourly timestamp (Timestamp or String) to ISO-8601 hour string. */
    public static String toHourKey(Object rawHour) {
        if (rawHour instanceof java.sql.Timestamp ts) {
            return ts.toInstant().truncatedTo(ChronoUnit.HOURS).toString();
        }
        return String.valueOf(rawHour);
    }
}