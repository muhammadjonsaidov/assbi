package com.assbi.service;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ChatbotService implements IChatbotService {

    private final IReportService reportService;

    public ChatbotService(IReportService reportService) {
        this.reportService = reportService;
    }

    // ── Public entry point ───────────────────────────────────────────────────

    public String chat(String userMessage) {
        TimeRange range   = extractTimeRange(userMessage);
        String    context = reportService.buildFlexibleContext(range.from(), range.to(), range.label());

        String prompt = """
            You are an AI assistant for the ASSBI Smart Surveillance platform.
            Answer the user's question using ONLY the data provided below.
            Be concise and precise — quote exact numbers from the data.
            If data shows zero events, say so clearly.
            Do not guess or estimate beyond what the data contains.

            --- SURVEILLANCE DATA ---
            %s
            --- END DATA ---

            USER QUESTION: %s
            """.formatted(context, userMessage);

        return callClaudeCLI(prompt);
    }

    // ── Time-range extraction ────────────────────────────────────────────────

    record TimeRange(Instant from, Instant to, String label) {}

    private TimeRange extractTimeRange(String msg) {
        String lower = msg.toLowerCase();
        Instant now  = Instant.now();

        // "last N minutes" / "past N minutes"
        Matcher mMin = Pattern.compile("(?:last|past)\\s+(\\d+)\\s*min(?:ute)?s?").matcher(lower);
        if (mMin.find()) {
            int n = Integer.parseInt(mMin.group(1));
            return new TimeRange(now.minus(n, ChronoUnit.MINUTES), now, "Last " + n + " minutes");
        }

        // "last hour" / "past hour" / "last 1 hour"
        if (lower.matches(".*\\b(?:last|past)\\s+(?:1\\s+)?hour\\b.*")) {
            return new TimeRange(now.minus(1, ChronoUnit.HOURS), now, "Last 1 hour");
        }

        // "last N hours" / "past N hours"
        Matcher mHours = Pattern.compile("(?:last|past)\\s+(\\d+)\\s*hours?").matcher(lower);
        if (mHours.find()) {
            int n = Integer.parseInt(mHours.group(1));
            return new TimeRange(now.minus(n, ChronoUnit.HOURS), now, "Last " + n + " hours");
        }

        // "today"
        if (lower.contains("today")) {
            Instant start = LocalDate.now(ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();
            return new TimeRange(start, now, "Today (so far)");
        }

        // "yesterday"
        if (lower.contains("yesterday")) {
            LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);
            Instant start = yesterday.atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant end   = yesterday.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            return new TimeRange(start, end, "Yesterday");
        }

        // "last N days" / "past N days"
        Matcher mDays = Pattern.compile("(?:last|past)\\s+(\\d+)\\s*days?").matcher(lower);
        if (mDays.find()) {
            int n = Integer.parseInt(mDays.group(1));
            Instant start = LocalDate.now(ZoneOffset.UTC).minusDays(n)
                .atStartOfDay(ZoneOffset.UTC).toInstant();
            return new TimeRange(start, now, "Last " + n + " days");
        }

        // "last N weeks"
        Matcher mWeeks = Pattern.compile("(?:last|past)\\s+(\\d+)\\s*weeks?").matcher(lower);
        if (mWeeks.find()) {
            int n = Integer.parseInt(mWeeks.group(1));
            Instant start = LocalDate.now(ZoneOffset.UTC).minusWeeks(n)
                .atStartOfDay(ZoneOffset.UTC).toInstant();
            return new TimeRange(start, now, "Last " + n + " weeks");
        }

        // "this week" / "last week" / "last 7 days" / "weekly" / "week"
        if (lower.matches(".*\\b(?:this week|last week|last 7 days|weekly|this week)\\b.*")
                || lower.matches(".*\\bweek\\b.*")) {
            Instant start = LocalDate.now(ZoneOffset.UTC).minusDays(7)
                .atStartOfDay(ZoneOffset.UTC).toInstant();
            return new TimeRange(start, now, "Last 7 days");
        }

        // "this month" / "last month" / "last 30 days" / "monthly"
        if (lower.matches(".*\\b(?:this month|last month|last 30 days|monthly)\\b.*")
                || lower.matches(".*\\bmonth\\b.*")) {
            Instant start = LocalDate.now(ZoneOffset.UTC).minusDays(30)
                .atStartOfDay(ZoneOffset.UTC).toInstant();
            return new TimeRange(start, now, "Last 30 days");
        }

        // "all time" / "total" / "ever" / "all"
        if (lower.matches(".*\\b(?:all time|all-time|total|ever|overall|all)\\b.*")) {
            Instant start = LocalDate.now(ZoneOffset.UTC).minusDays(90)
                .atStartOfDay(ZoneOffset.UTC).toInstant();
            return new TimeRange(start, now, "All available data (last 90 days)");
        }

        // default: last 24 hours (covers "how many today" type vague questions)
        return new TimeRange(now.minus(24, ChronoUnit.HOURS), now, "Last 24 hours");
    }

    // ── Claude CLI call ──────────────────────────────────────────────────────

    private String callClaudeCLI(String prompt) {
        try {
            ProcessBuilder pb = new ProcessBuilder("claude", "-p", prompt);
            pb.redirectErrorStream(true);
            pb.redirectInput(ProcessBuilder.Redirect.from(new java.io.File("/dev/null")));
            Process process = pb.start();

            String output = new String(process.getInputStream().readAllBytes());
            int exitCode  = process.waitFor();

            if (exitCode != 0 || output.isBlank()) {
                return "Chatbot unavailable. Check that Claude CLI is installed and authenticated.";
            }
            return output.trim();

        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            return "Chatbot error: " + e.getMessage();
        }
    }
}
