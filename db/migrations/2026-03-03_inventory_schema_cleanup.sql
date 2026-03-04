BEGIN;

-- 1) Add new lean columns to inventory_runs.
ALTER TABLE inventory_runs
    ADD COLUMN IF NOT EXISTS pantry_id INTEGER,
    ADD COLUMN IF NOT EXISTS source VARCHAR(50);

-- 2) Backfill pantry_id/source from comparison JSON payload where possible.
UPDATE inventory_runs
SET
    pantry_id = NULLIF(comparison->>'pantryId', '')::INTEGER,
    source = COALESCE(source, comparison->>'source')
WHERE pantry_id IS NULL;

-- 2a) Ensure at least one default pantry exists for legacy records.
INSERT INTO pantries (name, location, created_at)
SELECT 'Default Pantry', 'Legacy Migration', NOW()
WHERE NOT EXISTS (SELECT 1 FROM pantries LIMIT 1);

-- 2b) Assign remaining NULL pantry_id records to the first available pantry.
UPDATE inventory_runs
SET pantry_id = (SELECT id FROM pantries ORDER BY id LIMIT 1)
WHERE pantry_id IS NULL;

-- 3) Create FK + indexes for pantry-scoped run history.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_inventory_runs_pantry_id'
    ) THEN
        ALTER TABLE inventory_runs
            ADD CONSTRAINT fk_inventory_runs_pantry_id
            FOREIGN KEY (pantry_id) REFERENCES pantries(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_inventory_runs_pantry_created_at
    ON inventory_runs (pantry_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_inventory_runs_source_created_at
    ON inventory_runs (source, created_at DESC);

-- 4) Enforce pantry_id only after successful backfill.
ALTER TABLE inventory_runs
    ALTER COLUMN pantry_id SET NOT NULL;

-- 4) Enforce pantry_id only after successful backfill.
ALTER TABLE inventory_runs
    ALTER COLUMN pantry_id SET NOT NULL;

-- 5) Drop no-longer-needed run columns.
ALTER TABLE inventory_runs
    DROP COLUMN IF EXISTS ok,
    DROP COLUMN IF EXISTS count,
    DROP COLUMN IF EXISTS classification,
    DROP COLUMN IF EXISTS summary_counts,
    DROP COLUMN IF EXISTS stage;

-- 6) Drop old indexes tied to removed columns.
DROP INDEX IF EXISTS ix_inventory_runs_stage_created_at;
DROP INDEX IF EXISTS ix_inventory_runs_created_at;

-- 7) Snapshot table is now redundant (history is in inventory_runs by pantry_id).
DROP TABLE IF EXISTS warehouse_inventory_snapshots;

-- 8) Optional cleanup if you are not using legacy normalized inventory_items.
-- DROP TABLE IF EXISTS inventory_items;

COMMIT;
