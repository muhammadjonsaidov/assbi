"""
Central configuration for the ASSBI detection worker.
All tuneable constants and environment-variable overrides live here.
"""

import os

# ── Frame server ──────────────────────────────────────────────────────────────
FRAME_SERVER_PORT = int(os.getenv("FRAME_SERVER_PORT", 5000))

# ── Model / inference ─────────────────────────────────────────────────────────
DEFAULT_MODEL   = os.getenv("MODEL_PATH", "runs/train/assbi_model/weights/best.pt")
DEFAULT_FRAME_SKIP = int(os.getenv("FRAME_SKIP", 3))
CONF_THRESHOLD  = float(os.getenv("CONF_THRESHOLD", 0.45))
MIN_BOX_AREA    = int(os.getenv("MIN_BOX_AREA", 200))       # px² — catches distant/top-down persons
LETTERBOX_SIZE  = int(os.getenv("LETTERBOX_SIZE", 640))

# ── Tracker ───────────────────────────────────────────────────────────────────
TRACKER_IOU_THRESHOLD = float(os.getenv("TRACKER_IOU_THRESHOLD", 0.35))
TRACKER_MAX_MISSED    = int(os.getenv("TRACKER_MAX_MISSED", 8))

# ── Publisher ─────────────────────────────────────────────────────────────────
SPRING_API_URL    = os.getenv("SPRING_API_URL", "http://localhost:8080/api/events")
API_TIMEOUT_S     = float(os.getenv("API_TIMEOUT_S", 2.0))
CSV_FALLBACK_PATH = os.getenv("CSV_FALLBACK_PATH", "output/events_fallback.csv")

# ── COCO classes tracked ──────────────────────────────────────────────────────
ALLOWED_CLASSES = {
    0: "bus",
    1: "car",
    2: "motorcycle",
    3: "truck",
}