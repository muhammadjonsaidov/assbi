package com.assbi.service;

import com.assbi.repository.CrossingEventRepository;
import com.assbi.repository.DailySummaryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

@Service
public class DataRetentionService {

    private static final Logger log = LoggerFactory.getLogger(DataRetentionService.class);

    @Value("${assbi.data-retention.days:90}")
    private int retentionDays;

    private final CrossingEventRepository eventRepo;
    private final DailySummaryRepository  summaryRepo;

    public DataRetentionService(CrossingEventRepository eventRepo,
                                DailySummaryRepository summaryRepo) {
        this.eventRepo   = eventRepo;
        this.summaryRepo = summaryRepo;
    }

    // Runs at 02:00 UTC daily — after ReportService rebuilds yesterday's summary at 01:00
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void purge() {
        Instant eventCutoff   = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        LocalDate summaryCutoff = LocalDate.now(ZoneOffset.UTC).minusDays(retentionDays);

        int events    = eventRepo.deleteOlderThan(eventCutoff);
        int summaries = summaryRepo.deleteOlderThan(summaryCutoff);

        log.info("Retention purge: deleted {} crossing_events and {} daily_summaries older than {} days",
                 events, summaries, retentionDays);
    }
}
