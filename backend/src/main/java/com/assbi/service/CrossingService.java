package com.assbi.service;

import com.assbi.dto.CrossingEventRequest;
import com.assbi.model.CrossingEvent;
import com.assbi.repository.CrossingEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class CrossingService {

    private final CrossingEventRepository repo;

    public CrossingService(CrossingEventRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public CrossingEvent save(CrossingEventRequest req) {
        CrossingEvent event = new CrossingEvent(
            Instant.parse(req.timestamp()),
            req.trackId(),
            req.objectType(),
            req.classId(),
            req.direction(),
            req.positionX() != null ? BigDecimal.valueOf(req.positionX()) : null,
            req.positionY() != null ? BigDecimal.valueOf(req.positionY()) : null,
            req.cameraSource(),
            req.confidence() != null ? BigDecimal.valueOf(req.confidence()) : null
        );
        return repo.save(event);
    }

    public List<CrossingEvent> recent() {
        return repo.findTop50ByOrderByTimestampDesc();
    }

    public Map<String, Object> countsSince(Instant from, Instant to) {
        List<Object[]> rows = repo.countByTypeAndDirectionBetween(from, to);
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        for (Object[] row : rows) {
            String key = row[0] + "_" + row[1]; // e.g. "person_IN"
            result.put(key, ((Number) row[2]).longValue());
        }
        return result;
    }

    public List<Object[]> hourlyBreakdown(Instant from, Instant to) {
        return repo.hourlyBreakdown(from, to);
    }

    private static final List<String> VEHICLE_TYPES = List.of("car", "truck", "bus", "motorcycle");

    public List<Map<String, Object>> hourlySummary(Instant from, Instant to) {
        List<Object[]> rows = repo.hourlyBreakdown(from, to);
        // row[0]=hour(Timestamp), row[1]=object_type, row[2]=direction, row[3]=count
        java.util.Map<String, Map<String, Long>> byHour = new java.util.LinkedHashMap<>();
        for (Object[] row : rows) {
            String hour = toHourKey(row[0]);
            String key  = row[1] + "_" + row[2];
            long count  = ((Number) row[3]).longValue();
            byHour.computeIfAbsent(hour, k -> new java.util.LinkedHashMap<>())
                  .merge(key, count, Long::sum);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        byHour.forEach((hour, counts) -> {
            long vehicleIn  = VEHICLE_TYPES.stream().mapToLong(t -> counts.getOrDefault(t + "_IN",  0L)).sum();
            long vehicleOut = VEHICLE_TYPES.stream().mapToLong(t -> counts.getOrDefault(t + "_OUT", 0L)).sum();
            long total      = counts.values().stream().mapToLong(Long::longValue).sum();
            Map<String, Object> entry = new java.util.LinkedHashMap<>();
            entry.put("hour",       hour);
            entry.put("personIn",   counts.getOrDefault("person_IN",  0L));
            entry.put("personOut",  counts.getOrDefault("person_OUT", 0L));
            entry.put("vehicleIn",  vehicleIn);
            entry.put("vehicleOut", vehicleOut);
            entry.put("total",      total);
            result.add(entry);
        });
        return result;
    }

    private String toHourKey(Object rawHour) {
        if (rawHour instanceof java.sql.Timestamp ts) {
            return ts.toInstant().truncatedTo(ChronoUnit.HOURS).toString();
        }
        return String.valueOf(rawHour);
    }
}
