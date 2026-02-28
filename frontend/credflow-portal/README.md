# CredFlow Portal

Customer + admin web app for the CredFlow loan platform (React, Vite, TypeScript, Tailwind).

**Live:** https://credflow-portal.vercel.app

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:8080

Create `.env.local` (optional — defaults to local backend):

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_CRM_SERVICE_URL=http://127.0.0.1:9001
VITE_DOC_PROCESSOR_URL=http://127.0.0.1:8005
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port 8080) |
| `npm run build` | Production build → `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Routes

- `/` — Homepage & loan products
- `/login` — Customer login
- `/dashboard` — Customer dashboard
- `/ai-assistant` — AI loan assistant
- `/admin/login` — Banker admin portal

## Deploy (Vercel)

- Root directory: `frontend/credflow-portal`
- Set `VITE_API_BASE_URL` to your master agent URL (e.g. Render)
