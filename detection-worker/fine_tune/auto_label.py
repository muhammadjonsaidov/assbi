"""
Auto-label images using YOLO model → YOLO format .txt labels.

Output structure:
    dataset/
    ├── images/{train,valid,test}/
    ├── labels/{train,valid,test}/
    └── data.yaml

Usage:
    python fine_tune/auto_label.py --source /path/to/frames --output dataset
    python fine_tune/auto_label.py --source /path/to/frames --output dataset --conf 0.4 --split 0.8 0.15 0.05
"""

import argparse
import os
import random
import shutil
from pathlib import Path

from ultralytics import YOLO

# COCO indices → our dataset class indices
CLASS_MAP = {2: 0, 3: 1, 5: 2, 7: 3}  # car→0, motorcycle→1, bus→2, truck→3
CLASS_NAMES = ["car", "motorcycle", "bus", "truck"]

DATA_YAML = """\
train: train/images
val: valid/images
test: test/images

nc: 4
names: {names}
"""


def auto_label(source, output, model_path, conf, split):
    model = YOLO(model_path)
    images = sorted(Path(source).glob("*.jpg")) + \
             sorted(Path(source).glob("*.jpeg")) + \
             sorted(Path(source).glob("*.png"))

    if not images:
        print(f"[auto_label] No images found in {source}")
        return

    print(f"[auto_label] Found {len(images)} images")

    random.shuffle(images)
    n = len(images)
    n_train = int(n * split[0])
    n_val   = int(n * split[1])
    splits  = {
        "train": images[:n_train],
        "valid": images[n_train:n_train + n_val],
        "test":  images[n_train + n_val:],
    }

    out = Path(output)
    for subset, imgs in splits.items():
        (out / "images" / subset).mkdir(parents=True, exist_ok=True)
        (out / "labels"  / subset).mkdir(parents=True, exist_ok=True)

        labeled = 0
        skipped = 0
        for img_path in imgs:
            results = model(str(img_path), verbose=False, conf=conf)[0]
            boxes = [b for b in results.boxes if int(b.cls) in CLASS_MAP]

            if not boxes:
                skipped += 1
                continue

            dest_img = out / "images" / subset / img_path.name
            shutil.copy2(img_path, dest_img)

            label_path = out / "labels" / subset / (img_path.stem + ".txt")
            h, w = results.orig_shape
            with open(label_path, "w") as f:
                for box in boxes:
                    new_cls = CLASS_MAP[int(box.cls)]
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    cx = (x1 + x2) / 2 / w
                    cy = (y1 + y2) / 2 / h
                    bw = (x2 - x1) / w
                    bh = (y2 - y1) / h
                    f.write(f"{new_cls} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}\n")
            labeled += 1

        print(f"[auto_label] {subset}: {labeled} labeled, {skipped} skipped (no detections)")

    yaml_path = out / "data.yaml"
    yaml_path.write_text(DATA_YAML.format(names=CLASS_NAMES))
    print(f"[auto_label] Done → {output}/")
    print(f"[auto_label] data.yaml: {yaml_path}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--source", required=True, help="Folder with images")
    p.add_argument("--output", default="dataset")
    p.add_argument("--model",  default="yolo26s.pt")
    p.add_argument("--conf",   type=float, default=0.4)
    p.add_argument("--split",  type=float, nargs=3, default=[0.8, 0.15, 0.05],
                   metavar=("TRAIN", "VAL", "TEST"))
    args = p.parse_args()
    auto_label(args.source, args.output, args.model, args.conf, args.split)