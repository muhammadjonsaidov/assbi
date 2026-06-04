package com.assbi.controller;

import com.assbi.dto.AnomalyDto;
import com.assbi.dto.CrossingEventRequest;
import com.assbi.dto.HourlySummaryDto;
import com.assbi.model.CrossingEvent;
import com.assbi.service.IAnomalyService;
import com.assbi.service.ICrossingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final ICrossingService crossingService;
    private final IAnomalyService  anomalyService;

    public EventController(ICrossingService crossingService, IAnomalyService anomalyService) {
        this.crossingService = crossingService;
        this.anomalyService  = anomalyService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> receive(@Valid @RequestBody CrossingEventRequest req) {
        CrossingEvent saved = crossingService.save(req);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "status", "saved"));
    }

    @GetMapping("/counts")
    public ResponseEntity<Map<String, Long>> counts(
            @RequestParam(defaultValue = "60") int minutes) {
        Instant to   = Instant.now();
        Instant from = to.minus(minutes, ChronoUnit.MINUTES);
        return ResponseEntity.ok(crossingService.countsSince(from, to));
    }

    @GetMapping("/hourly-summary")
    public ResponseEntity<List<HourlySummaryDto>> hourlySummary(
            @RequestParam(defaultValue = "24") int hours) {
        Instant to   = Instant.now();
        Instant from = to.minus(hours, ChronoUnit.HOURS);
        return ResponseEntity.ok(crossingService.hourlySummary(from, to));
    }

    @GetMapping("/anomalies")
    public ResponseEntity<List<AnomalyDto>> anomalies() {
        return ResponseEntity.ok(anomalyService.detectAnomalies());
    }
}
