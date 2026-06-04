package com.assbi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CrossingEventRequest(

    @NotBlank
    String timestamp,

    @NotNull
    Integer trackId,

    @NotBlank
    String objectType,

    @NotBlank
    @Pattern(regexp = "IN|OUT", message = "must be IN or OUT")
    String direction,

    Double positionX,
    Double positionY,

    @NotBlank
    String cameraSource,

    Double confidence
) {}
