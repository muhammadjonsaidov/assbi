package com.assbi.controller;

import com.assbi.dto.ForecastDto;
import com.assbi.dto.ReportDto;
import com.assbi.service.IForecastService;
import com.assbi.service.IReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final IReportService   reportService;
    private final IForecastService forecastService;

    public ReportController(IReportService reportService, IForecastService forecastService) {
        this.reportService   = reportService;
        this.forecastService = forecastService;
    }

    @GetMapping("/weekly")
    public ResponseEntity<ReportDto> weekly() {
        return ResponseEntity.ok(reportService.weeklyReport());
    }

    @GetMapping("/monthly")
    public ResponseEntity<ReportDto> monthly() {
        return ResponseEntity.ok(reportService.monthlyReport());
    }

    @GetMapping("/custom")
    public ResponseEntity<ReportDto> custom(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.customReport(from, to));
    }

    @PostMapping("/rebuild")
    public ResponseEntity<String> rebuild(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate target = date != null ? date : LocalDate.now().minusDays(1);
        reportService.rebuildSummaryForDate(target);
        return ResponseEntity.ok("rebuilt for " + target);
    }

    @GetMapping("/forecast")
    public ResponseEntity<ForecastDto> forecast() {
        return ResponseEntity.ok(forecastService.forecast());
    }
}
