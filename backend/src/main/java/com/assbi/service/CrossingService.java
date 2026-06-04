package com.assbi.service;

import com.assbi.dto.CrossingEventRequest;
import com.assbi.dto.HourlySummaryDto;
import com.assbi.model.CrossingEvent;
import com.assbi.repository.CrossingEventRepository;
import com.assbi.util.TimeUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;


@Service
public class CrossingService implements ICrossingService {

    private static final List<String> VEHICLE_TYPES = List.of("car", "truck", "bus", "motorcycle");

    private final CrossingEventRepository repo;

    public CrossingService(CrossingEventRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional
    public CrossingEvent save(CrossingEventRequest req) {
        return repo.save(new CrossingEvent(
            Instant.parse(req.timestamp()),
            req.trackId(),
            req.objectType(),
            req.direction(),
            req.positionX()  != null ? BigDecimal.valueOf(req.positionX())  : null,
            req.positionY()  != null ? BigDecimal.valueOf(req.positionY())  : null,
            req.cameraSource(),
            req.confidence() != null ? BigDecimal.valueOf(req.confidence()) : null
        ));
    }

    @Override
    public Map<String, Long> countsSince(Instant from, Instant to) {
        List<Object[]> rows = repo.countByTypeAndDirectionBetween(from, to);
        Map<String, Long> result = new LinkedHashMap<>();
        for (Object[] row : rows) {
            result.put(row[0] + "_" + row[1], ((Number) row[2]).longValue());
        }
        return result;
    }

    @Override
    public List<HourlySummaryDto> hourlySummary(Instant from, Instant to) {
        List<Object[]> rows = repo.hourlyBreakdown(from, to);
        Map<String, Map<String, Long>> byHour = new LinkedHashMap<>();

        for (Object[] row : rows) {
            String hour = TimeUtils.toHourKey(row[0]);
            String key  = row[1] + "_" + row[2];
            long count  = ((Number) row[3]).longValue();
            byHour.computeIfAbsent(hour, k -> new LinkedHashMap<>())
                  .merge(key, count, Long::sum);
        }

        List<HourlySummaryDto> result = new ArrayList<>();
        byHour.forEach((hour, counts) -> {
            long vehicleIn  = VEHICLE_TYPES.stream().mapToLong(t -> counts.getOrDefault(t + "_IN",  0L)).sum();
            long vehicleOut = VEHICLE_TYPES.stream().mapToLong(t -> counts.getOrDefault(t + "_OUT", 0L)).sum();
            long total      = counts.values().stream().mapToLong(Long::longValue).sum();
            result.add(new HourlySummaryDto(
                hour,
                counts.getOrDefault("person_IN",  0L),
                counts.getOrDefault("person_OUT", 0L),
                vehicleIn,
                vehicleOut,
                total
            ));
        });
        return result;
    }
}
