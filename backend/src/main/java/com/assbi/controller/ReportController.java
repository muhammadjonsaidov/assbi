package com.assbi.controller;

import com.assbi.service.ForecastService;
import com.assbi.service.ReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService    reportService;
    private final ForecastService  forecastService;

    public ReportController(ReportService reportService, ForecastService forecastService) {
        this.reportService   = reportService;
        this.forecastService = forecastService;
    }

    @GetMapping("/weekly")
    public ResponseEntity<Map<String, Object>> weekly() {
        return ResponseEntity.ok(reportService.weeklyReport());
    }

    @GetMapping("/monthly")
    public ResponseEntity<Map<String, Object>> monthly() {
        return ResponseEntity.ok(reportService.monthlyReport());
    }

    @GetMapping("/custom")
    public ResponseEntity<Map<String, Object>> custom(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.customReport(from, to));
    }

    // Trigger manual summary rebuild (for testing/admin use)
    @PostMapping("/rebuild")
    public ResponseEntity<String> rebuild(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate target = date != null ? date : LocalDate.now().minusDays(1);
        reportService.rebuildSummaryForDate(target);
        return ResponseEntity.ok("Summary rebuilt for " + target);
    }

    // Weighted-moving-average forecast for tomorrow based on last 7 days
    @GetMapping("/forecast")
    public ResponseEntity<Map<String, Object>> forecast() {
        return ResponseEntity.ok(forecastService.forecast());
    }
}
