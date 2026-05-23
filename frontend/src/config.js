// ─── Manual configuration ─────────────────────────────────────────────────────
// Edit these values to match your deployment environment.

const config = {
  // Spring Boot REST + WebSocket API
  backendUrl: 'http://localhost:8080',

  // Python detection-worker frame / stats / line server
  frameServerUrl: 'http://localhost:5000',

  // How often the Stats panel polls for new counts (ms)
  statsPollingMs: 5000,

  // Time window shown in the Stats panel (minutes)
  statsWindowMinutes: 60,

  // Video frame polling interval (ms) — lower = smoother, more CPU
  framePollMs: 50,
}

export default config