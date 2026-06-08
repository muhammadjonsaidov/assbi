"""
Run YOLO on a video/image folder → export all detections to result.csv.
Used for: dataset inspection, assignment evidence, fine-tune data prep.

Usage:
    python fine_tune/export_csv.py --source video.mp4 --output result.csv
    python fine_tune/export_csv.py --source ./images/ --output result.csv
"""

import argparse
import csv
import os
import cv2
from ultralytics import YOLO
from datetime import datetime

ALLOWED_CLASSES = {0: "person", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def run(source, model_path, output_csv, conf_threshold=0.5):
    model = YOLO(model_path)
    os.makedirs(os.path.dirname(output_csv) if os.path.dirname(output_csv) else ".", exist_ok=True)

    with open(output_csv, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "frame_id", "timestamp", "class_id", "class_name",
            "confidence", "x1", "y1", "x2", "y2",
            "centre_x", "centre_y", "width", "height"
        ])

        # Image folder
        if os.path.isdir(source):
            images = [
                os.path.join(source, fn) for fn in sorted(os.listdir(source))
                if fn.lower().endswith((".jpg", ".jpeg", ".png", ".bmp"))
            ]
            for frame_id, img_path in enumerate(images):
                frame = cv2.imread(img_path)
                if frame is None:
                    continue
                _process_frame(model, frame, frame_id, writer, conf_threshold)

        # Video file
        else:
            cap = cv2.VideoCapture(source)
            if not cap.isOpened():
                raise RuntimeError(f"Cannot open video source: {source}")
            frame_id = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                if frame_id % 5 == 0:  # every 5th frame
                    _process_frame(model, frame, frame_id, writer, conf_threshold)
                frame_id += 1
            cap.release()

    print(f"[export_csv] Saved detections → {output_csv}")


def _process_frame(model, frame, frame_id, writer, conf_threshold):
    results = model(frame, verbose=False)[0]
    ts = datetime.utcnow().isoformat()
    for box in results.boxes:
        cls = int(box.cls)
        if cls not in ALLOWED_CLASSES:
            continue
        conf = float(box.conf)
        if conf < conf_threshold:
            continue
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        w, h = x2 - x1, y2 - y1
        writer.writerow([
            frame_id, ts, cls, ALLOWED_CLASSES[cls],
            round(conf, 4),
            round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2),
            round(cx, 2), round(cy, 2), round(w, 2), round(h, 2)
        ])


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--source", required=True, help="Video file or image directory")
    p.add_argument("--output", default="output/result.csv")
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--conf", type=float, default=0.5)
    args = p.parse_args()
    run(args.source, args.model, args.output, args.conf)
