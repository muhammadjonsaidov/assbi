-- V2: schema redesign — drop dead tables, clear data, add constraints + composite index

-- Drop tables that have no JPA entities and are never queried
DROP TABLE IF EXISTS cameras;
DROP TABLE IF EXISTS zones;

-- Clean start — wipe all data
TRUNCATE TABLE crossing_events;
TRUNCATE TABLE daily_summaries;

-- Remove class_id: object_type string already encodes the same information
ALTER TABLE crossing_events DROP COLUMN IF EXISTS class_id;

-- Drop 4 narrow indexes — replaced by a single composite covering index below
DROP INDEX IF EXISTS idx_crossing_timestamp;
DROP INDEX IF EXISTS idx_crossing_type;
DROP INDEX IF EXISTS idx_crossing_direction;
DROP INDEX IF EXISTS idx_crossing_source;

-- Composite covering index for the hot query path:
--   WHERE timestamp BETWEEN ? AND ? GROUP BY object_type, direction
CREATE INDEX idx_crossing_composite
    ON crossing_events (timestamp DESC, object_type, direction);

-- Data-integrity constraints (added after TRUNCATE so no existing rows can violate them)
ALTER TABLE crossing_events
    ADD CONSTRAINT chk_direction
        CHECK (direction IN ('IN', 'OUT')),
    ADD CONSTRAINT chk_object_type
        CHECK (object_type IN ('person', 'car', 'truck', 'bus', 'motorcycle'));