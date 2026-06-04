package com.assbi.ui.panel;

import com.assbi.ui.client.ApiClient;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;

/**
 * Right panel — live crossing counts (Person + Vehicle only).
 * Polls backend every 5 seconds.
 */
public class StatsPanel extends JPanel {

    private final ApiClient apiClient;
    private final JLabel personInLabel;
    private final JLabel personOutLabel;
    private final JLabel vehicleInLabel;
    private final JLabel vehicleOutLabel;
    private final JLabel statusLabel;
    private Timer refreshTimer;

    public StatsPanel(ApiClient apiClient) {
        this.apiClient = apiClient;
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBackground(new Color(30, 30, 30));
        setBorder(new EmptyBorder(12, 12, 12, 12));
        setPreferredSize(new Dimension(220, 0));

        add(sectionLabel("● LIVE COUNTS"));
        add(Box.createVerticalStrut(8));
        add(divider());
        add(Box.createVerticalStrut(8));

        personInLabel   = statRow("Person  IN :");
        personOutLabel  = statRow("Person  OUT:");
        add(Box.createVerticalStrut(6));
        add(divider());
        add(Box.createVerticalStrut(6));
        vehicleInLabel  = statRow("Vehicle IN :");
        vehicleOutLabel = statRow("Vehicle OUT:");

        add(Box.createVerticalStrut(12));
        add(divider());
        add(Box.createVerticalStrut(8));

        statusLabel = new JLabel("— waiting —");
        statusLabel.setForeground(Color.GRAY);
        statusLabel.setFont(new Font("Monospaced", Font.ITALIC, 10));
        statusLabel.setAlignmentX(LEFT_ALIGNMENT);
        add(statusLabel);
    }

    public void startPolling() {
        if (refreshTimer != null && refreshTimer.isRunning()) return;
        refreshTimer = new Timer(5000, e -> refresh());
        refreshTimer.setInitialDelay(1000);
        refreshTimer.start();
    }

    public void stopPolling() {
        if (refreshTimer != null) refreshTimer.stop();
    }

    private void refresh() {
        Thread.ofVirtual().start(() -> {
            try {
                String json = apiClient.getLiveCounts(60);
                SwingUtilities.invokeLater(() -> {
                    personInLabel.setText(extract(json, "person_IN"));
                    personOutLabel.setText(extract(json, "person_OUT"));

                    // Sum all vehicle types into one count
                    long vIn  = sum(json, "vehicle_IN", "car_IN", "truck_IN", "bus_IN", "motorcycle_IN");
                    long vOut = sum(json, "vehicle_OUT", "car_OUT", "truck_OUT", "bus_OUT", "motorcycle_OUT");
                    vehicleInLabel.setText(String.valueOf(vIn));
                    vehicleOutLabel.setText(String.valueOf(vOut));

                    statusLabel.setText("Updated " + java.time.LocalTime.now()
                        .toString().substring(0, 8));
                });
            } catch (Exception ex) {
                SwingUtilities.invokeLater(() ->
                    statusLabel.setText("API unavailable"));
            }
        });
    }

    private long sum(String json, String... keys) {
        long total = 0;
        for (String key : keys) {
            try { total += Long.parseLong(extract(json, key)); }
            catch (NumberFormatException ignored) {}
        }
        return total;
    }

    private String extract(String json, String key) {
        int idx = json.indexOf("\"" + key + "\"");
        if (idx < 0) return "0";
        int colon = json.indexOf(":", idx);
        int comma = json.indexOf(",", colon);
        int brace = json.indexOf("}", colon);
        if (brace < 0) return "0";
        int end = (comma > 0 && comma < brace) ? comma : brace;
        return json.substring(colon + 1, end).trim();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private JLabel sectionLabel(String text) {
        JLabel l = new JLabel(text);
        l.setForeground(new Color(100, 200, 100));
        l.setFont(new Font("Monospaced", Font.BOLD, 13));
        l.setAlignmentX(LEFT_ALIGNMENT);
        return l;
    }

    private JLabel statRow(String labelText) {
        JPanel row = new JPanel(new BorderLayout());
        row.setBackground(new Color(30, 30, 30));
        row.setMaximumSize(new Dimension(Integer.MAX_VALUE, 26));

        JLabel key = new JLabel(labelText);
        key.setForeground(Color.LIGHT_GRAY);
        key.setFont(new Font("Monospaced", Font.PLAIN, 12));

        JLabel val = new JLabel("0");
        val.setForeground(new Color(80, 200, 255));
        val.setFont(new Font("Monospaced", Font.BOLD, 14));
        val.setHorizontalAlignment(SwingConstants.RIGHT);

        row.add(key, BorderLayout.WEST);
        row.add(val, BorderLayout.EAST);
        add(row);
        return val;
    }

    private JSeparator divider() {
        JSeparator sep = new JSeparator();
        sep.setForeground(new Color(70, 70, 70));
        sep.setMaximumSize(new Dimension(Integer.MAX_VALUE, 1));
        return sep;
    }
}
