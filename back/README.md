# Backend (FastAPI)

## Setup

```bash
cd back
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
uvicorn main:app --reload --port 8000
```

`POST /upload` will:

1. Save images to `uploads/`
2. Send the first image to Gemini with the default prompt: "Briefly describe what you see in this image."
3. Return `{ "ok": true, "files": [...], "gemini": { "text": "..." } }` when the key is set.

Optional query param: `?prompt=Your custom prompt` to override the prompt.

## Run

```bash
uvicorn main:app --reload --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
