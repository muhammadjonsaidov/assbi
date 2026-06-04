"""
Fine-tune YOLOv8 on custom dataset.

Expects dataset/ folder with:
    dataset/
    ├── images/{train,val,test}/
    ├── labels/{train,val,test}/
    └── data.yaml

Usage:
    python fine_tune/train.py --data dataset/data.yaml --epochs 50
"""

import argparse
from ultralytics import YOLO


def train(data_yaml, model_path, epochs, batch, imgsz, project, name, resume=False):
    model = YOLO(model_path)
    train_kwargs = dict(
        epochs=epochs,
        batch=batch,
        imgsz=imgsz,
        project=project,
        name=name,
        exist_ok=True,
        verbose=True,
        resume=resume,
    )
    if not resume:
        train_kwargs["data"] = data_yaml
    results = model.train(**train_kwargs)
    print(f"[train] Done. Results saved to {project}/{name}/")
    print(f"[train] Best weights: {project}/{name}/weights/best.pt")
    # result.csv auto-generated at {project}/{name}/results.csv
    return results


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="dataset/data.yaml")
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--project", default="runs/train")
    p.add_argument("--name", default="assbi_model")
    p.add_argument("--resume", action="store_true", help="Resume from last.pt checkpoint")
    args = p.parse_args()
    train(args.data, args.model, args.epochs, args.batch,
          args.imgsz, args.project, args.name, args.resume)
