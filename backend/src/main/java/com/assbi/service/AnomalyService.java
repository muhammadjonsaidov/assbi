package com.assbi.service;

import com.assbi.repository.CrossingEventRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class AnomalyService {

    private final CrossingEventRepository eventRepo;

    public AnomalyService(CrossingEventRepository eventRepo) {
        this.eventRepo = eventRepo;
    }

    public List<Map<String, Object>> detectAnomalies() {
        Instant to   = Instant.now();
        Instant from = to.minus(24, ChronoUnit.HOURS);

        List<Object[]> rows = eventRepo.hourlyBreakdown(from, to);

        // Aggregate total crossings per hour
        Map<String, Long> hourlyTotals = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String hour = toHourKey(row[0]);
            long count  = ((Number) row[3]).longValue();
            hourlyTotals.merge(hour, count, Long::sum);
        }

        if (hourlyTotals.size() < 3) return List.of();

        // Mean and population stddev over the 24-hour window
        List<Long> values = new ArrayList<>(hourlyTotals.values());
        double mean = values.stream().mapToLong(Long::longValue).average().orElse(0);
        double stddev = Math.sqrt(
            values.stream().mapToDouble(c -> Math.pow(c - mean, 2)).average().orElse(0)
        );
        double threshold = mean + 2.0 * stddev;

        List<Map<String, Object>> anomalies = new ArrayList<>();
        hourlyTotals.forEach((hour, count) -> {
            if (count > threshold && count > mean * 1.5) {
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("hour",      hour);
                a.put("count",     count);
                a.put("mean",      Math.round(mean      * 10.0) / 10.0);
                a.put("threshold", Math.round(threshold * 10.0) / 10.0);
                a.put("severity",  count > mean + 3 * stddev ? "HIGH" : "MEDIUM");
                anomalies.add(a);
            }
        });

        return anomalies;
    }

    private String toHourKey(Object rawHour) {
        if (rawHour instanceof java.sql.Timestamp ts) {
            return ts.toInstant().truncatedTo(ChronoUnit.HOURS).toString();
        }
        return String.valueOf(rawHour);
    }
}