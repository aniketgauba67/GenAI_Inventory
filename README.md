# GenAI Inventory

Run backend and frontend. Requires Node (≥20.9) and Python 3.11+.

## Env

**Back** (`back/`)

- Create `back/.env` with your Gemini API key 
  ```
  GEMINI_API_KEY=your_key_here
  ```
  Get a key: https://aistudio.google.com/apikey

**Front** (`front/`)

## Run

**Terminal 1 – Backend**
```bash
cd back
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 – Frontend**
```bash
cd front
npm install
npm run dev
```

Open http://localhost:3000 (or the port Next.js prints). Log in with Pantry ID `admin`, password `password`, then use “I am a volunteer” → upload photo.
