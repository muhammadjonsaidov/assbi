package com.assbi.service;

import com.assbi.dto.CrossingEventRequest;
import com.assbi.model.CrossingEvent;
import com.assbi.repository.CrossingEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
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
}
