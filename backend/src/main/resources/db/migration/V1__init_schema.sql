-- ASSBI Database Schema
-- V1: initial schema

CREATE TABLE IF NOT EXISTS zones (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    site        VARCHAR(100) NOT NULL DEFAULT 'default',
    capacity    INT          NOT NULL DEFAULT 100,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cameras (
    id          SERIAL PRIMARY KEY,
    source      VARCHAR(500) NOT NULL UNIQUE,   -- file path / RTSP URL / webcam index
    label       VARCHAR(100),
    zone_id     INT REFERENCES zones(id),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crossing_events (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMP    NOT NULL DEFAULT NOW(),
    track_id        INT          NOT NULL,
    object_type     VARCHAR(20)  NOT NULL,   -- person / car / truck / bus / motorcycle
    class_id        INT          NOT NULL,
    direction       VARCHAR(3)   NOT NULL,   -- IN / OUT
    position_x      NUMERIC(8,2),
    position_y      NUMERIC(8,2),
    camera_source   VARCHAR(500) NOT NULL,
    confidence      NUMERIC(4,3)
);

-- Partition by month for scalability (optional — enable when data grows large)
-- CREATE INDEX ON crossing_events (timestamp);
CREATE INDEX idx_crossing_timestamp   ON crossing_events (timestamp DESC);
CREATE INDEX idx_crossing_type        ON crossing_events (object_type);
CREATE INDEX idx_crossing_direction   ON crossing_events (direction);
CREATE INDEX idx_crossing_source      ON crossing_events (camera_source);

-- Materialised daily summary (refreshed nightly by scheduler)
CREATE TABLE IF NOT EXISTS daily_summaries (
    id          BIGSERIAL PRIMARY KEY,
    summary_date    DATE         NOT NULL,
    camera_source   VARCHAR(500) NOT NULL,
    object_type     VARCHAR(20)  NOT NULL,
    count_in        INT          NOT NULL DEFAULT 0,
    count_out       INT          NOT NULL DEFAULT 0,
    UNIQUE (summary_date, camera_source, object_type)
);

CREATE INDEX idx_summary_date ON daily_summaries (summary_date DESC);

-- Seed default zone
INSERT INTO zones (name, site, capacity)
VALUES ('default', 'main', 200)
ON CONFLICT (name) DO NOTHING;
