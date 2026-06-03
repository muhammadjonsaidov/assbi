package com.assbi.controller;

import com.assbi.dto.CrossingEventRequest;
import com.assbi.model.CrossingEvent;
import com.assbi.service.AnomalyService;
import com.assbi.service.CrossingService;
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

    private final CrossingService crossingService;
    private final AnomalyService  anomalyService;

    public EventController(CrossingService crossingService, AnomalyService anomalyService) {
        this.crossingService = crossingService;
        this.anomalyService  = anomalyService;
    }

    // Python detection worker POSTs here on each crossing
    @PostMapping
    public ResponseEntity<Map<String, Object>> receive(
            @Valid @RequestBody CrossingEventRequest req) {
        CrossingEvent saved = crossingService.save(req);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "status", "saved"));
    }

    // Recent 50 events — for live dashboard polling
    @GetMapping("/recent")
    public ResponseEntity<List<CrossingEvent>> recent() {
        return ResponseEntity.ok(crossingService.recent());
    }

    // Counts for last N minutes — for Swing UI live stats panel
    @GetMapping("/counts")
    public ResponseEntity<Map<String, Object>> counts(
            @RequestParam(defaultValue = "${assbi.stats.live-window-minutes:60}") int minutes) {
        Instant to   = Instant.now();
        Instant from = to.minus(minutes, ChronoUnit.MINUTES);
        return ResponseEntity.ok(crossingService.countsSince(from, to));
    }

    // Hourly breakdown for a range
    @GetMapping("/hourly")
    public ResponseEntity<List<Object[]>> hourly(
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(
            crossingService.hourlyBreakdown(Instant.parse(from), Instant.parse(to))
        );
    }

    // Clean hourly summary for last N hours — used by Analytics dashboard chart
    @GetMapping("/hourly-summary")
    public ResponseEntity<List<Map<String, Object>>> hourlySummary(
            @RequestParam(defaultValue = "24") int hours) {
        Instant to   = Instant.now();
        Instant from = to.minus(hours, ChronoUnit.HOURS);
        return ResponseEntity.ok(crossingService.hourlySummary(from, to));
    }

    // Anomaly detection — flags hours with unusual crossing counts (mean + 2σ)
    @GetMapping("/anomalies")
    public ResponseEntity<List<Map<String, Object>>> anomalies() {
        return ResponseEntity.ok(anomalyService.detectAnomalies());
    }
}
