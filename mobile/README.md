# Mandate Mobile (Expo)

Same design as `web/`. Calls the Next.js API (`/api/...`).

## Two connections (don’t mix them up)

| What | Where |
|------|--------|
| **Expo bundle** | Always from the machine running `npm start` (Expo Go) |
| **Mandate API** | `EXPO_PUBLIC_API_URL` → your Next.js app |

## Quick start (local Mac)

```bash
# Terminal 1 — data service
cd data-service && .venv/bin/python app.py

# Terminal 2 — web on all interfaces
cd web && npm run dev:lan

# Terminal 3 — copy .env.example → .env, set your Mac’s Wi‑Fi IP
cd mobile && cp .env.example .env
# edit EXPO_PUBLIC_API_URL=http://YOUR_MAC_IP:3000

npm install && npm start
```

**iOS Simulator:** `EXPO_PUBLIC_API_URL=http://localhost:3000`  
**Android emulator:** omit `.env` (defaults to `http://10.0.2.2:3000`)

Demo: `demo@mandate.app` / `demo1234`

The app shows the API URL at the bottom of each screen.
