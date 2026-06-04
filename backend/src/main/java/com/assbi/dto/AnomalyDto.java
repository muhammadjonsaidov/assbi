package com.assbi.dto;

public record AnomalyDto(
    String hour,
    long   count,
    double mean,
    double threshold,
    String severity
) {}