package com.assbi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CrossingEventRequest(

    @NotBlank
    String timestamp,       // ISO-8601

    @NotNull
    Integer trackId,

    @NotBlank
    String objectType,

    @NotNull
    Integer classId,

    @NotBlank
    @Pattern(regexp = "IN|OUT")
    String direction,

    Double positionX,
    Double positionY,

    @NotBlank
    String cameraSource,

    Double confidence
) {}
