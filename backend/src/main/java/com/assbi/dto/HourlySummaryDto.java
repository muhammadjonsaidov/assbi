package com.assbi.dto;

public record HourlySummaryDto(
    String hour,
    long carIn,
    long carOut,
    long motorcycleIn,
    long motorcycleOut,
    long busIn,
    long busOut,
    long truckIn,
    long truckOut,
    long total
) {}