package com.assbi.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

public record ReportDto(
    String period,
    String from,
    String to,
    @JsonProperty("by_type")    Map<String, TypeCounts> byType,
    @JsonProperty("total_in")   long totalIn,
    @JsonProperty("total_out")  long totalOut
) {
    public record TypeCounts(long in, long out) {}
}