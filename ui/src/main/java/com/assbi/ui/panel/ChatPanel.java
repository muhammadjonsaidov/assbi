package com.assbi.ui.panel;

import com.assbi.ui.client.ApiClient;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.text.*;
import java.awt.*;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;

/**
 * Bottom panel — chatbot interface. Sends to POST /api/chat → Claude CLI.
 */
public class ChatPanel extends JPanel {

    private final ApiClient apiClient;
    private final JTextPane chatArea;
    private final JTextField inputField;
    private final JButton sendBtn;
    private final StyledDocument doc;

    private static final SimpleAttributeSet USER_STYLE  = new SimpleAttributeSet();
    private static final SimpleAttributeSet BOT_STYLE   = new SimpleAttributeSet();
    private static final SimpleAttributeSet INFO_STYLE  = new SimpleAttributeSet();

    static {
        StyleConstants.setForeground(USER_STYLE, new Color(100, 200, 255));
        StyleConstants.setBold(USER_STYLE, true);

        StyleConstants.setForeground(BOT_STYLE, new Color(200, 255, 180));

        StyleConstants.setForeground(INFO_STYLE, Color.GRAY);
        StyleConstants.setItalic(INFO_STYLE, true);
    }

    public ChatPanel(ApiClient apiClient) {
        this.apiClient = apiClient;
        setLayout(new BorderLayout(6, 4));
        setBackground(new Color(25, 25, 25));
        setBorder(BorderFactory.createTitledBorder(
            BorderFactory.createLineBorder(new Color(60, 60, 60)),
            " Chatbot — Ask about your data "
        ));
        setPreferredSize(new Dimension(0, 220));

        chatArea = new JTextPane();
        chatArea.setEditable(false);
        chatArea.setBackground(new Color(20, 20, 20));
        doc = chatArea.getStyledDocument();

        JScrollPane scroll = new JScrollPane(chatArea);
        scroll.setBorder(null);
        add(scroll, BorderLayout.CENTER);

        JPanel inputRow = new JPanel(new BorderLayout(6, 0));
        inputRow.setBackground(new Color(25, 25, 25));
        inputRow.setBorder(new EmptyBorder(4, 4, 4, 4));

        inputField = new JTextField();
        inputField.setBackground(new Color(45, 45, 45));
        inputField.setForeground(Color.WHITE);
        inputField.setCaretColor(Color.WHITE);
        inputField.setFont(new Font("Monospaced", Font.PLAIN, 13));
        inputField.addKeyListener(new KeyAdapter() {
            @Override public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ENTER) send();
            }
        });

        sendBtn = new JButton("Send");
        sendBtn.setBackground(new Color(0, 130, 80));
        sendBtn.setForeground(Color.WHITE);
        sendBtn.addActionListener(e -> send());

        inputRow.add(inputField, BorderLayout.CENTER);
        inputRow.add(sendBtn, BorderLayout.EAST);
        add(inputRow, BorderLayout.SOUTH);

        appendInfo("Ready. Try: \"Give me last week's report\" or \"How many vehicles today?\"");
    }

    private void send() {
        String message = inputField.getText().trim();
        if (message.isEmpty()) return;

        inputField.setText("");
        inputField.setEnabled(false);
        sendBtn.setEnabled(false);

        appendUser("You: " + message);
        appendInfo("Thinking...");

        Thread.ofVirtual().start(() -> {
            try {
                String raw = apiClient.chat(message);
                // Extract "response" field from JSON
                String response = extractResponse(raw);
                SwingUtilities.invokeLater(() -> {
                    removeLastLine();   // remove "Thinking..."
                    appendBot("Claude: " + response);
                    inputField.setEnabled(true);
                    sendBtn.setEnabled(true);
                    inputField.requestFocus();
                });
            } catch (Exception ex) {
                SwingUtilities.invokeLater(() -> {
                    removeLastLine();
                    appendInfo("Error: " + ex.getMessage());
                    inputField.setEnabled(true);
                    sendBtn.setEnabled(true);
                });
            }
        });
    }

    private void appendUser(String text) { append(text + "\n", USER_STYLE); }
    private void appendBot(String text)  { append(text + "\n\n", BOT_STYLE); }
    private void appendInfo(String text) { append(text + "\n", INFO_STYLE); }

    private void append(String text, AttributeSet style) {
        try {
            doc.insertString(doc.getLength(), text, style);
            chatArea.setCaretPosition(doc.getLength());
        } catch (BadLocationException ignored) {}
    }

    private void removeLastLine() {
        try {
            String content = doc.getText(0, doc.getLength());
            int last = content.lastIndexOf('\n', content.length() - 2);
            if (last >= 0) doc.remove(last + 1, doc.getLength() - last - 1);
        } catch (BadLocationException ignored) {}
    }

    private String extractResponse(String json) {
        // Extract "response":"..." from JSON
        int idx = json.indexOf("\"response\"");
        if (idx < 0) return json;
        int colon = json.indexOf(":", idx);
        int start = json.indexOf("\"", colon + 1) + 1;
        int end   = json.lastIndexOf("\"");
        if (start <= 0 || end <= start) return json;
        return json.substring(start, end)
                   .replace("\\n", "\n")
                   .replace("\\\"", "\"");
    }
}
