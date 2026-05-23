"""
Virtual line crossing detector.

Line defined by two points: (x1,y1) → (x2,y2).
Direction determined by which side of the line the object was on previously.
Counts: IN (crosses left-to-right or top-to-bottom) / OUT (opposite).
"""


def _side(point, line_start, line_end):
    """Returns sign of cross product — determines which side of line point is on."""
    px, py = point
    lx1, ly1 = line_start
    lx2, ly2 = line_end
    return (lx2 - lx1) * (py - ly1) - (ly2 - ly1) * (px - lx1)


class LineCrossingDetector:

    def __init__(self, line_start, line_end):
        """
        line_start, line_end: (x, y) tuples in original frame coordinates.
        """
        self.line_start = line_start
        self.line_end = line_end
        self._prev_sides: dict[int, float] = {}  # track_id → previous side sign
        self.counts = {"IN": {}, "OUT": {}}       # direction → {label: count}

    def update_line(self, line_start, line_end):
        self.line_start = line_start
        self.line_end = line_end
        self._prev_sides.clear()

    def check(self, tracks):
        """
        Check each active track for line crossing.
        Returns list of crossing events: {track_id, label, direction}
        """
        events = []

        for track in tracks:
            tid = track.track_id
            cx, cy = track.centre
            current_side = _side((cx, cy), self.line_start, self.line_end)

            if tid in self._prev_sides:
                prev_side = self._prev_sides[tid]

                # Crossing detected when sign flips
                if prev_side * current_side < 0:
                    direction = "IN" if current_side < 0 else "OUT"
                    label = track.label

                    if label not in self.counts[direction]:
                        self.counts[direction][label] = 0
                    self.counts[direction][label] += 1

                    events.append({
                        "track_id":  tid,
                        "label":     label,
                        "cls":       track.cls,
                        "conf":      track.conf,
                        "direction": direction,
                        "position":  (cx, cy),
                    })

            self._prev_sides[tid] = current_side

        # Clean up tracks that disappeared
        active_ids = {t.track_id for t in tracks}
        stale = [tid for tid in self._prev_sides if tid not in active_ids]
        for tid in stale:
            del self._prev_sides[tid]

        return events

    def get_counts(self):
        return self.counts
