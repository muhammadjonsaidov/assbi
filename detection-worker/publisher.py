"""
Publishes crossing events to Spring Boot API via HTTP POST.
Falls back to local CSV log if API unreachable.
Non-blocking: events are queued and sent by a daemon thread so the
main detection loop is never stalled by a slow or unavailable API.
"""

import csv
import os
import queue
import threading
from datetime import datetime, timezone

import requests

from config import SPRING_API_URL as API_URL, API_TIMEOUT_S, CSV_FALLBACK_PATH as CSV_FALLBACK

_queue: "queue.Queue[dict]" = queue.Queue(maxsize=500)
_csv_initialized = False


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


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


def _send_loop():
    while True:
        payload = _queue.get()
        try:
            resp = requests.post(API_URL, json=payload, timeout=API_TIMEOUT_S)
            resp.raise_for_status()
        except Exception as e:
            print(f"[{_ts()}] [publish] API error ({type(e).__name__}) — writing CSV", flush=True)
            try:
                _fallback_csv(payload)
            except Exception as csv_err:
                print(f"[{_ts()}] [publish] CSV fallback failed: {csv_err}", flush=True)
        finally:
            _queue.task_done()


# Daemon publisher thread — starts automatically on import
threading.Thread(target=_send_loop, daemon=True, name="publisher").start()


def publish(event: dict, camera_source: str):
    """Enqueue a crossing event. Returns immediately; never blocks the caller."""
    payload = {
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "trackId":      event["track_id"],
        "objectType":   event["label"],
        "direction":    event["direction"],
        "positionX":    round(event["position"][0], 2),
        "positionY":    round(event["position"][1], 2),
        "cameraSource": camera_source,
        "confidence":   round(event.get("conf", 0.0), 3),
    }
    try:
        _queue.put_nowait(payload)
    except queue.Full:
        print(f"[{_ts()}] [publish] queue full — dropping event", flush=True)


def _fallback_csv(payload: dict):
    _init_csv()
    with open(CSV_FALLBACK, "a", newline="") as f:
        csv.writer(f).writerow([
            payload["timestamp"],
            payload["trackId"],
            payload["objectType"],
            payload["classId"],
            payload["direction"],
            payload["positionX"],
            payload["positionY"],
            payload["cameraSource"],
        ])