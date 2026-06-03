package com.assbi.service;

import com.assbi.repository.DailySummaryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class ForecastService {

    private final DailySummaryRepository summaryRepo;

    public ForecastService(DailySummaryRepository summaryRepo) {
        this.summaryRepo = summaryRepo;
    }

    public Map<String, Object> forecast() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate from  = today.minusDays(7);
        LocalDate to    = today.minusDays(1);

        List<Object[]> rows = summaryRepo.aggregatedByDateAndType(from, to);

        // Aggregate daily totals across all object types
        Map<LocalDate, Long> dailyTotals = new LinkedHashMap<>();
        for (Object[] row : rows) {
            LocalDate date = (LocalDate) row[0];
            long in  = ((Number) row[2]).longValue();
            long out = ((Number) row[3]).longValue();
            dailyTotals.merge(date, in + out, Long::sum);
        }

        int n = dailyTotals.size();
        if (n == 0) {
            return buildResult(today, 0, "unknown", "insufficient-data", "low", 0, 0);
        }

        // Weighted moving average — newer days carry higher weight
        List<Long> values = new ArrayList<>(dailyTotals.values());
        double weightedSum = 0, totalWeight = 0;
        for (int i = 0; i < n; i++) {
            double w = i + 1;
            weightedSum += values.get(i) * w;
            totalWeight += w;
        }
        long predicted = Math.round(weightedSum / totalWeight);

        // Trend: compare newest 3 vs oldest 3 days
        String trend = "stable";
        if (n >= 4) {
            long recent = values.subList(n - Math.min(3, n), n).stream().mapToLong(Long::longValue).sum();
            long older  = values.subList(0, Math.min(3, n)).stream().mapToLong(Long::longValue).sum();
            if      (recent > older * 1.15) trend = "increasing";
            else if (recent < older * 0.85) trend = "decreasing";
        }

        long histAvg = Math.round(values.stream().mapToLong(Long::longValue).average().orElse(0));
        String confidence = n >= 5 ? "high" : n >= 3 ? "medium" : "low";

        return buildResult(today, predicted, trend, "weighted-moving-average", confidence, n, histAvg);
    }

    private Map<String, Object> buildResult(LocalDate today, long predicted, String trend,
                                             String method, String confidence, int days, long histAvg) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("forecastDate",   today.toString());
        m.put("predictedTotal", predicted);
        m.put("trend",          trend);
        m.put("method",         method);
        m.put("confidence",     confidence);
        m.put("basedOnDays",    days);
        m.put("historicalAvg",  histAvg);
        return m;
    }
}