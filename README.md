# WakeUp

Keep your backend servers alive by pinging them every 30 seconds.

## Stack

- **Frontend**: Next.js + shadcn/ui + Framer Motion → deployed on Vercel
- **Backend**: Express + PostgreSQL + in-memory cache → deployed on Render

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev
```

## Environment Variables

### Backend (Render)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `ADMIN_USERNAME` | Login username |
| `ADMIN_PASSWORD` | Login password |
| `FRONTEND_URL` | Frontend origin for CORS |

### Frontend (Vercel)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g. `https://wakeup-backend.onrender.com`) |

## Deploy

- **Backend**: Push to GitHub → connect repo on Render → set root dir to `backend` → set env vars
- **Frontend**: Push to GitHub → import on Vercel → set root dir to `frontend` → set env vars
