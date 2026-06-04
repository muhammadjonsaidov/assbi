import cv2
import numpy as np

from config import LETTERBOX_SIZE

# Single shared CLAHE instance — creating per-frame was wasting ~5ms each call
_clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))


def letterbox(frame, target=LETTERBOX_SIZE):
    """Resize preserving aspect ratio, pad to square. No distortion."""
    h, w = frame.shape[:2]
    scale = target / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((target, target, 3), 114, dtype=np.uint8)
    pad_top  = (target - new_h) // 2
    pad_left = (target - new_w) // 2
    canvas[pad_top:pad_top + new_h, pad_left:pad_left + new_w] = resized
    return canvas, scale, pad_top, pad_left


def denoise(frame):
    """Remove noise from compressed video streams (RTSP/YouTube artifacts)."""
    return cv2.fastNlMeansDenoisingColored(frame, None, h=6, hColor=6,
                                           templateWindowSize=7, searchWindowSize=21)


def enhance_contrast(frame):
    """CLAHE on L channel — improves detection in shadows and low-light."""
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = _clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def preprocess(frame, denoise_enabled=False, contrast_enabled=True):
    """
    Full pre-processing pipeline before YOLO inference.
    denoise_enabled: expensive (~30ms). Enable only for heavy RTSP compression.
    contrast_enabled: cheap (~2ms with singleton CLAHE). Recommended for all sources.
    """
    if denoise_enabled:
        frame = denoise(frame)
    if contrast_enabled:
        frame = enhance_contrast(frame)
    letterboxed, scale, pad_top, pad_left = letterbox(frame)
    return letterboxed, scale, pad_top, pad_left


def unpad_coords(x1, y1, x2, y2, scale, pad_top, pad_left):
    """Convert letterboxed coordinates back to original frame coordinates."""
    x1 = (x1 - pad_left) / scale
    y1 = (y1 - pad_top)  / scale
    x2 = (x2 - pad_left) / scale
    y2 = (y2 - pad_top)  / scale
    return x1, y1, x2, y2