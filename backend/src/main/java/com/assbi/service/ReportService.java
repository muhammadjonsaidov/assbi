package com.assbi.service;

import com.assbi.model.DailySummary;
import com.assbi.repository.CrossingEventRepository;
import com.assbi.repository.DailySummaryRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ReportService {

    private final DailySummaryRepository summaryRepo;
    private final CrossingEventRepository eventRepo;

    public ReportService(DailySummaryRepository summaryRepo,
                         CrossingEventRepository eventRepo) {
        this.summaryRepo = summaryRepo;
        this.eventRepo = eventRepo;
    }

    // ── Nightly rebuild of daily summaries ──────────────────────────────────

    @Scheduled(cron = "0 0 1 * * *")  // 01:00 every night
    @Transactional
    public void rebuildYesterdaySummary() {
        rebuildSummaryForDate(LocalDate.now(ZoneOffset.UTC).minusDays(1));
    }

    @Transactional
    public void rebuildSummaryForDate(LocalDate date) {
        Instant from = date.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to   = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Object[]> rows = eventRepo.countByTypeAndDirectionBetween(from, to);

        for (Object[] row : rows) {
            String objectType = (String) row[0];
            String direction  = (String) row[1];
            long   count      = ((Number) row[2]).longValue();

            // We need per-source breakdown — simplified: use "all" as source
            DailySummary summary = summaryRepo
                .findBySummaryDateAndCameraSourceAndObjectType(date, "all", objectType)
                .orElseGet(() -> {
                    DailySummary s = new DailySummary();
                    s.setSummaryDate(date);
                    s.setCameraSource("all");
                    s.setObjectType(objectType);
                    s.setCountIn(0);
                    s.setCountOut(0);
                    return s;
                });

            if ("IN".equals(direction))  summary.setCountIn((int) count);
            if ("OUT".equals(direction)) summary.setCountOut((int) count);
            summaryRepo.save(summary);
        }
    }

    // ── Report queries ───────────────────────────────────────────────────────

    public Map<String, Object> weeklyReport() {
        LocalDate to   = LocalDate.now(ZoneOffset.UTC);
        LocalDate from = to.minusDays(7);
        return buildReport(from, to, "Last 7 days");
    }

    public Map<String, Object> monthlyReport() {
        LocalDate to   = LocalDate.now(ZoneOffset.UTC);
        LocalDate from = to.minusDays(30);
        return buildReport(from, to, "Last 30 days");
    }

    public Map<String, Object> customReport(LocalDate from, LocalDate to) {
        return buildReport(from, to, from + " to " + to);
    }

    private Map<String, Object> buildReport(LocalDate from, LocalDate to, String label) {
        List<Object[]> rows = summaryRepo.aggregatedByDateAndType(from, to);

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("period", label);
        report.put("from", from.toString());
        report.put("to", to.toString());

        Map<String, Map<String, Long>> byType = new LinkedHashMap<>();
        long grandIn = 0, grandOut = 0;

        for (Object[] row : rows) {
            String type = (String) row[1];
            long   in   = ((Number) row[2]).longValue();
            long   out  = ((Number) row[3]).longValue();

            byType.computeIfAbsent(type, k -> new LinkedHashMap<>())
                  .merge("in",  in,  Long::sum);
            byType.computeIfAbsent(type, k -> new LinkedHashMap<>())
                  .merge("out", out, Long::sum);

            grandIn  += in;
            grandOut += out;
        }

        report.put("by_type", byType);
        report.put("total_in", grandIn);
        report.put("total_out", grandOut);
        return report;
    }

    // ── Context string for chatbot ───────────────────────────────────────────

    public String buildChatbotContext(String period) {
        Map<String, Object> data = switch (period.toLowerCase()) {
            case "week", "weekly", "last week", "last 7 days" -> weeklyReport();
            case "month", "monthly", "last month", "last 30 days" -> monthlyReport();
            default -> weeklyReport();
        };

        StringBuilder sb = new StringBuilder();
        sb.append("Period: ").append(data.get("period")).append("\n");
        sb.append("Total IN: ").append(data.get("total_in")).append("\n");
        sb.append("Total OUT: ").append(data.get("total_out")).append("\n");

        @SuppressWarnings("unchecked")
        Map<String, Map<String, Long>> byType =
            (Map<String, Map<String, Long>>) data.get("by_type");

        if (byType != null) {
            byType.forEach((type, counts) ->
                sb.append(type).append(" -> IN: ")
                  .append(counts.getOrDefault("in", 0L))
                  .append(", OUT: ")
                  .append(counts.getOrDefault("out", 0L))
                  .append("\n")
            );
        }

        return sb.toString();
    }
}
