package com.assbi.service;

import com.assbi.dto.CrossingEventRequest;
import com.assbi.dto.HourlySummaryDto;
import com.assbi.model.CrossingEvent;

import java.time.Instant;
import java.util.List;
import java.util.Map;


public interface ICrossingService {
    CrossingEvent save(CrossingEventRequest req);
    Map<String, Long> countsSince(Instant from, Instant to);
    List<HourlySummaryDto> hourlySummary(Instant from, Instant to);
}