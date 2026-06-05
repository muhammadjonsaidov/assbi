"""
ASSBI Detection Worker — entry point.
Always headless — video display handled by React UI via frame server on :5000.

Usage:
    python main.py --source 0                          # webcam
    python main.py --source video.mp4                  # local file
    python main.py --source rtsp://192.168.1.10/stream # RTSP
    python main.py --source https://youtube.com/...    # YouTube live

    --line x1,y1,x2,y2   Virtual crossing line (default: diagonal)
    --roi x1,y1,x2,y2    Region of interest (default: full frame)
    --model yolov8n.pt    YOLO model path
    --frame-skip N        Process every Nth frame (default: 3)
"""

import argparse
import math
import time
from datetime import datetime

import cv2
import numpy as np

import config
import stream_server
from source.video_source import VideoSource
from preprocessing.enhancer import preprocess, unpad_coords
from model.detector import Detector
from model.tracker import SimpleTracker
from model.line_crossing import LineCrossingDetector
from publisher import publish


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _log(tag: str, msg: str):
    print(f"[{_ts()}] [{tag}] {msg}", flush=True)


def parse_args():
    p = argparse.ArgumentParser(description="ASSBI Detection Worker")
    p.add_argument("--source", default="0", help="Video source")
    p.add_argument("--line", default=None,
                   help="Line coords x1,y1,x2,y2 (default: diagonal)")
    p.add_argument("--roi", default=None,
                   help="ROI x1,y1,x2,y2 (default: full frame)")
    p.add_argument("--model", default=config.DEFAULT_MODEL, help="YOLO model path")
    p.add_argument("--frame-skip", type=int, default=config.DEFAULT_FRAME_SKIP,
                   help="Process every Nth frame")
    p.add_argument("--denoise", action="store_true",
                   help="Enable denoising (slow, for heavy RTSP compression)")
    return p.parse_args()


def _apply_pending_line(crossing: LineCrossingDetector) -> tuple[int, int, int, int] | None:
    """Check for a UI-requested line update. Returns new coords or None."""
    new_line = stream_server.get_pending_line()
    if new_line:
        lx1, ly1, lx2, ly2 = new_line
        crossing.update_line((lx1, ly1), (lx2, ly2))
        _log("line", f"updated ({lx1},{ly1})→({lx2},{ly2})")
        return new_line
    return None


def draw_overlay(frame, tracks, line_start, line_end, counts, fps):
    cv2.line(frame, line_start, line_end, (0, 255, 255), 2)
    _draw_side_labels(frame, line_start, line_end)

    for track in tracks:
        x1, y1, x2, y2 = [int(v) for v in track.bbox]
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 0), 2)
        cv2.putText(frame, f"{track.label} #{track.track_id}", (x1, y1 - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 0), 1)

    cv2.putText(frame, f"FPS: {fps:.1f}", (10, frame.shape[0] - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)
    return frame


def _draw_side_labels(frame, line_start, line_end):
    lx1, ly1 = line_start
    lx2, ly2 = line_end
    dx, dy = lx2 - lx1, ly2 - ly1
    length = math.sqrt(dx * dx + dy * dy)
    if length < 1:
        return

    angle_deg = math.degrees(math.atan2(dy, dx))
    nx, ny = -dy / length, dx / length

    t1x, t1y = lx1 + dx * 0.35, ly1 + dy * 0.35
    t2x, t2y = lx1 + dx * 0.65, ly1 + dy * 0.65
    offset = 90

    _draw_rotated_label(frame, "IN",
                        int(t1x - nx * offset), int(t1y - ny * offset),
                        angle_deg, (0, 230, 80))
    _draw_rotated_label(frame, "OUT",
                        int(t2x + nx * offset), int(t2y + ny * offset),
                        angle_deg, (0, 80, 255))


def _draw_rotated_label(frame, text, cx, cy, angle_deg, color):
    font, scale, thickness, pad = cv2.FONT_HERSHEY_SIMPLEX, 2.0, 3, 18
    (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)
    cw, ch = tw + pad * 2, th + baseline + pad * 2

    canvas = np.zeros((ch, cw, 3), dtype=np.uint8)
    canvas[:] = (30, 30, 30)
    canvas = cv2.GaussianBlur(canvas, (21, 21), 10)
    cv2.putText(canvas, text, (pad, th + pad), font, scale, color, thickness, cv2.LINE_AA)

    rot = cv2.getRotationMatrix2D((cw / 2, ch / 2), -angle_deg, 1.0)
    cos_a, sin_a = abs(rot[0, 0]), abs(rot[0, 1])
    new_w = int(ch * sin_a + cw * cos_a)
    new_h = int(ch * cos_a + cw * sin_a)
    rot[0, 2] += (new_w - cw) / 2
    rot[1, 2] += (new_h - ch) / 2
    rotated = cv2.warpAffine(canvas, rot, (new_w, new_h), flags=cv2.INTER_LINEAR)

    fh, fw = frame.shape[:2]
    x1 = cx - new_w // 2;  y1 = cy - new_h // 2
    x2, y2 = x1 + new_w, y1 + new_h

    sx1 = max(0, -x1);  sy1 = max(0, -y1)
    dx1 = max(0, x1);   dy1 = max(0, y1)
    dx2 = min(fw, x2);  dy2 = min(fh, y2)
    sx2 = sx1 + (dx2 - dx1)
    sy2 = sy1 + (dy2 - dy1)

    if dx2 <= dx1 or dy2 <= dy1:
        return

    roi     = frame[dy1:dy2, dx1:dx2]
    overlay = rotated[sy1:sy2, sx1:sx2]
    frame[dy1:dy2, dx1:dx2] = cv2.addWeighted(overlay, 0.82, roi, 0.18, 0)


def main():
    args = parse_args()
    roi = tuple(int(v) for v in args.roi.split(",")) if args.roi else None

    stream_server.start(port=config.FRAME_SERVER_PORT)

    src = VideoSource(args.source)
    src.open()
    w, h = src.resolution()
    if w == 0 or h == 0:
        w, h = 1280, 720

    if args.line:
        lx1, ly1, lx2, ly2 = [int(v) for v in args.line.split(",")]
    else:
        lx1, ly1, lx2, ly2 = 0, 0, w, h

    detector = Detector(args.model)
    tracker  = SimpleTracker()
    crossing = LineCrossingDetector((lx1, ly1), (lx2, ly2))

    frame_count = 0
    fps = 0.0
    fps_timer  = time.time()
    fps_frames = 0
    last_tracks: list = []

    _log("init", f"source={args.source} line=({lx1},{ly1})→({lx2},{ly2}) skip={args.frame_skip}")
    _log("init", f"frame-server=:{config.FRAME_SERVER_PORT} model={args.model}")

    try:
        while True:
            ret, frame = src.read()
            if not ret:
                if src.is_youtube():
                    _log("stream", "YouTube stream lost — refreshing URL")
                    if src.refresh_youtube():
                        continue
                _log("stream", "ended")
                break

            frame_count += 1
            fps_frames += 1
            elapsed = time.time() - fps_timer
            if elapsed >= 1.0:
                fps = fps_frames / elapsed
                fps_frames = 0
                fps_timer = time.time()

            orig_frame = frame.copy()

            if frame_count % args.frame_skip == 0:
                preprocessed, scale, pad_top, pad_left = preprocess(
                    frame, denoise_enabled=args.denoise, contrast_enabled=True
                )
                detections = detector.detect(preprocessed, roi=None)

                for det in detections:
                    x1, y1, x2, y2 = det["bbox"]
                    x1, y1, x2, y2 = unpad_coords(x1, y1, x2, y2, scale, pad_top, pad_left)
                    det["bbox"]   = [x1, y1, x2, y2]
                    det["centre"] = ((x1 + x2) / 2, (y1 + y2) / 2)

                if roi:
                    rx1, ry1, rx2, ry2 = roi
                    detections = [
                        d for d in detections
                        if rx1 <= d["centre"][0] <= rx2 and ry1 <= d["centre"][1] <= ry2
                    ]

                # Check for pending line update from UI
                new_coords = _apply_pending_line(crossing)
                if new_coords:
                    lx1, ly1, lx2, ly2 = new_coords

                last_tracks = tracker.update(detections)
                events = crossing.check(last_tracks)
                for ev in events:
                    _log("cross", f"{ev['direction']} {ev['label']} #{ev['track_id']} conf={ev['conf']:.2f}")
                    publish(ev, camera_source=str(args.source))

                stream_server.update_stats(crossing.get_counts())

            else:
                new_coords = _apply_pending_line(crossing)
                if new_coords:
                    lx1, ly1, lx2, ly2 = new_coords

            annotated = draw_overlay(
                orig_frame, last_tracks,
                (lx1, ly1), (lx2, ly2),
                crossing.get_counts(), fps
            )
            _, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
            stream_server.update_frame(jpeg.tobytes())

    finally:
        src.release()
        counts = crossing.get_counts()
        _log("done", f"final counts: IN={counts.get('IN',{})} OUT={counts.get('OUT',{})}")


if __name__ == "__main__":
    main()