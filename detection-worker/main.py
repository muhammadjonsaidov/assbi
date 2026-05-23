"""
ASSBI Detection Worker — entry point.
Always headless — video display handled by Swing UI via frame server on :5000.

Usage:
    python main.py --source 0                          # webcam
    python main.py --source video.mp4                  # local file
    python main.py --source rtsp://192.168.1.10/stream # RTSP
    python main.py --source https://youtube.com/...    # YouTube live

    --line x1,y1,x2,y2   Virtual crossing line (default: horizontal midline)
    --roi x1,y1,x2,y2    Region of interest (default: full frame)
    --model yolov8n.pt    YOLO model path
    --frame-skip N        Process every Nth frame (default: 3)
"""

import argparse
import cv2
import math
import time

import config
import stream_server
from source.video_source import VideoSource
from preprocessing.enhancer import preprocess, unpad_coords
from model.detector import Detector
from model.tracker import SimpleTracker
from model.line_crossing import LineCrossingDetector
from publisher import publish


def parse_args():
    p = argparse.ArgumentParser(description="ASSBI Detection Worker")
    p.add_argument("--source", default="0", help="Video source")
    p.add_argument("--line", default=None,
                   help="Line coords x1,y1,x2,y2 (default: horizontal midline)")
    p.add_argument("--roi", default=None,
                   help="ROI x1,y1,x2,y2 (default: full frame)")
    p.add_argument("--model", default=config.DEFAULT_MODEL, help="YOLO model path")
    p.add_argument("--frame-skip", type=int, default=config.DEFAULT_FRAME_SKIP,
                   help="Process every Nth frame")
    p.add_argument("--denoise", action="store_true",
                   help="Enable denoising (slow, for heavy RTSP compression)")
    return p.parse_args()


def draw_overlay(frame, tracks, line_start, line_end, counts, fps):
    # Crossing line
    cv2.line(frame, line_start, line_end, (0, 255, 255), 2)

    # IN / OUT side labels with arrows
    _draw_side_labels(frame, line_start, line_end)

    # Tracked bounding boxes
    for track in tracks:
        x1, y1, x2, y2 = [int(v) for v in track.bbox]
        label = f"{track.label} #{track.track_id}"
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 200, 0), 2)
        cv2.putText(frame, label, (x1, y1 - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 0), 1)

    # FPS
    cv2.putText(frame, f"FPS: {fps:.1f}", (10, frame.shape[0] - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

    return frame


def _draw_side_labels(frame, line_start, line_end):
    """
    Draw IN / OUT labels parallel to the crossing line, big text,
    blurred background behind each label for readability.
    """
    import numpy as np

    lx1, ly1 = line_start
    lx2, ly2 = line_end

    dx, dy = lx2 - lx1, ly2 - ly1
    length = math.sqrt(dx * dx + dy * dy)
    if length < 1:
        return

    # Line angle (degrees) — text will be rotated to match
    angle_deg = math.degrees(math.atan2(dy, dx))

    # Unit normal perpendicular to line
    nx, ny = -dy / length, dx / length

    # Place labels at 1/3 and 2/3 along the line, offset perpendicularly
    t1x, t1y = lx1 + dx * 0.35, ly1 + dy * 0.35
    t2x, t2y = lx1 + dx * 0.65, ly1 + dy * 0.65

    offset = 90  # px from line to label centre

    in_cx  = int(t1x - nx * offset)
    in_cy  = int(t1y - ny * offset)
    out_cx = int(t2x + nx * offset)
    out_cy = int(t2y + ny * offset)

    _draw_rotated_label(frame, "IN",  in_cx,  in_cy,  angle_deg, (0, 230, 80))
    _draw_rotated_label(frame, "OUT", out_cx, out_cy, angle_deg, (0, 80, 255))


def _draw_rotated_label(frame, text, cx, cy, angle_deg, color):
    """Render text rotated to angle_deg with a blurred dark background."""
    import numpy as np

    font      = cv2.FONT_HERSHEY_SIMPLEX
    scale     = 2.0
    thickness = 3
    pad       = 18

    (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)

    # Canvas big enough for text + padding
    cw, ch = tw + pad * 2, th + baseline + pad * 2

    # Draw blurred dark background on canvas
    canvas = np.zeros((ch, cw, 3), dtype=np.uint8)
    canvas[:] = (30, 30, 30)
    canvas = cv2.GaussianBlur(canvas, (21, 21), 10)

    # Draw text
    cv2.putText(canvas, text, (pad, th + pad),
                font, scale, color, thickness, cv2.LINE_AA)

    # Rotate canvas around its centre to match line angle
    rot = cv2.getRotationMatrix2D((cw / 2, ch / 2), -angle_deg, 1.0)
    cos_a, sin_a = abs(rot[0, 0]), abs(rot[0, 1])
    new_w = int(ch * sin_a + cw * cos_a)
    new_h = int(ch * cos_a + cw * sin_a)
    rot[0, 2] += (new_w - cw) / 2
    rot[1, 2] += (new_h - ch) / 2
    rotated = cv2.warpAffine(canvas, rot, (new_w, new_h),
                             flags=cv2.INTER_LINEAR)

    # Paste onto frame centred at (cx, cy) with 0.82 alpha blend
    fh, fw = frame.shape[:2]
    x1 = cx - new_w // 2
    y1 = cy - new_h // 2
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

    blended = cv2.addWeighted(overlay, 0.82, roi, 0.18, 0)
    frame[dy1:dy2, dx1:dx2] = blended


def main():
    args = parse_args()
    roi = tuple(int(v) for v in args.roi.split(",")) if args.roi else None

    src = VideoSource(args.source)
    src.open()
    w, h = src.resolution()
    if w == 0 or h == 0:
        w, h = 1280, 720

    # Default line: top-left → bottom-right diagonal (crosses road at ~90°)
    if args.line:
        lx1, ly1, lx2, ly2 = [int(v) for v in args.line.split(",")]
    else:
        lx1, ly1 = 0, 0
        lx2, ly2 = w, h

    detector = Detector(args.model)
    tracker = SimpleTracker()
    crossing = LineCrossingDetector((lx1, ly1), (lx2, ly2))

    frame_count = 0
    fps = 0.0
    fps_timer = time.time()
    fps_frames = 0
    last_tracks = []   # cached from last detection — reused on skipped frames

    # Start frame server for Swing UI
    stream_server.start(port=5000)

    print(f"[ASSBI] Source: {args.source}")
    print(f"[ASSBI] Line: ({lx1},{ly1}) → ({lx2},{ly2})")
    print(f"[ASSBI] Frame server: http://localhost:5000/frame")
    print(f"[ASSBI] Display: Swing UI only (headless)")

    try:
        while True:
            ret, frame = src.read()
            if not ret:
                if src.is_youtube():
                    print("[ASSBI] YouTube stream lost — refreshing URL...")
                    if src.refresh_youtube():
                        continue
                print("[ASSBI] Stream ended.")
                break

            frame_count += 1

            # FPS calculation
            fps_frames += 1
            elapsed = time.time() - fps_timer
            if elapsed >= 1.0:
                fps = fps_frames / elapsed
                fps_frames = 0
                fps_timer = time.time()

            orig_frame = frame.copy()

            # Run YOLO + tracking only every Nth frame
            if frame_count % args.frame_skip == 0:
                # Pre-process → YOLO input
                preprocessed, scale, pad_top, pad_left = preprocess(
                    frame,
                    denoise_enabled=args.denoise,
                    contrast_enabled=True
                )

                # Detect
                detections = detector.detect(preprocessed, roi=None)

                # Unpad coordinates back to original frame space
                for det in detections:
                    x1, y1, x2, y2 = det["bbox"]
                    x1, y1, x2, y2 = unpad_coords(x1, y1, x2, y2, scale, pad_top, pad_left)
                    det["bbox"] = [x1, y1, x2, y2]
                    cx = (x1 + x2) / 2
                    cy = (y1 + y2) / 2
                    det["centre"] = (cx, cy)

                # Apply ROI filter post-unpad
                if roi:
                    rx1, ry1, rx2, ry2 = roi
                    detections = [
                        d for d in detections
                        if rx1 <= d["centre"][0] <= rx2 and ry1 <= d["centre"][1] <= ry2
                    ]

                # Check if Swing UI sent a new line
                new_line = stream_server.get_pending_line()
                if new_line:
                    lx1, ly1, lx2, ly2 = new_line
                    crossing.update_line((lx1, ly1), (lx2, ly2))
                    print(f"[ASSBI] Line updated: ({lx1},{ly1}) → ({lx2},{ly2})")

                # Track + check crossings
                last_tracks = tracker.update(detections)
                events = crossing.check(last_tracks)
                for event in events:
                    print(f"[CROSSING] {event['direction']} {event['label']} #{event['track_id']}")
                    publish(event, camera_source=str(args.source))

                stream_server.update_stats(crossing.get_counts())
            else:
                # Non-detection frame: check for pending line only
                new_line = stream_server.get_pending_line()
                if new_line:
                    lx1, ly1, lx2, ly2 = new_line
                    crossing.update_line((lx1, ly1), (lx2, ly2))
                    print(f"[ASSBI] Line updated: ({lx1},{ly1}) → ({lx2},{ly2})")

            # Annotate + push EVERY frame (use cached last_tracks for skipped frames)
            annotated = draw_overlay(
                orig_frame, last_tracks,
                (lx1, ly1), (lx2, ly2),
                crossing.get_counts(), fps
            )

            _, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
            stream_server.update_frame(jpeg.tobytes())

    finally:
        src.release()
        print("[ASSBI] Final counts:", crossing.get_counts())


if __name__ == "__main__":
    main()
