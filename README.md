# GenAI Inventory

Volunteer inventory workflow:
- upload shelf photos
- detect item counts in the fixed 19 categories with Gemini
- store the latest warehouse form totals in the database
- review and edit the detected counts
- submit the reviewed inventory
- compute current inventory levels from the latest warehouse import
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
5. Make sure a warehouse import exists for that pantry
6. Upload a shelf photo
7. Review the detected counts
8. Edit values if needed
9. Click `Submit inventory`
10. Review the returned ratio and `High / Mid / Low` level for each category

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

## Warehouse Import Endpoint

The pulled schema stores warehouse form imports in `inventory_runs` too, using:
- `source = "warehouse-snapshot"`
- `inventory = parsed warehouse totals`
- `comparison.note = optional import context`

Why this matters:
- this warehouse row is the denominator source for later volunteer ratio calculations
- the newest `warehouse-snapshot` row for a pantry is the one the backend compares against

Store a parsed warehouse form with:

```bash
curl -X POST http://localhost:8000/warehouse/inventory/snapshot \
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
    },
    "files": []
  }'
```

Notes for order-form extraction:
- Upload all pages of the same form in one request.
- Backend parses each page and sums category totals across pages.
- Extraction uses handwritten `Amount Shipped` values as-is (no unit-size/case multiplication).

Use your manager form extraction platform to send real warehouse totals to:
`POST /warehouse/inventory/snapshot`.

## Volunteer Submit Endpoint

The active workflow computes status from:

```text
current pantry stock / latest warehouse import
```

Thresholds:
- `High` if ratio `> 0.70`
- `Mid` if ratio `> 0.30` and `<= 0.70`
- `Out` if ratio `== 0`
- `Low` if ratio `> 0` and `<= 0.30`

Volunteer submit is stored in `inventory_runs` with:
- `source = "volunteer-submit"`
- `inventory = current reviewed pantry stock`
- `comparison.warehouseRunId = the warehouse run used as denominator`
- `comparison.ratios = computed category ratios`
- `comparison.levels = computed High / Mid / Low values`
- `comparison.summaryCounts = High / Mid / Low totals`

This keeps the table schema lean while still preserving the full calculation context in one row.

Example volunteer submit for pantry `1`:

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

## Frontend Quality Checks (Day 7)

Run lint:

```bash
cd front
npm run lint
```

Manual verification checklist:

1. Volunteer flow:
   - Upload page shows stepper + empty state before files.
   - Detection succeeds and redirects to review.
   - Review page allows edit + sticky submit button works on mobile.
2. Manager flow:
   - Upload order-form pages, click extract, redirect to review.
   - Review page grouped categories are editable.
   - Sticky save baseline button works on mobile.
3. Director flow:
   - Dashboard filters/search work.
   - Removing pantry credentials requires confirmation modal.
4. Account switching:
   - `Switch account` always returns to `/` for role selection.
5. Accessibility quick pass:
   - Keyboard navigation reaches all key controls.
   - Focus rings are visible on buttons/inputs.
   - Alerts are announced for status/error messages.

## Important Note

`db/init_db()` is currently destructive because it drops tables before recreating them. Do not use it against shared or production-like data unless you explicitly intend to wipe tables.
