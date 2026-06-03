package com.assbi.service;

import com.assbi.model.DailySummary;
import com.assbi.repository.CrossingEventRepository;
import com.assbi.repository.DailySummaryRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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

    // ── Flexible chatbot context (any time range) ────────────────────────────

    public String buildFlexibleContext(Instant from, Instant to, String label) {
        StringBuilder sb = new StringBuilder();
        sb.append("TIME RANGE: ").append(label).append("\n");
        sb.append("FROM: ").append(from).append("\n");
        sb.append("TO:   ").append(to).append("\n\n");

        // Raw event counts — always accurate regardless of daily-summary lag
        List<Object[]> counts = eventRepo.countByTypeAndDirectionBetween(from, to);

        Map<String, Long> inMap  = new LinkedHashMap<>();
        Map<String, Long> outMap = new LinkedHashMap<>();
        long totalIn = 0, totalOut = 0;

        for (Object[] row : counts) {
            String type  = (String) row[0];
            String dir   = (String) row[1];
            long   count = ((Number) row[2]).longValue();
            if ("IN".equals(dir))  { inMap.put(type, count);  totalIn  += count; }
            else                   { outMap.put(type, count); totalOut += count; }
        }

        sb.append("TOTAL CROSSINGS IN:  ").append(totalIn).append("\n");
        sb.append("TOTAL CROSSINGS OUT: ").append(totalOut).append("\n\n");
        sb.append("BREAKDOWN BY OBJECT TYPE:\n");

        Set<String> types = new LinkedHashSet<>();
        types.addAll(inMap.keySet());
        types.addAll(outMap.keySet());

        if (types.isEmpty()) {
            sb.append("  (no crossing events recorded in this time range)\n");
        } else {
            for (String type : types) {
                sb.append("  ").append(type)
                  .append(": IN=").append(inMap.getOrDefault(type, 0L))
                  .append(", OUT=").append(outMap.getOrDefault(type, 0L))
                  .append("\n");
            }
        }

        long hours = Duration.between(from, to).toHours();

        // Short range (≤48h) → hourly breakdown from raw events
        if (hours <= 48) {
            List<Object[]> hourly = eventRepo.hourlyBreakdown(from, to);
            sb.append("\nHOURLY BREAKDOWN:\n");
            if (hourly.isEmpty()) {
                sb.append("  (no data)\n");
            } else {
                for (Object[] row : hourly) {
                    sb.append("  hour=").append(row[0])
                      .append(" type=").append(row[1])
                      .append(" direction=").append(row[2])
                      .append(" count=").append(row[3]).append("\n");
                }
            }
        }

        // Longer range (>24h) → daily breakdown from daily summaries
        if (hours > 24) {
            LocalDate fromDate = from.atZone(ZoneOffset.UTC).toLocalDate();
            LocalDate toDate   = to.atZone(ZoneOffset.UTC).toLocalDate();
            List<Object[]> daily = summaryRepo.aggregatedByDateAndType(fromDate, toDate);
            if (!daily.isEmpty()) {
                sb.append("\nDAILY BREAKDOWN:\n");
                for (Object[] row : daily) {
                    sb.append("  date=").append(row[0])
                      .append(" type=").append(row[1])
                      .append(" IN=").append(row[2])
                      .append(" OUT=").append(row[3]).append("\n");
                }
            }
        }

        return sb.toString();
    }
}
