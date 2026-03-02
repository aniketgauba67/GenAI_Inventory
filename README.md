# GenAI Inventory

Run backend and frontend. Requires Node (>=20.9) and Python 3.11+.

## Env

**Back** (`back/`)

- Create `back/.env` with your Gemini API key
  ```bash
  GEMINI_API_KEY=your_key_here
  ```
  Get a key: https://aistudio.google.com/apikey

**Front** (`front/`)

## Run

**Terminal 1 - Backend**
```bash
cd back
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend**
```bash
cd front
npm install
npm run dev
```

Open http://localhost:3000 (or the port Next.js prints). Log in with Pantry ID `admin`, password `password`, then use "I am a volunteer" -> upload photo.

## Sprint 1 - Mock Inventory Classification

Run the inventory classification script:

```bash
python back/run_inventory_classification.py
```

Check AWS RDS connectivity without writing data:

```bash
python back/check_inventory_db.py
```

Read the latest persisted inventory run:

```bash
python back/read_latest_inventory_run.py
```

Read the most recent 5 persisted inventory runs:

```bash
python back/read_recent_inventory_runs.py
```

This script:
- loads `back/data/mock_detection_result.json`
- prints the required inventory JSON object to stdout
- writes `back/output/mock_inventory_output.json`
- writes classifications to `back/output/mock_inventory_levels.json`
- defaults to `DRY_RUN=true` when database environment variables are missing
- writes one run record to the existing AWS RDS Postgres database when `DRY_RUN=false`

Environment variables:

```bash
DB_HOST=...
DB_PORT=5432
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
STAGE=dev
DRY_RUN=true
```

AWS write behavior:
- `DRY_RUN=true` skips the database write and prints the record that would be written to `stderr`
- `DRY_RUN=false` persists a run to the `inventory_runs` table in the configured RDS Postgres database
- `python back/check_inventory_db.py` verifies connectivity and whether `inventory_runs` is visible before you attempt a live write
- `python back/read_latest_inventory_run.py` reads back the newest row so you can verify the table was updated
- `python back/read_recent_inventory_runs.py` reads the latest 5 rows so you can verify recent history

Persisted record shape:
- `pk` UUID run id
- `createdAt` ISO timestamp
- `ok`, `count`
- `files` JSON array
- `inventory` JSON object
- `classification` JSON object
- `summaryCounts` JSON object

Example SQL schema shape created by the script:

```sql
CREATE TABLE inventory_runs (
  run_id varchar(36) PRIMARY KEY,
  created_at timestamp NOT NULL,
  ok boolean NOT NULL,
  count integer NOT NULL,
  files json NOT NULL,
  inventory json NOT NULL,
  classification json NOT NULL,
  summary_counts json NOT NULL,
  stage varchar(50)
);
```

Run lightweight boundary tests:

```bash
python -m unittest back/tests/test_inventory_classification.py
```
