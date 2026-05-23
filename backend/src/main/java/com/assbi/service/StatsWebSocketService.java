package com.assbi.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@Service
public class StatsWebSocketService {

    private final SimpMessagingTemplate messaging;
    private final CrossingService crossingService;

    @Value("${assbi.stats.live-window-minutes:60}")
    private int liveWindowMinutes;

    public StatsWebSocketService(SimpMessagingTemplate messaging, CrossingService crossingService) {
        this.messaging = messaging;
        this.crossingService = crossingService;
    }

    @Scheduled(fixedRateString = "${assbi.stats.push-rate-ms:1000}")
    public void pushStats() {
        try {
            Instant to   = Instant.now();
            Instant from = to.minus(liveWindowMinutes, ChronoUnit.MINUTES);
            Map<String, Object> counts = crossingService.countsSince(from, to);
            messaging.convertAndSend("/topic/stats", counts);
        } catch (Exception ignored) {
        }
    }
}
