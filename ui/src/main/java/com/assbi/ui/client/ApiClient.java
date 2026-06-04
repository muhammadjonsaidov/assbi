package com.assbi.ui.client;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * HTTP client for Spring Boot backend (port 8080) and Python frame server (port 5000).
 */
public class ApiClient {

    private static final String API_BASE  = "http://localhost:8080/api";
    private static final String FRAME_URL = "http://localhost:5000/frame";
    private static final String STATS_URL = "http://localhost:5000/stats";

    private final HttpClient http;

    public ApiClient() {
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
    }

    // ── Frame server (Python, port 5000) ────────────────────────────────────

    public byte[] fetchFrame() throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(FRAME_URL))
            .timeout(Duration.ofSeconds(2))
            .GET().build();
        HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
        if (res.statusCode() != 200) throw new IOException("Frame not ready: " + res.statusCode());
        return res.body();
    }

    public String fetchStats() throws IOException, InterruptedException {
        return get(STATS_URL);
    }

    public void setLine(int x1, int y1, int x2, int y2) throws IOException, InterruptedException {
        String body = String.format("{\"x1\":%d,\"y1\":%d,\"x2\":%d,\"y2\":%d}", x1, y1, x2, y2);
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:5000/line"))
            .timeout(Duration.ofSeconds(3))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        http.send(req, HttpResponse.BodyHandlers.ofString());
    }

    // ── Spring Boot backend (port 8080) ─────────────────────────────────────

    public String getLiveCounts(int minutes) throws IOException, InterruptedException {
        return get(API_BASE + "/events/counts?minutes=" + minutes);
    }

    public String getWeeklyReport() throws IOException, InterruptedException {
        return get(API_BASE + "/reports/weekly");
    }

    public String getMonthlyReport() throws IOException, InterruptedException {
        return get(API_BASE + "/reports/monthly");
    }

    public String chat(String message) throws IOException, InterruptedException {
        String body = "{\"message\":" + jsonString(message) + "}";
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/chat"))
            .timeout(Duration.ofSeconds(60))   // Claude CLI may take a moment
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        return res.body();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String get(String url) throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(5))
            .GET().build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        return res.body();
    }

    private static String jsonString(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
