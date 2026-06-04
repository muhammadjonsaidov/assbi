package com.assbi.dto;

public record HourlySummaryDto(
    String hour,
    long personIn,
    long personOut,
    long vehicleIn,
    long vehicleOut,
    long total
) {}