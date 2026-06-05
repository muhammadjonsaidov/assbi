# ASSBI — Smart Surveillance Business Intelligence

Real-time vehicle detection and traffic analytics system. Detects cars, buses, and trucks crossing a virtual line in live video, stores crossing events in PostgreSQL, and surfaces analytics through a React dashboard.

---

## Architecture

```
┌─────────────────────┐     frames/:5000      ┌──────────────────┐
│  Detection Worker   │ ──────────────────────▶│  React Frontend  │
│  (Python + YOLO)    │                        │  :3000           │
│                     │ POST /api/events        └──────────────────┘
│  Sources:           │ ──────────────────────▶┌──────────────────┐
│  • Webcam           │                        │  Spring Boot API │
│  • Local file       │◀────────────────────── │  :8080           │
│  • RTSP             │  GET /api/worker/start  └────────┬─────────┘
│  • YouTube          │                                  │ JDBC
└─────────────────────┘                        ┌─────────▼────────┐
                                               │   PostgreSQL     │
                                               │   :5432          │
                                               └──────────────────┘
```

---

## Quick Start

**Prerequisites:** Docker, Java 21, Maven, Node.js 18+, Python 3.10+

```bash
# 1. Clone and install frontend deps (once)
make install

# 2. Start everything (PostgreSQL + Backend + Frontend)
./start.sh

# 3. Open browser
http://localhost:3000
```

---

## Components

### Detection Worker (`detection-worker/`)

Python process managing video ingestion, YOLO inference, object tracking, and line-crossing detection.

```bash
cd detection-worker
python -m venv venv && source venv/bin/activate
pip install ultralytics opencv-python yt-dlp requests

# Run manually (backend manages this via UI)
python main.py --source 0                              # webcam
python main.py --source video.mp4                      # local file
python main.py --source rtsp://192.168.1.10/stream     # RTSP
python main.py --source https://youtube.com/watch?v=…  # YouTube
```

**Key flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--source` | `0` | Video source |
| `--line` | diagonal | Crossing line `x1,y1,x2,y2` |
| `--frame-skip` | `3` | Process every Nth frame |
| `--model` | `runs/detect/runs/train/assbi_model/weights/best.pt` | YOLO model path |
| `--denoise` | off | Enable denoising (heavy compression) |

**Config** (`config.py`):

```python
CONF_THRESHOLD  = 0.45   # detection confidence
FRAME_SKIP      = 3      # higher = faster, less accurate
TRACKER_MAX_MISSED = 8   # frames before track is dropped
```

**Tracked classes** (fine-tuned model):

| ID | Class |
|----|-------|
| 0  | car   |
| 1  | motorcycle |
| 2  | bus   |
| 3  | truck |

**Fine-tuning** (`fine_tune/`):

```bash
# Auto-label frames from a folder using existing model
python fine_tune/auto_label.py --frames /path/to/frames --output dataset/

# Train
python fine_tune/train.py --data dataset/data.yaml --epochs 50 --batch 4
```

---

### Backend (`backend/`)

Spring Boot 3 REST API with Java 21 virtual threads.

```bash
cd backend
mvn spring-boot:run
```

**Key endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/events` | Ingest crossing event |
| `GET` | `/api/events/counts?minutes=60` | Live counts per type/direction |
| `GET` | `/api/events/hourly-summary?hours=24` | Hourly breakdown |
| `POST` | `/api/worker/start?source=…` | Start detection worker |
| `POST` | `/api/worker/stop` | Stop worker |
| `GET` | `/api/worker/status` | Worker running state |
| `POST` | `/api/chat` | AI assistant query |

**Database** (PostgreSQL via Docker):

```
Host: localhost:5432
DB:   assbi
User: assbi / assbi123
```

Migrations in `backend/src/main/resources/db/migration/`.

**Environment overrides:**

```bash
DB_URL=jdbc:postgresql://host:5432/assbi
DB_USER=assbi
DB_PASSWORD=assbi123
CORS_ORIGINS=http://localhost:3000
DATA_RETENTION_DAYS=90
```

---

### Frontend (`frontend/`)

React + Vite dashboard, four panels:

- **Live Feed** — annotated video from frame server (`localhost:5000`)
- **Analytics & Intelligence** — live distribution pie chart (1s refresh) + hourly line chart (10s refresh)
- **AI Surveillance Assistant** — chat interface querying crossing data
- **Reports & Live Stats** — real-time IN/OUT/TOTAL per vehicle type

```bash
cd frontend
npm install
npm run dev        # dev server :3000
npm run build      # production build
```

Config in `frontend/src/config.js`:

```js
backendUrl:          'http://localhost:8080'
frameServerUrl:      'http://localhost:5000'
statsPollingMs:      5000
statsWindowMinutes:  60
framePollMs:         50
```

---

## Management Scripts

```bash
./start.sh                  # start all (DB + backend + frontend)
./stop.sh                   # stop all
./status.sh                 # check what's running
./refresh.sh                # restart backend + worker
./refresh.sh backend        # backend only
./refresh.sh frontend       # frontend only
./refresh.sh worker         # worker only
./refresh.sh all            # full restart
make logs                   # tail all logs live
```

Logs: `logs/backend.log`, `logs/frontend.log`, `logs/worker.log`

---

## Model

Custom YOLO model fine-tuned on ~2040 highway traffic frames.

- **Base**: yolo26s (COCO pre-trained)
- **Dataset**: auto-labeled from own frames via `fine_tune/auto_label.py`
- **mAP50**: 0.805
- **Weights**: `detection-worker/runs/detect/runs/train/assbi_model/weights/best.pt`

To swap model, update `MODEL_PATH` in `config.py` or set env var:

```bash
MODEL_PATH=/path/to/model.pt python main.py --source 0
```
