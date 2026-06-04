package com.assbi.service;

import com.assbi.dto.ReportDto;

import java.time.Instant;
import java.time.LocalDate;

public interface IReportService {
    ReportDto weeklyReport();
    ReportDto monthlyReport();
    ReportDto customReport(LocalDate from, LocalDate to);
    void rebuildSummaryForDate(LocalDate date);
    String buildFlexibleContext(Instant from, Instant to, String label);
}