# The Corporate Blog

Production-grade, SEO-first blogging platform.

## Quick Start (Full Stack)

### 1) Install dependencies
```bash
npm install
cd backend
npm install
```

### 2) Start the database (recommended)
```bash
docker-compose up -d postgres pgbouncer redis
```

### 3) Configure backend env
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` and set at least:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

### 4) Run database setup
```bash
cd ..
npm run db:setup
```

### 5) Start servers
```bash
# frontend (root)
npm run dev
```
```bash
# backend
cd backend
npm run dev
```

## Local URLs
- Frontend: http://localhost:3000
- Backend: http://localhost:3001/health

## Backend Docs
See [backend/README.md](backend/README.md).

## Useful Commands
```bash
npm run lint
npm run type-check
npm run build
```
