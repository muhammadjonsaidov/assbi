"""
Publishes crossing events to Spring Boot API via HTTP POST.
Falls back to local CSV log if API unreachable.
"""

import requests
import csv
import os
from datetime import datetime, timezone

from config import SPRING_API_URL as API_URL, API_TIMEOUT_S, CSV_FALLBACK_PATH as CSV_FALLBACK

_csv_initialized = False


def _init_csv():
    global _csv_initialized
    if not _csv_initialized:
        os.makedirs(os.path.dirname(CSV_FALLBACK), exist_ok=True)
        if not os.path.exists(CSV_FALLBACK):
            with open(CSV_FALLBACK, "w", newline="") as f:
                csv.writer(f).writerow(
                    ["timestamp", "track_id", "label", "cls", "direction",
                     "pos_x", "pos_y", "camera_source"]
                )
        _csv_initialized = True


def publish(event: dict, camera_source: str):
    """Send crossing event to Spring Boot API. Falls back to CSV on failure."""
    payload = {
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "trackId":      event["track_id"],
        "objectType":   event["label"],
        "classId":      event["cls"],
        "direction":    event["direction"],
        "positionX":    round(event["position"][0], 2),
        "positionY":    round(event["position"][1], 2),
        "cameraSource": camera_source,
        "confidence":   round(event.get("conf", 0.0), 3),
    }

    try:
        resp = requests.post(API_URL, json=payload, timeout=API_TIMEOUT_S)
        resp.raise_for_status()
    except Exception as e:
        print(f"[publisher] API error ({e}), falling back to CSV")
        try:
            _fallback_csv(payload)
        except Exception as csv_err:
            print(f"[publisher] CSV fallback also failed: {csv_err}")


def _fallback_csv(payload: dict):
    _init_csv()
    with open(CSV_FALLBACK, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            payload["timestamp"],
            payload["trackId"],
            payload["objectType"],
            payload["classId"],
            payload["direction"],
            payload["positionX"],
            payload["positionY"],
            payload["cameraSource"],
        ])
