# GenAI Inventory

Volunteer inventory workflow:
- upload shelf photos
- detect item counts in the fixed 19 categories with Gemini
- review and edit the detected counts
- submit the reviewed inventory
- compute current inventory levels from the previous stored snapshot
- store the result in Postgres

## Project Structure

- `back/`: FastAPI backend, Gemini integration, helper scripts
- `front/`: Next.js frontend for login, upload, and review
- `db/`: SQLAlchemy database models and connection setup

## Fixed Categories

The project uses only these 19 categories:

- `Beverages`
- `Juices`
- `Cereal`
- `Breakfast`
- `Meat`
- `Fish`
- `Poultry`
- `Frozen`
- `Vegetables`
- `Fruits`
- `Nuts`
- `Soup`
- `Grains`
- `Pasta`
- `Snacks`
- `Spices`
- `Sauces`
- `Condiments`
- `Misc Products`

## Backend Env

Create [back/.env](/Users/aniketgauba/Documents/GitHub/GenAI_Inventory/back/.env):

```env
DB_HOST=inventory-db.cdkgm4c2klqg.us-east-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=inventory
DB_USER=admin0
DB_PASSWORD=your_password_here
GEMINI_API_KEY=your_gemini_key_here
DRY_RUN=false
```

Backend scripts load `back/.env` directly.

## Backend Setup

```bash
cd back
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend URLs:
- `http://localhost:8000`
- `http://localhost:8000/docs`

## Frontend Setup

```bash
cd front
npm install
npm run dev
```

Frontend URL:
- `http://localhost:3000`

Current demo login:
- Pantry ID: `admin`
- Password: `password`

That login currently maps to pantry id `1`.

## Full UI Workflow

1. Start the backend
2. Start the frontend
3. Open `http://localhost:3000/login`
4. Log in with `admin` / `password`
5. Upload a shelf photo
6. Review the detected counts
7. Edit values if needed
8. Click `Submit inventory`
9. Review the returned ratio and `High / Mid / Low` level for each category

## Upload Endpoint

Direct upload with `curl`:

```bash
curl -X POST http://localhost:8000/upload \
  -F "files=@/full/path/to/your-image.jpg" \
  -F "pantry_id=1"
```

That route:
- validates image files
- sends the first image to Gemini
- returns detected inventory
- stores a draft for the review page

## Volunteer Submit Endpoint

The active workflow computes status from:

```text
current stock / previous stored stock
```

Thresholds:
- `High` if ratio `> 0.70`
- `Mid` if ratio `> 0.30` and `<= 0.70`
- `Low` if ratio `<= 0.30`

First submit for pantry `1`:

```bash
curl -X POST http://localhost:8000/volunteer/inventory/submit \
  -H "Content-Type: application/json" \
  -d '{
    "pantryId": "1",
    "inventory": {
      "Beverages": 10,
      "Juices": 5,
      "Cereal": 20,
      "Breakfast": 8,
      "Meat": 4,
      "Fish": 3,
      "Poultry": 6,
      "Frozen": 7,
      "Vegetables": 12,
      "Fruits": 9,
      "Nuts": 2,
      "Soup": 5,
      "Grains": 11,
      "Pasta": 13,
      "Snacks": 15,
      "Spices": 6,
      "Sauces": 4,
      "Condiments": 3,
      "Misc Products": 1
    }
  }'
```

Second submit for pantry `1`:

```bash
curl -X POST http://localhost:8000/volunteer/inventory/submit \
  -H "Content-Type: application/json" \
  -d '{
    "pantryId": "1",
    "inventory": {
      "Beverages": 5,
      "Juices": 2,
      "Cereal": 14,
      "Breakfast": 4,
      "Meat": 1,
      "Fish": 1,
      "Poultry": 3,
      "Frozen": 2,
      "Vegetables": 6,
      "Fruits": 4,
      "Nuts": 1,
      "Soup": 2,
      "Grains": 8,
      "Pasta": 7,
      "Snacks": 10,
      "Spices": 4,
      "Sauces": 2,
      "Condiments": 1,
      "Misc Products": 0
    }
  }'
```

## Verify Database State

List pantries:

```bash
python back/list_pantries.py
```

Read the latest stored run:

```bash
python back/read_latest_inventory_run.py
```

Read the most recent 5 runs:

```bash
python back/read_recent_inventory_runs.py
```

Run the automated backend workflow check:

```bash
python back/run_volunteer_workflow_check.py
```

That helper script:
- posts a sample volunteer submission
- reads the latest row from `inventory_runs`

## Tests

Run the active workflow/domain tests:

```bash
python -m unittest back/tests/test_inventory_domain.py
```

## Important Note

`db/init_db()` is currently destructive because it drops tables before recreating them. Do not use it against shared or production-like data unless you explicitly intend to wipe tables.
