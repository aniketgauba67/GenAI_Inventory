# Backend (FastAPI)

**Module:** Backend README
**Purpose:** Documents the FastAPI backend, environment variables, and API startup workflow.

**The document provides:**
- backend setup commands.
- Gemini environment variable notes.
- API startup instructions.

**Key Structures Used:**
- backend virtualenv, Python requirements, and FastAPI entrypoint.

**This document ensures:**
- backend contributors can install dependencies locally.
- API startup notes stay near backend code.

**Editors:** Aniket, Dipanker, Liam, Jin, and Philip.

## Setup

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Gemini API

To send uploaded images to Gemini, set one of:

- `GEMINI_API_KEY` or
- `GOOGLE_API_KEY`

Get a key: https://aistudio.google.com/apikey

Then run:

```bash
export GEMINI_API_KEY=your_key_here
uvicorn back.main:app --reload --port 8000
```

If your terminal is already in `back/`, use:

```bash
uvicorn main:app --reload --port 8000
```

`POST /upload` will:

1. Validate uploaded image files.
2. Send shelf photos to Gemini for 19-category inventory extraction.
3. Return `{ "ok": true, "files": [...], "inventory": { ... } }` when detection succeeds.

## Run

```bash
uvicorn back.main:app --reload --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
