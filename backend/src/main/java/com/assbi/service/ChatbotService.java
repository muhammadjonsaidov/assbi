package com.assbi.service;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ChatbotService {

    private final ReportService reportService;

    private static final Pattern PERIOD_PATTERN =
        Pattern.compile("(?i)(week|weekly|last week|month|monthly|last month|last 7 days|last 30 days)");

    public ChatbotService(ReportService reportService) {
        this.reportService = reportService;
    }

    public String chat(String userMessage) {
        String period  = extractPeriod(userMessage);
        String context = reportService.buildChatbotContext(period);

        String prompt = """
            You are an AI assistant for the ASSBI Smart Surveillance platform.
            Answer the user's question using only the data provided below.
            Be concise. Use numbers from the data. Format clearly.

            --- DATA ---
            %s
            --- END DATA ---

            USER QUESTION: %s
            """.formatted(context, userMessage);

        return callClaudeCLI(prompt);
    }

    private String extractPeriod(String message) {
        Matcher m = PERIOD_PATTERN.matcher(message);
        return m.find() ? m.group(1) : "week";
    }

    private String callClaudeCLI(String prompt) {
        try {
            ProcessBuilder pb = new ProcessBuilder("claude", "-p", prompt);
            pb.redirectErrorStream(true);
            pb.redirectInput(ProcessBuilder.Redirect.from(new java.io.File("/dev/null")));
            Process process = pb.start();

            String output = new String(process.getInputStream().readAllBytes());
            int exitCode = process.waitFor();

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
