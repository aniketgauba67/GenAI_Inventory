# GenAI Inventory Frontend

Next.js frontend for the pantry inventory workflow.

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
npx tsc --noEmit --pretty false
```

## Mobile Shell

Capacitor native projects live in `android/` and `ios/`. After web changes that should ship to native builds, run:

```bash
npm run cap:sync
```
