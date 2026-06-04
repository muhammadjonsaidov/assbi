package com.assbi.dto;

public record ErrorResponse(int status, String error, String details, String timestamp) {

    public static ErrorResponse of(int status, String error, String details) {
        return new ErrorResponse(status, error, details, java.time.Instant.now().toString());
    }

    public static ErrorResponse of(int status, String error) {
        return of(status, error, null);
    }
}