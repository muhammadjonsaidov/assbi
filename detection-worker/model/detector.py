from ultralytics import YOLO
import torch

from config import ALLOWED_CLASSES, CONF_THRESHOLD, MIN_BOX_AREA

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


class Detector:

    def __init__(self, model_path="yolo26s.pt"):
        self.model = YOLO(model_path)
        print(f"[Detector] Using device: {DEVICE}")

    def detect(self, frame, roi=None):
        """
        Run YOLO inference + post-processing on a single frame.

        frame: preprocessed (letterboxed) frame
        roi: (x1, y1, x2, y2) in original coords — detections outside discarded
        Returns: list of detection dicts
        """
        results = self.model(frame, verbose=False, device=DEVICE)[0]
        return self._postprocess(results, frame.shape, roi)

    def _postprocess(self, results, frame_shape, roi):
        clean = []

        for box in results.boxes:
            cls = int(box.cls)
            conf = float(box.conf)

            # 1. Class filter
            if cls not in ALLOWED_CLASSES:
                continue

            # 2. Confidence filter
            if conf < CONF_THRESHOLD:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            # 3. Size filter
            area = (x2 - x1) * (y2 - y1)
            if area < MIN_BOX_AREA:
                continue

            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2

            # 4. ROI mask
            if roi is not None:
                rx1, ry1, rx2, ry2 = roi
                if not (rx1 <= cx <= rx2 and ry1 <= cy <= ry2):
                    continue

            clean.append({
                "cls":    cls,
                "label":  ALLOWED_CLASSES[cls],
                "conf":   round(conf, 3),
                "bbox":   [x1, y1, x2, y2],
                "centre": (cx, cy),
            })

        return clean
