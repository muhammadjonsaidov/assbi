package com.assbi.service;

import com.assbi.dto.AnomalyDto;
import com.assbi.repository.CrossingEventRepository;
import com.assbi.util.TimeUtils;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AnomalyService implements IAnomalyService {

    private final CrossingEventRepository eventRepo;

    public AnomalyService(CrossingEventRepository eventRepo) {
        this.eventRepo = eventRepo;
    }

    @Override
    public List<AnomalyDto> detectAnomalies() {
        Instant to   = Instant.now();
        Instant from = to.minus(24, ChronoUnit.HOURS);

        List<Object[]> rows = eventRepo.hourlyBreakdown(from, to);

        Map<String, Long> hourlyTotals = new LinkedHashMap<>();
        for (Object[] row : rows) {
            String hour = TimeUtils.toHourKey(row[0]);
            long   cnt  = ((Number) row[3]).longValue();
            hourlyTotals.merge(hour, cnt, Long::sum);
        }

        if (hourlyTotals.size() < 3) return List.of();

        List<Long> values = new ArrayList<>(hourlyTotals.values());
        double mean   = values.stream().mapToLong(Long::longValue).average().orElse(0);
        double stddev = Math.sqrt(
            values.stream().mapToDouble(c -> Math.pow(c - mean, 2)).average().orElse(0)
        );
        double threshold = mean + 2.0 * stddev;

        List<AnomalyDto> anomalies = new ArrayList<>();
        hourlyTotals.forEach((hour, count) -> {
            if (count > threshold && count > mean * 1.5) {
                String severity = count > mean + 3 * stddev ? "HIGH" : "MEDIUM";
                anomalies.add(new AnomalyDto(
                    hour, count,
                    Math.round(mean      * 10.0) / 10.0,
                    Math.round(threshold * 10.0) / 10.0,
                    severity
                ));
            }
        });
        return anomalies;
    }
}
