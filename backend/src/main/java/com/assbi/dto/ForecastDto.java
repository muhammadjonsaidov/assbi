package com.assbi.dto;

public record ForecastDto(
    String forecastDate,
    long   predictedTotal,
    String trend,
    String method,
    String confidence,
    int    basedOnDays,
    long   historicalAvg
) {}