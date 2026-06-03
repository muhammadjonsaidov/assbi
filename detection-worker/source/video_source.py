import cv2
import subprocess


class VideoSource:
    """
    Unified video source handler.
    Supports: local file, RTSP stream, webcam index, YouTube live URL.
    """

    def __init__(self, source):
        self.source = source
        self.cap = None
        self._resolved = self._resolve(source)

    def _resolve(self, source):
        # Webcam: integer or "0", "1", etc.
        if isinstance(source, int) or (isinstance(source, str) and source.isdigit()):
            return int(source)

        # YouTube: extract real stream URL via yt-dlp
        if isinstance(source, str) and ("youtube.com" in source or "youtu.be" in source):
            return self._resolve_youtube(source)

        # RTSP / local file: pass through
        return source

    def _resolve_youtube(self, url):
        self._youtube_original_url = url
        try:
            result = subprocess.run(
                ["yt-dlp", "--cookies-from-browser", "chromium",
                 "-f", "best[ext=mp4]/best", "-g", url],
                capture_output=True, text=True, timeout=30
            )
            stream_url = result.stdout.strip().split("\n")[0]
            if not stream_url:
                raise ValueError(f"yt-dlp returned empty URL for: {url}")
            return stream_url
        except Exception as e:
            raise RuntimeError(f"YouTube source resolution failed: {e}")

    def refresh_youtube(self):
        """Re-resolve YouTube stream URL. Call when stream errors after ~6h URL expiry."""
        original = getattr(self, "_youtube_original_url", None)
        if not original:
            return False
        try:
            new_url = self._resolve_youtube(original)
            self.release()
            self._resolved = new_url
            self.open()
            print("[VideoSource] YouTube URL refreshed.")
            return True
        except Exception as e:
            print(f"[VideoSource] YouTube refresh failed: {e}")
            return False

    def is_youtube(self):
        return hasattr(self, "_youtube_original_url")

    def open(self):
        self.cap = cv2.VideoCapture(self._resolved)
        if not self.cap.isOpened():
            raise RuntimeError(f"Cannot open video source: {self._resolved}")
        return self

    def read(self):
        if self.cap is None:
            raise RuntimeError("Call open() before read()")
        ret, frame = self.cap.read()
        return ret, frame

    def fps(self):
        return self.cap.get(cv2.CAP_PROP_FPS) if self.cap else 25.0

    def resolution(self):
        if self.cap is None:
            return (0, 0)
        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        return (w, h)

    def release(self):
        if self.cap:
            self.cap.release()
            self.cap = None

    def __enter__(self):
        return self.open()

    def __exit__(self, *args):
        self.release()
