# Ventrix — Vercel Deployment & Cloud Hosting Guide

This guide walks you through deploying **Ventrix** to **Vercel** with a cloud PostgreSQL database.

---

## Architecture Overview

Ventrix consists of three main components:
1. **Frontend (`Ventrix/client`)**: React 19 + Vite SPA (Tailwind CSS, Recharts, Lucide). **Ideal for Vercel**.
2. **Backend API (`Ventrix/server`)**: Node.js + Express REST API (Auth, RBAC, Assets, Telemetry, Maintenance).
3. **Database**: PostgreSQL database. (Must be hosted in the cloud, e.g. Neon or Supabase, because Vercel does not host databases).

---

## Step 1: Provision a Free Cloud PostgreSQL Database

Because Vercel is a serverless application platform, your database needs to be hosted online:

1. Sign up for a free cloud Postgres provider:
   - **Neon** (Recommended, 0.5 GB free): [neon.tech](https://neon.tech)
   - **Supabase** (500 MB free): [supabase.com](https://supabase.com)
2. Create a new database project named `ventrix`.
3. Copy your connection URI (`DATABASE_URL`). It will look like:
   ```text
   postgresql://ventrix_owner:abcdef123456@ep-cool-fog-123456.us-east-2.aws.neon.tech/ventrix?sslmode=require
   ```

### Run Migrations Against Your Cloud Database
From your local terminal, run the database migrations directly to create all tables, seed demo users, and seed assets:
```powershell
cd "Ventrix/server"

# Set DATABASE_URL and run the migration script
$env:DATABASE_URL="YOUR_COPIED_DATABASE_URL_HERE"
node migrations/run.js
```

---

## Step 2: Choose Your Deployment Strategy

### Option A: Standard Full-Stack Architecture (Recommended)
- **Frontend on Vercel** (`Ventrix/client`): Instant Edge CDN, automatic previews.
- **Backend on Render or Railway** (`Ventrix/server`): Persistent Node.js container with full Python & background worker support.

### Option B: 100% on Vercel (Frontend + Serverless API)
- Both Frontend and Backend hosted on Vercel as two Vercel projects (or Monorepo).
- The Express API runs as a Vercel Serverless Function via `Ventrix/server/api/index.js`.
- *Note*: AI inference will automatically use the built-in resilient heuristic physics fallback engine.

---

## Step 3: Deploying the Frontend to Vercel

1. Push your repository to **GitHub / GitLab / Bitbucket**.
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **"Add New..."** -> **"Project"** and import your repository.
4. In the **Configure Project** screen:
   - **Project Name**: `ventrix-client` (or any name you prefer)
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`Ventrix/client`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Expand **Environment Variables** and add:
   | Key | Value | Note |
   |---|---|---|
   | `VITE_API_BASE_URL` | `https://your-backend-api-url/api` | URL of your deployed backend + `/api` |
6. Click **Deploy**.
7. Vercel will build and assign you a URL (e.g., `https://ventrix-client.vercel.app`).

> **Note**: A `Ventrix/client/vercel.json` file is already pre-configured to ensure React Router client-side routing works smoothly when refreshing pages (e.g. `/dashboard`, `/login`).

---

## Step 4: Deploying the Backend

### Method 1: Deploy Backend on Render / Railway (Recommended)
1. Go to [Render](https://render.com) or [Railway](https://railway.app).
2. Create a new **Web Service** linked to your repository.
3. Set:
   - **Root Directory**: `Ventrix/server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Add Environment Variables:
   - `DATABASE_URL`: `your_cloud_postgres_connection_string`
   - `JWT_SECRET`: `your_random_secret_token`
   - `TELEMETRY_INGEST_KEY`: `your_secure_telemetry_key`
   - `CORS_ORIGINS`: `https://ventrix-client.vercel.app` (your Vercel frontend URL)
5. Copy your deployed backend service URL (e.g. `https://ventrix-api.onrender.com`).
6. Update `VITE_API_BASE_URL` in your Vercel Frontend project settings to `https://ventrix-api.onrender.com/api` and trigger a redeploy.

---

### Method 2: Deploy Backend to Vercel (Serverless)
1. In the Vercel Dashboard, click **"Add New..."** -> **"Project"** and import the same repository again.
2. In the **Configure Project** screen:
   - **Project Name**: `ventrix-api`
   - **Framework Preset**: `Other`
   - **Root Directory**: Click *Edit* and select **`Ventrix/server`**
   - **Build Command**: *(leave empty)*
   - **Output Directory**: *(leave empty)*
3. Add Environment Variables:
   - `DATABASE_URL`: `your_cloud_postgres_connection_string`
   - `JWT_SECRET`: `your_random_secret_token`
   - `TELEMETRY_INGEST_KEY`: `your_secure_telemetry_key`
   - `CORS_ORIGINS`: `*` (or `https://ventrix-client.vercel.app`)
4. Click **Deploy**.
5. Your backend will be accessible at: `https://ventrix-api.vercel.app`.
6. Test it by opening `https://ventrix-api.vercel.app/test-db` in your browser.
7. Set your Vercel Frontend's `VITE_API_BASE_URL` to `https://ventrix-api.vercel.app/api`.

---

## Step 5: Streaming Telemetry to Your Deployed App

To stream simulated live sensor data into your hosted cloud deployment:

In your local terminal:
```powershell
cd "Railway-Simulation/hvac_fix"
$env:VENTRIX_API_URL="https://your-backend-url/api/telemetry"
$env:TELEMETRY_INGEST_KEY="your_secure_telemetry_key"
npm run stream
```
The live telemetry telemetry data will instantly feed into your live cloud dashboard!

---

## Seed Accounts Reference

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@ventrix.com` | `Ventrix@123` |
| **Engineer** | `engineer@ventrix.com` | `Ventrix@123` |
| **Technician** | `tech@ventrix.com` | `Ventrix@123` |
