"""
Simple IoU-based tracker (no external dep).
Assigns persistent track_id to each detection across frames.
Replace with ultralytics ByteTrack when GPU available:
    model.track(frame, tracker="bytetrack.yaml")
"""

from config import TRACKER_IOU_THRESHOLD, TRACKER_MAX_MISSED


def iou(box_a, box_b):
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a + area_b - inter_area

    return inter_area / union if union > 0 else 0.0


class Track:
    def __init__(self, track_id, detection):
        self.track_id = track_id
        self.bbox = detection["bbox"]
        self.label = detection["label"]
        self.cls = detection["cls"]
        self.conf = detection.get("conf", 0.0)
        self.centre = detection["centre"]
        self.missed_frames = 0
        self.history = [detection["centre"]]  # trajectory


class SimpleTracker:

    def __init__(self, iou_threshold=TRACKER_IOU_THRESHOLD, max_missed=TRACKER_MAX_MISSED):
        self.iou_threshold = iou_threshold
        self.max_missed = max_missed
        self.tracks: list[Track] = []
        self._next_id = 1

    def update(self, detections):
        """
        Match detections to existing tracks via IoU.
        Returns list of active Track objects (each has track_id).
        """
        matched_track_ids = set()
        matched_det_indices = set()

        # Match detections to tracks
        for track in self.tracks:
            best_iou = self.iou_threshold
            best_det_idx = None

            for i, det in enumerate(detections):
                if i in matched_det_indices:
                    continue
                score = iou(track.bbox, det["bbox"])
                if score > best_iou:
                    best_iou = score
                    best_det_idx = i

            if best_det_idx is not None:
                det = detections[best_det_idx]
                track.bbox = det["bbox"]
                track.centre = det["centre"]
                track.label = det["label"]
                track.cls = det["cls"]
                track.conf = det.get("conf", 0.0)
                track.missed_frames = 0
                track.history.append(det["centre"])
                matched_track_ids.add(track.track_id)
                matched_det_indices.add(best_det_idx)
            else:
                track.missed_frames += 1

        # Remove stale tracks
        self.tracks = [t for t in self.tracks if t.missed_frames <= self.max_missed]

        # Create new tracks for unmatched detections
        for i, det in enumerate(detections):
            if i not in matched_det_indices:
                self.tracks.append(Track(self._next_id, det))
                self._next_id += 1

        return [t for t in self.tracks if t.missed_frames == 0]
