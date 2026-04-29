# GenAI Inventory Frontend

**Module:** Frontend README
**Purpose:** Documents the Next.js frontend, shared UI structure, and local development workflow.

**The document provides:**
- frontend folder structure notes.
- local setup commands.
- lint, test, build, and Capacitor sync commands.

**Key Structures Used:**
- Next.js App Router folders, shared components, lib helpers, and native shell folders.

**This document ensures:**
- frontend contributors can run and validate the app locally.
- mobile shell notes stay visible near frontend code.

**Editors:** Aniket, Dipankar, Liam, Jin, and Philip.

Next.js frontend for the pantry inventory workflow.

## Structure

- `app/`: route pages, API proxy routes, layouts, and providers
- `components/`: shared UI, inventory display, workflow controls, layout, and chatbot components
- `lib/`: frontend API, camera, and inventory category helpers
- `styles/`: shared design tokens
- `public/`: project images and static assets

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npm test
npm run build
npx tsc --noEmit --pretty false
```

## Mobile Shell

Capacitor native projects live in `android/` and `ios/`. After web changes that should ship to native builds, run:

```bash
npm run cap:sync
```
