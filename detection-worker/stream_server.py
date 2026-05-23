"""
Simple HTTP frame server for Swing UI.
GET  /frame   — latest annotated JPEG frame
GET  /stream  — MJPEG stream for browser <img> tag (continuous push)
GET  /stats   — crossing counts JSON
GET  /health  — health check
POST /line    — set new crossing line {x1,y1,x2,y2} from Swing UI
"""

import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import json
import time

from config import FRAME_SERVER_PORT


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle each HTTP request in its own thread."""
    daemon_threads = True

_latest_frame_bytes: bytes = b""
_latest_stats: dict = {}
_pending_line: tuple | None = None   # (x1, y1, x2, y2) set by UI, consumed by main loop
_lock = threading.Lock()


def update_frame(jpeg_bytes: bytes):
    global _latest_frame_bytes
    with _lock:
        _latest_frame_bytes = jpeg_bytes


def update_stats(stats: dict):
    global _latest_stats
    with _lock:
        _latest_stats = stats.copy()


def get_pending_line() -> tuple | None:
    """Called by main loop each frame. Returns new line coords and clears them."""
    global _pending_line
    with _lock:
        line = _pending_line
        _pending_line = None
    return line


class FrameHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # suppress request logs

    def do_GET(self):
        if self.path == "/frame":
            self._serve_frame()
        elif self.path == "/stats":
            self._serve_stats()
        elif self.path == "/health":
            self._send_json({"status": "ok"})
        elif self.path == "/ready":
            with _lock:
                ready = len(_latest_frame_bytes) > 0
            self._send_json({"ready": ready})
        elif self.path == "/stream":
            self._serve_stream()
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == "/line":
            self._receive_line()
        else:
            self.send_error(404)

    def _receive_line(self):
        global _pending_line
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length))
            coords = (int(body["x1"]), int(body["y1"]),
                      int(body["x2"]), int(body["y2"]))
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            self.send_error(400, f"Bad line payload: {e}")
            return
        with _lock:
            _pending_line = coords
        self._send_json({"status": "ok"})

    def _serve_frame(self):
        with _lock:
            data = _latest_frame_bytes
        if not data:
            self.send_error(503, "No frame available yet")
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _serve_stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            while True:
                with _lock:
                    data = _latest_frame_bytes
                if data:
                    header = (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n" +
                        f"Content-Length: {len(data)}\r\n\r\n".encode()
                    )
                    self.wfile.write(header + data + b"\r\n")
                    self.wfile.flush()
                time.sleep(0.033)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def _serve_stats(self):
        with _lock:
            data = _latest_stats.copy()
        self._send_json(data)

    def _send_json(self, data: dict):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


def start(port: int = FRAME_SERVER_PORT):
    server = ThreadedHTTPServer(("0.0.0.0", port), FrameHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"[StreamServer] Listening on http://0.0.0.0:{port}/frame")
    return server
