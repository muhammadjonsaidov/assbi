package com.assbi.service;

import com.assbi.dto.ReportDto;
import com.assbi.dto.ReportDto.TypeCounts;
import com.assbi.repository.CrossingEventRepository;
import com.assbi.repository.DailySummaryRepository;
import com.assbi.util.TimeUtils;
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
public class ReportService implements IReportService {

    private final DailySummaryRepository summaryRepo;
    private final CrossingEventRepository eventRepo;

    public ReportService(DailySummaryRepository summaryRepo, CrossingEventRepository eventRepo) {
        this.summaryRepo = summaryRepo;
        this.eventRepo   = eventRepo;
    }

    // ── Nightly rebuild ──────────────────────────────────────────────────────────

    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void rebuildYesterdaySummary() {
        rebuildSummaryForDate(LocalDate.now(ZoneOffset.UTC).minusDays(1));
    }

    @Override
    @Transactional
    public void rebuildSummaryForDate(LocalDate date) {
        Instant from = date.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to   = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<Object[]> rows = eventRepo.countByTypeAndDirectionBetween(from, to);

        for (Object[] row : rows) {
            String objectType = (String) row[0];
            String direction  = (String) row[1];
            long   count      = ((Number) row[2]).longValue();

            var summary = summaryRepo
                .findBySummaryDateAndCameraSourceAndObjectType(date, "all", objectType)
                .orElseGet(() -> {
                    var s = new com.assbi.model.DailySummary();
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

    // ── Report queries ───────────────────────────────────────────────────────────

    @Override
    public ReportDto weeklyReport() {
        LocalDate to   = LocalDate.now(ZoneOffset.UTC);
        return buildReport(to.minusDays(7), to, "Last 7 days");
    }

    @Override
    public ReportDto monthlyReport() {
        LocalDate to   = LocalDate.now(ZoneOffset.UTC);
        return buildReport(to.minusDays(30), to, "Last 30 days");
    }

    @Override
    public ReportDto customReport(LocalDate from, LocalDate to) {
        return buildReport(from, to, from + " to " + to);
    }

    private ReportDto buildReport(LocalDate from, LocalDate to, String label) {
        List<Object[]> rows = summaryRepo.aggregatedByDateAndType(from, to);
        Map<String, long[]> tmp = new LinkedHashMap<>(); // type → [in, out]
        long grandIn = 0, grandOut = 0;

        for (Object[] row : rows) {
            String type = (String) row[1];
            long   in   = ((Number) row[2]).longValue();
            long   out  = ((Number) row[3]).longValue();
            tmp.computeIfAbsent(type, k -> new long[2]);
            tmp.get(type)[0] += in;
            tmp.get(type)[1] += out;
            grandIn  += in;
            grandOut += out;
        }

        Map<String, TypeCounts> byType = new LinkedHashMap<>();
        tmp.forEach((type, arr) -> byType.put(type, new TypeCounts(arr[0], arr[1])));

        return new ReportDto(label, from.toString(), to.toString(), byType, grandIn, grandOut);
    }

    // ── Flexible chatbot context ─────────────────────────────────────────────────

    @Override
    public String buildFlexibleContext(Instant from, Instant to, String label) {
        StringBuilder sb = new StringBuilder();
        sb.append("TIME RANGE: ").append(label).append("\n");
        sb.append("FROM: ").append(from).append("\n");
        sb.append("TO:   ").append(to).append("\n\n");

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
            sb.append("  (no crossing events in this time range)\n");
        } else {
            for (String type : types) {
                sb.append("  ").append(type)
                  .append(": IN=").append(inMap.getOrDefault(type, 0L))
                  .append(", OUT=").append(outMap.getOrDefault(type, 0L))
                  .append("\n");
            }
        }

        long hours = Duration.between(from, to).toHours();

        if (hours <= 48) {
            List<Object[]> hourly = eventRepo.hourlyBreakdown(from, to);
            sb.append("\nHOURLY BREAKDOWN:\n");
            if (hourly.isEmpty()) {
                sb.append("  (no data)\n");
            } else {
                for (Object[] row : hourly) {
                    sb.append("  hour=").append(TimeUtils.toHourKey(row[0]))
                      .append(" type=").append(row[1])
                      .append(" dir=").append(row[2])
                      .append(" count=").append(row[3]).append("\n");
                }
            }
        }

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
