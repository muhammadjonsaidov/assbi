package com.assbi.ui.panel;

import com.assbi.ui.client.ApiClient;

import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;

/**
 * Center panel — polls Python frame server every 100ms and renders JPEG.
 *
 * Line drawing:
 *   - Click "Draw Line" button to enter draw mode
 *   - Click + drag on video to set new crossing line
 *   - Coordinates are translated back to video frame space and sent to Python
 */
public class VideoPanel extends JPanel {

    private final ApiClient apiClient;
    private volatile BufferedImage currentFrame;
    private final JLabel statusLabel;
    private Timer pollTimer;

    // Render area — updated each paintComponent call
    private int renderX, renderY, renderW, renderH;

    // Line drawing state
    private boolean drawMode = false;
    private Point dragStart, dragEnd;   // panel coords during drag
    private final JButton drawLineBtn;

    public VideoPanel(ApiClient apiClient) {
        this.apiClient = apiClient;
        setBackground(Color.BLACK);
        setLayout(null);   // absolute layout for overlay button
        setPreferredSize(new Dimension(800, 480));

        statusLabel = new JLabel("Waiting for stream...", SwingConstants.CENTER);
        statusLabel.setForeground(Color.GRAY);
        statusLabel.setFont(new Font("Monospaced", Font.PLAIN, 14));
        statusLabel.setBounds(200, 200, 400, 40);
        add(statusLabel);

        drawLineBtn = new JButton("✏ Draw Line");
        drawLineBtn.setBounds(10, 10, 120, 28);
        drawLineBtn.setBackground(new Color(60, 60, 180));
        drawLineBtn.setForeground(Color.WHITE);
        drawLineBtn.setFocusPainted(false);
        drawLineBtn.addActionListener(e -> toggleDrawMode());
        add(drawLineBtn);

        setupMouseListeners();
    }

    // ── Draw mode toggle ─────────────────────────────────────────────────────

    private void toggleDrawMode() {
        drawMode = !drawMode;
        if (drawMode) {
            drawLineBtn.setText("✏ Drawing... (drag)");
            drawLineBtn.setBackground(new Color(200, 120, 0));
            setCursor(Cursor.getPredefinedCursor(Cursor.CROSSHAIR_CURSOR));
        } else {
            drawLineBtn.setText("✏ Draw Line");
            drawLineBtn.setBackground(new Color(60, 60, 180));
            setCursor(Cursor.getDefaultCursor());
            dragStart = null;
            dragEnd   = null;
            repaint();
        }
    }

    // ── Mouse drag for line drawing ──────────────────────────────────────────

    private void setupMouseListeners() {
        MouseAdapter ma = new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                if (!drawMode) return;
                dragStart = e.getPoint();
                dragEnd   = e.getPoint();
            }

            @Override
            public void mouseDragged(MouseEvent e) {
                if (!drawMode || dragStart == null) return;
                dragEnd = e.getPoint();
                repaint();
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                if (!drawMode || dragStart == null) return;
                dragEnd = e.getPoint();
                sendLine(dragStart, dragEnd);
                toggleDrawMode();   // exit draw mode after line set
            }
        };
        addMouseListener(ma);
        addMouseMotionListener(ma);
    }

    /**
     * Translate panel pixel coords → video frame coords and POST to Python.
     */
    private void sendLine(Point panelStart, Point panelEnd) {
        if (currentFrame == null || renderW == 0 || renderH == 0) return;

        int x1 = panelToVideoX(panelStart.x);
        int y1 = panelToVideoY(panelStart.y);
        int x2 = panelToVideoX(panelEnd.x);
        int y2 = panelToVideoY(panelEnd.y);

        // Clamp to frame bounds
        x1 = clamp(x1, 0, currentFrame.getWidth());
        y1 = clamp(y1, 0, currentFrame.getHeight());
        x2 = clamp(x2, 0, currentFrame.getWidth());
        y2 = clamp(y2, 0, currentFrame.getHeight());

        final int fx1 = x1, fy1 = y1, fx2 = x2, fy2 = y2;
        Thread.ofVirtual().start(() -> {
            try {
                apiClient.setLine(fx1, fy1, fx2, fy2);
                System.out.printf("[UI] Line sent: (%d,%d) → (%d,%d)%n", fx1, fy1, fx2, fy2);
            } catch (Exception ex) {
                System.err.println("[UI] Failed to send line: " + ex.getMessage());
            }
        });
    }

    private int panelToVideoX(int px) {
        return (int) ((px - renderX) * (double) currentFrame.getWidth() / renderW);
    }

    private int panelToVideoY(int py) {
        return (int) ((py - renderY) * (double) currentFrame.getHeight() / renderH);
    }

    private int clamp(int val, int min, int max) {
        return Math.max(min, Math.min(max, val));
    }

    // ── Frame polling ────────────────────────────────────────────────────────

    private volatile boolean fetchInFlight = false;
    private volatile long lastFrameCrc = -1;

    public void startPolling() {
        if (pollTimer != null && pollTimer.isRunning()) return;
        pollTimer = new Timer(33, e -> fetchFrame());    // ~30 FPS display
        pollTimer.start();
    }

    public void stopPolling() {
        if (pollTimer != null) pollTimer.stop();
        currentFrame = null;
        fetchInFlight = false;
        statusLabel.setVisible(true);
        repaint();
    }

    private void fetchFrame() {
        // Skip if previous fetch still running — prevents out-of-order frames
        if (fetchInFlight) return;
        fetchInFlight = true;

        Thread.ofVirtual().start(() -> {
            try {
                byte[] jpeg = apiClient.fetchFrame();

                // Skip if frame unchanged — prevents blank flash
                java.util.zip.CRC32 crc32 = new java.util.zip.CRC32();
                crc32.update(jpeg);
                long crc = crc32.getValue();
                if (crc == lastFrameCrc) return;
                lastFrameCrc = crc;

                BufferedImage img = ImageIO.read(new ByteArrayInputStream(jpeg));
                if (img != null) {
                    currentFrame = img;
                    SwingUtilities.invokeLater(() -> {
                        statusLabel.setVisible(false);
                        repaint();
                    });
                }
            } catch (Exception ignored) {
            } finally {
                fetchInFlight = false;
            }
        });
    }

    // ── Painting ─────────────────────────────────────────────────────────────

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);

        BufferedImage frame = currentFrame;
        if (frame != null) {
            // Scale to fit preserving aspect ratio
            int pw = getWidth(), ph = getHeight();
            double scale = Math.min((double) pw / frame.getWidth(),
                                    (double) ph / frame.getHeight());
            renderW = (int) (frame.getWidth()  * scale);
            renderH = (int) (frame.getHeight() * scale);
            renderX = (pw - renderW) / 2;
            renderY = (ph - renderH) / 2;

            g.drawImage(frame, renderX, renderY, renderW, renderH, null);
        }

        // Draw drag preview line
        if (drawMode && dragStart != null && dragEnd != null) {
            Graphics2D g2 = (Graphics2D) g;
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(new Color(255, 80, 80, 200));
            g2.setStroke(new BasicStroke(2.5f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND,
                         0, new float[]{8, 6}, 0));
            g2.drawLine(dragStart.x, dragStart.y, dragEnd.x, dragEnd.y);

            // Endpoint dots
            g2.setColor(Color.RED);
            g2.fillOval(dragStart.x - 5, dragStart.y - 5, 10, 10);
            g2.fillOval(dragEnd.x - 5,   dragEnd.y - 5,   10, 10);
        }

        // Draw mode hint
        if (drawMode) {
            g.setColor(new Color(255, 160, 0));
            g.setFont(new Font("Monospaced", Font.BOLD, 13));
            g.drawString("Click and drag to draw crossing line", renderX + 10, renderY + renderH - 12);
        }
    }
}
