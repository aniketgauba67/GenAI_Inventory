# Deployment

**Module:** Deployment Guide
**Purpose:** Documents how to host GenAI Inventory for free using Supabase, Render, and Vercel.

**The document provides:**
- step-by-step setup for the free hosting stack.
- the environment variables each service needs.
- the order in which services must be created.

**Key Structures Used:**
- `render.yaml` for the backend Blueprint and the Vercel project for the frontend.

**This document ensures:**
- anyone can take the project live at zero cost.
- environment configuration stays documented in one place.

**Editors:** Aniket, Dipankar, Liam, Jin, and Philip.

## Free hosting stack

| Layer | Service | Free tier |
|---|---|---|
| Database | [Supabase](https://supabase.com) | existing project (already set up) |
| Backend | [Render](https://render.com) | 750 instance hours/month, sleeps after 15 min idle |
| Frontend | [Vercel](https://vercel.com) | Hobby plan |

Deploy in this order — each step produces values the next step needs.

## 1. Database — Supabase (already running)

The Supabase project is already set up and seeded. **Do not change anything
in Supabase.** The only task is collecting the right connection values for
Render:

1. Supabase's *direct* connection (`db.<ref>.supabase.co:5432`) is IPv6-only,
   and Render's free tier cannot reach IPv6 hosts. Render must connect through
   the **Session Pooler** instead — same database, different hostname.
2. In the Supabase dashboard click **Connect** (top bar) and select
   **Session pooler**. Map the values shown to:
   - `DB_HOST` — `aws-0-<region>.pooler.supabase.com`
   - `DB_PORT` — `5432`
   - `DB_USER` — `postgres.<project-ref>` (note the project suffix)
   - `DB_PASSWORD` — the existing database password
   - `DB_NAME` — `postgres`
3. Local development keeps using the direct connection in `back/.env`
   unchanged.

## 2. Backend — Render

1. Sign up at https://render.com and click **New → Blueprint**, then pick this
   GitHub repository. Render reads `render.yaml` and creates the
   `genai-inventory-api` web service on the free plan.
2. When prompted, fill in the environment variables:
   - `GEMINI_API_KEY` — your Gemini key
   - `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME` — from step 1
   - `CORS_ORIGINS` — set after step 3 to your Vercel URL, e.g.
     `https://genai-inventory.vercel.app`
3. Note the service URL, e.g. `https://genai-inventory-api.onrender.com`.
   Verify `https://<service>/health` returns OK.

### Keeping the free instance awake

Free Render services spin down after 15 minutes without traffic (the first
request afterwards takes ~50 s, and the background scheduler does not run
while asleep). To keep it awake during the day, create a free monitor at
https://cron-job.org or https://uptimerobot.com that requests
`https://<service>/health` every 10 minutes.

## 3. Frontend — Vercel

1. Sign up at https://vercel.com and import this GitHub repository.
2. Set **Root Directory** to `front`. Vercel auto-detects Next.js.
3. Add the environment variables:
   - `NEXT_PUBLIC_API_URL` — the Render URL from step 2 (baked in at build time)
   - `API_URL` — the same Render URL (used by server-side routes)
   - `NEXTAUTH_URL` — your Vercel URL, e.g. `https://genai-inventory.vercel.app`
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
4. Deploy, then go back to Render and set `CORS_ORIGINS` to the Vercel URL.

## 4. Verify

1. Open the Vercel URL and log in.
2. Upload a shelf photo and confirm detection results appear.
3. Submit a review and confirm totals persist (check Neon's table view).
