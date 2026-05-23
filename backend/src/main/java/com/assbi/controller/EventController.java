package com.assbi.controller;

import com.assbi.dto.CrossingEventRequest;
import com.assbi.model.CrossingEvent;
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
@CrossOrigin(origins = "*")
public class EventController {

    private final CrossingService crossingService;

    public EventController(CrossingService crossingService) {
        this.crossingService = crossingService;
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
}
