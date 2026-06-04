package com.assbi.ui;

import com.assbi.ui.client.ApiClient;
import com.assbi.ui.panel.*;

import javax.swing.*;
import java.awt.*;

/**
 * ASSBI - Main application window.
 *
 * Layout:
 *   [NORTH]  SourcePanel    — video source selector + start/stop
 *   [CENTER] VideoPanel     — live annotated frame from Python
 *   [EAST]   StatsPanel     — real-time crossing counts
 *   [SOUTH]  ChatPanel      — Claude chatbot
 */
public class MainWindow extends JFrame {

    private final ApiClient apiClient;
    private final VideoPanel videoPanel;
    private final StatsPanel statsPanel;
    private final ChatPanel chatPanel;

    public MainWindow() {
        super("ASSBI — AI Smart Surveillance & Business Intelligence");
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        setSize(1280, 820);
        setLocationRelativeTo(null);

        applyDarkLookAndFeel();

        apiClient = new ApiClient();

        videoPanel = new VideoPanel(apiClient);
        statsPanel = new StatsPanel(apiClient);
        chatPanel  = new ChatPanel(apiClient);

        SourcePanel sourcePanel = new SourcePanel(source -> {
            videoPanel.startPolling();
            statsPanel.startPolling();
        });

        getContentPane().setBackground(new Color(30, 30, 30));
        setLayout(new BorderLayout(6, 6));

        add(sourcePanel,                BorderLayout.NORTH);
        add(videoPanel,                 BorderLayout.CENTER);
        add(statsPanel,                 BorderLayout.EAST);
        add(chatPanel,                  BorderLayout.SOUTH);

        addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowClosing(java.awt.event.WindowEvent e) {
                videoPanel.stopPolling();
                statsPanel.stopPolling();
            }
        });
    }

    private void applyDarkLookAndFeel() {
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {}

        UIManager.put("Panel.background",           new Color(30, 30, 30));
        UIManager.put("Label.foreground",           Color.LIGHT_GRAY);
        UIManager.put("Button.background",          new Color(55, 55, 55));
        UIManager.put("Button.foreground",          Color.WHITE);
        UIManager.put("ComboBox.background",        new Color(55, 55, 55));
        UIManager.put("ComboBox.foreground",        Color.WHITE);
        UIManager.put("TextField.background",       new Color(45, 45, 45));
        UIManager.put("TextField.foreground",       Color.WHITE);
        UIManager.put("ScrollPane.background",      new Color(20, 20, 20));
        UIManager.put("TitledBorder.titleColor",    new Color(150, 150, 150));
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            MainWindow window = new MainWindow();
            window.setVisible(true);
        });
    }
}
