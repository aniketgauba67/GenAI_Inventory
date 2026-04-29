# Testing Guide

This document describes the test suite for GenAI Inventory — a food pantry inventory management system with a FastAPI backend and Next.js frontend.

---

## Overview

| Layer | Framework | Location | Command |
|---|---|---|---|
| Backend unit | pytest | `back/tests/unit/` | `back/.venv/bin/python -m pytest back/tests/unit/` |
| Backend API | pytest + httpx TestClient | `back/tests/api/` | `back/.venv/bin/python -m pytest back/tests/api/` |
| Backend integration | pytest | `back/tests/integration/` | `back/.venv/bin/python -m pytest back/tests/integration/` |
| Backend edge cases | pytest | `back/tests/edge_cases/` | `back/.venv/bin/python -m pytest back/tests/edge_cases/` |
| Frontend unit | Jest | `front/__tests__/unit/` | `npm test -- --testPathPattern=unit` |
| Frontend component | Jest + RTL | `front/__tests__/component/` | `npm test -- --testPathPattern=component` |
| Frontend integration | Jest | `front/__tests__/integration/` | `npm test -- --testPathPattern=integration` |
| End-to-end | Playwright | `front/e2e/` | `npm run test:e2e` |
| Frontend validation | ESLint + Next build + TypeScript | `front/` | `npm run lint && npm run build && npx tsc --noEmit` |

---

## Quick Start

### Backend

```bash
# Install test dependencies
back/.venv/bin/pip install -r back/requirements-dev.txt

# Run all backend tests from repo root
back/.venv/bin/python -m pytest back/tests

# With coverage report
back/.venv/bin/python -m pytest back/tests --cov=back --cov-report=html
```

### Frontend

```bash
cd front

# Run all Jest tests
npm test

# With coverage
npm run test:coverage

# Frontend quality gates
npm run lint
npm run build
npx tsc --noEmit

# Watch mode (re-runs on file change)
npm run test:watch

# Specific suites
npm run test:unit
npm run test:component
npm run test:integration
```

> `npx tsc --noEmit` depends on Next-generated route types in `.next/types/`. If you are on a clean checkout or just deleted `.next/`, run `npm run build` once before the standalone TypeScript check.

### End-to-End

```bash
cd front

# Install Playwright browsers (first time only)
npx playwright install

# Run with local dev server auto-started
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui
```

> **Authenticated e2e tests** are skipped unless you set:
> ```bash
> export PLAYWRIGHT_PANTRY_ID=<pantry-id>
> export PLAYWRIGHT_PANTRY_PASSWORD=<password>
> ```

---

## Backend Test Structure

```
back/
  tests/
    conftest.py               # Shared client and mock DB fixtures
    test_auth_schedule_validation.py
    fixtures/
      data.py                 # make_pantry(), make_run(), VALID_LOGIN_*, etc.
    unit/
      test_inventory_domain_extended.py # Core inventory domain behavior and edge cases
      test_operating_hours_extended.py  # parse_hhmm, normalize_operating_hours
      test_password_utils.py            # bcrypt hash/verify
      test_customer_inventory_state.py  # resolve_customer_inventory_state
      test_customer_router_helpers.py   # _time_to_minutes, _is_within_schedule
    api/
      conftest.py             # Placeholder for api-specific fixtures; shared client lives in root conftest
      test_auth.py            # Login, credentials CRUD, status toggle, schedule
      test_customer.py        # GET /customer/pantries, /pantries-by-time
      test_upload.py          # POST /upload (Gemini mocked), GET /categories
      test_chat.py            # POST /chat/message (Gemini mocked)
      test_volunteer.py       # POST /volunteer/inventory/submit, /warehouse/snapshot
    integration/
      test_workflows.py       # Upload → submit → level resolution end-to-end
    edge_cases/
      test_edge_cases.py      # Extreme values, boundary inputs, malformed data
```

### Key Mocking Patterns

**Gemini AI** (all routes that call it are mocked at module level):
```python
@patch("back.routers.upload.call_gemini_inventory_images", return_value={...})
@patch("back.routers.chat.call_gemini_chat", return_value="reply text")
```

**Shared TestClient and mock DB** come from the root backend conftest:
```python
# In back/tests/conftest.py
@pytest.fixture(scope="module")
def client():
    return TestClient(app, raise_server_exceptions=True)
```

**Auth router** imports `db.crud` at module level:
```python
@patch("db.crud.get_pantry_credential_by_id", return_value=mock_cred)
```

**Customer/upload routers** import `SessionLocal` at load time — patch at the router:
```python
@patch("back.routers.customer.SessionLocal", return_value=mock_session)
@patch("back.routers.upload.SessionLocal", return_value=mock_session)
@patch("routers.volunteer_inventory.SessionLocal", return_value=mock_session)
```

### Markers

Run tests by marker:
```bash
back/.venv/bin/python -m pytest -m unit          # Domain logic only
back/.venv/bin/python -m pytest -m api           # HTTP endpoint tests
back/.venv/bin/python -m pytest -m integration   # Multi-step workflows
back/.venv/bin/python -m pytest -m edge_cases    # Extreme input handling
```

---

## Frontend Test Structure

```
front/
  jest.config.js              # Jest config (uses next/jest)
  jest.setup.ts               # @testing-library/jest-dom import
  __tests__/
    mocks/
      handlers.ts             # MSW request handlers (reference; not used in jest.setup)
      server.ts               # MSW server export
    fixtures/
      index.ts                # mockPantries, makeLevels(), apiPantriesOk, etc.
    unit/
      api.test.ts             # getApiBase() function
      formatters.test.ts      # formatRelativeTime() helper
    component/
      Alert.test.tsx          # Alert variants, ARIA roles
      Button.test.tsx         # Variants, disabled, type, sizes
      CategoryGroupEditor.test.tsx  # 5 groups, 19 inputs, onChange
      ConfirmModal.test.tsx   # Dialog ARIA, focus trap, Escape key
      FlowStepper.test.tsx    # Labels, current step, spinner status
      FloatingChat.test.tsx   # Full chat UX with fetch mocked
      LevelBadge.test.tsx     # Short/friendly text, role=img, colors
      Select.test.tsx         # Options, value, onChange, disabled
      Skeleton.test.tsx       # ARIA hidden, shimmer element
    integration/
      chat-api-route.test.ts  # Next.js POST /api/chat route handler (node env)
```

### Mocking Conventions

**`fetch`** — mocked with `jest.fn()` in tests that need network calls:
```ts
const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReturnValue(Promise.resolve({ ok: true, json: async () => data }));
  global.fetch = mockFetch as typeof fetch;
});
```

**`next/image`** — mocked to a plain `<img>` in any test that renders components using it:
```ts
jest.mock("next/image", () => ({ __esModule: true, default: (props) => <img {...props} /> }));
```

**`react-markdown` / `remark-gfm`** — mocked to avoid ESM parse errors (both packages are pure ESM):
```ts
jest.mock("react-markdown", () => ({ __esModule: true, default: ({ children }) => <span>{children}</span> }));
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => undefined }));
```

**Next.js API route tests** run in `@jest-environment node` (top-of-file docblock) so that `Request`/`Response` globals are available.

**`scrollTo`** — stubbed in FloatingChat tests since jsdom doesn't implement it:
```ts
beforeAll(() => { window.HTMLElement.prototype.scrollTo = jest.fn(); });
```

### Coverage Thresholds

Defined in `jest.config.js`. Enforced on `npm run test:coverage`:

| Metric | Minimum |
|---|---|
| Branches | 60% |
| Functions | 60% |
| Lines | 60% |
| Statements | 60% |

Coverage is collected from `components/**`, `lib/**`, and `app/api/**`.

---

## End-to-End Tests (Playwright)

```
front/e2e/
  login.spec.ts            # Login form, validation, redirect behavior
  upload-workflow.spec.ts  # Upload page (authenticated, requires env vars)
  customer-view.spec.ts    # Home page, chat widget, time search, Easy View
```

**Config:** `front/playwright.config.ts`
- Base URL: `http://localhost:3000`
- Browsers: Chromium (desktop) + iPhone 13 (mobile Safari)
- Dev server auto-starts before tests via `webServer`
- Retries: 2 in CI, 0 locally
- Screenshots/video on failure only

---

## Test Data & Fixtures

### Backend (`back/tests/fixtures/data.py`)

| Helper | Returns |
|---|---|
| `make_pantry(**overrides)` | SimpleNamespace mock pantry |
| `make_run(**overrides)` | SimpleNamespace mock InventoryRun |
| `make_full_inventory(default=10)` | Dict with all 19 categories |
| `make_sparse_inventory(**categories)` | Zeros + provided overrides |
| `VALID_LOGIN_DIRECTOR` | `{"username": "director", "password": "..."}` |
| `VALID_LOGIN_PANTRY` | `{"username": "1", "password": "..."}` |
| `PANTRY_OPEN` / `PANTRY_CLOSED` | Pre-built pantry fixtures |

### Frontend (`front/__tests__/fixtures/index.ts`)

| Export | Description |
|---|---|
| `INVENTORY_CATEGORIES` | All 19 category names |
| `makeLevels(level?)` | Map of category → level |
| `makeQuantities(qty?)` | Map of category → number |
| `mockPantryOpen` / `mockPantryClosed` | Full mock pantry objects |
| `mockPantries` | Array of 2 mock pantries |
| `apiPantriesOk` | `{ ok: true, pantries: [...] }` |
| `apiChatReply` | `{ ok: true, reply: "..." }` |

---

## Business Logic Under Test

### Inventory Domain (`back/inventory_domain.py`)

| Threshold | Level |
|---|---|
| qty ≤ 0 | Out |
| qty ≤ 30% of baseline | Low |
| qty ≤ 70% of baseline | Mid |
| qty > 70% of baseline | High |

All 4 boundary conditions are tested, including `qty == 0`, `qty == baseline * 0.30`, `qty == baseline * 0.70`.

### Stock Level Resolution (`back/routers/customer.py`)

Priority order for customer-facing inventory display:
1. **Volunteer-submitted inventory** when the latest `source="volunteer-submit"` run is the same time or newer than the latest warehouse snapshot
2. **Warehouse inventory** from the latest `source="warehouse-snapshot"` run
3. **Fallback pantry item data** when neither run exists

Tested in `back/tests/unit/test_customer_inventory_state.py` and `back/tests/integration/test_workflows.py`.

### Operating Hours

`parse_hhmm("HH:MM")` → minutes since midnight.
`normalize_operating_hours(hours)` → sorted list by canonical day order (mon→sun).
`_is_within_schedule(time, open, close)` → handles midnight-crossing windows.

---

## CI Integration Notes

- Backend: `back/.venv/bin/python -m pytest back/tests --tb=short -q` from repo root
- Frontend unit/component/integration: `npm test -- --ci --passWithNoTests` from `front/`
- Frontend validation: `npm run lint && npm run build && npx tsc --noEmit` from `front/`
- E2E: `npm run test:e2e` — requires a running dev server or use `CI=true` to let Playwright start one
- E2E authenticated tests skip automatically unless env vars are set

---

## Known Limitations

- **MSW (Mock Service Worker) v2** is installed but not used in Jest tests because its ESM dependencies (`rettime`, `@mswjs/interceptors`) cannot be transformed in Jest's jsdom/node environments without additional configuration. Fetch is mocked with `jest.fn()` instead. MSW handlers in `__tests__/mocks/` are retained as reference for future migration.
- **`react-markdown` and `remark-gfm`** are pure ESM packages. They are mocked in the FloatingChat component test. Playwright e2e tests render these normally.
- **Director dashboard** (`dashboard-client.tsx`) is not unit-tested — it is a 1,300-line client component with complex server interaction that is best covered by e2e tests.
- **AWS S3** persistence is not tested — the upload route's S3 calls should be mocked in future tests using `@patch("routers.upload.upload_to_s3", ...)`.
