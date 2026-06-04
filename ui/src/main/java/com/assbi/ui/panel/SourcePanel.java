package com.assbi.ui.panel;

import javax.swing.*;
import java.awt.*;
import java.io.File;
import java.util.function.Consumer;

/**
 * Top panel — select video source and start/stop Python detection worker.
 * Worker is launched here; no source arg needed in start.sh.
 */
public class SourcePanel extends JPanel {

    private final JComboBox<String> typeCombo;
    private final JTextField sourceField;
    private final JButton startBtn;
    private final JButton stopBtn;

    private Process detectionProcess;

    // ASSBI_ROOT passed from start.sh via -DASSBI_ROOT=...
    private static final String ASSBI_ROOT = System.getProperty("ASSBI_ROOT",
            new File(System.getProperty("user.dir")).getParent());

    public SourcePanel(Consumer<String> onStarted) {
        setLayout(new FlowLayout(FlowLayout.LEFT, 8, 6));
        setBorder(BorderFactory.createTitledBorder("Video Source"));
        setBackground(new Color(40, 40, 40));

        typeCombo = new JComboBox<>(new String[]{"Webcam", "File", "RTSP", "YouTube"});
        typeCombo.setBackground(new Color(60, 60, 60));
        typeCombo.setForeground(Color.WHITE);
        typeCombo.addActionListener(e -> updatePlaceholder());

        sourceField = new JTextField(40);
        sourceField.setText("0");
        sourceField.setBackground(new Color(55, 55, 55));
        sourceField.setForeground(Color.WHITE);
        sourceField.setCaretColor(Color.WHITE);

        JButton browseBtn = new JButton("Browse");
        browseBtn.addActionListener(e -> browse());

        startBtn = new JButton("▶ Start");
        startBtn.setBackground(new Color(0, 150, 80));
        startBtn.setForeground(Color.WHITE);
        startBtn.addActionListener(e -> start(onStarted));

        stopBtn = new JButton("■ Stop");
        stopBtn.setBackground(new Color(180, 40, 40));
        stopBtn.setForeground(Color.WHITE);
        stopBtn.setEnabled(false);
        stopBtn.addActionListener(e -> stop());

        add(new JLabel("Type:") {{ setForeground(Color.LIGHT_GRAY); }});
        add(typeCombo);
        add(new JLabel("Source:") {{ setForeground(Color.LIGHT_GRAY); }});
        add(sourceField);
        add(browseBtn);
        add(startBtn);
        add(stopBtn);
    }

    private void updatePlaceholder() {
        String type = (String) typeCombo.getSelectedItem();
        sourceField.setText(switch (type) {
            case "Webcam"  -> "0";
            case "RTSP"    -> "rtsp://192.168.1.10:554/stream";
            case "YouTube" -> "https://www.youtube.com/watch?v=...";
            default        -> "";
        });
    }

    private void browse() {
        JFileChooser fc = new JFileChooser();
        fc.setDialogTitle("Select video file");
        if (fc.showOpenDialog(this) == JFileChooser.APPROVE_OPTION) {
            sourceField.setText(fc.getSelectedFile().getAbsolutePath());
            typeCombo.setSelectedItem("File");
        }
    }

    private void start(Consumer<String> onStarted) {
        String source = sourceField.getText().trim();
        if (source.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Enter a video source.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        File workerDir  = new File(ASSBI_ROOT, "detection-worker");
        File pythonBin  = new File(workerDir, "venv/bin/python");

        if (!workerDir.exists()) {
            JOptionPane.showMessageDialog(this,
                "detection-worker not found at:\n" + workerDir.getAbsolutePath(),
                "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(
                pythonBin.getAbsolutePath(),
                "main.py",
                "--source", source
            );
            pb.directory(workerDir);
            pb.redirectErrorStream(true);

            // Log worker output to logs/worker.log
            File logFile = new File(ASSBI_ROOT, "logs/worker.log");
            logFile.getParentFile().mkdirs();
            pb.redirectOutput(logFile);

            detectionProcess = pb.start();

            startBtn.setEnabled(false);
            stopBtn.setEnabled(true);
            typeCombo.setEnabled(false);
            sourceField.setEditable(false);

            onStarted.accept(source);

        } catch (Exception ex) {
            JOptionPane.showMessageDialog(this,
                "Failed to start detection worker:\n" + ex.getMessage(),
                "Error", JOptionPane.ERROR_MESSAGE);
        }
    }

    private void stop() {
        if (detectionProcess != null && detectionProcess.isAlive()) {
            detectionProcess.destroy();
        }
        startBtn.setEnabled(true);
        stopBtn.setEnabled(false);
        typeCombo.setEnabled(true);
        sourceField.setEditable(true);
    }
}
