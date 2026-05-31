# Production deploy (Docker, IP only)

Access API as `http://YOUR_SERVER_IP:3000` — no domain required.

---

## 1. Install Docker (Ubuntu)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in, then:
docker compose version
```

---

## 2. Deploy app

```bash
git clone <your-repo-url> /opt/fatoven_backend
cd /opt/fatoven_backend

cp .env.production.example .env
nano .env
```

Set strong values:

```env
POSTGRES_PASSWORD=...
JWT_SECRET=...    # openssl rand -base64 32
```

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check:

```bash
curl http://localhost:3000/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f fatoven-api
```

From your laptop:

```bash
curl http://YOUR_SERVER_IP:3000/health
```

---

## 3. Firewall

```bash
sudo ufw allow 22
sudo ufw allow 3000/tcp
sudo ufw enable
```

Postgres is **not** exposed on the host (only inside Docker).

---

## 4. Frontend (PM2 on host)

Backend stays in Docker. Serve the React app with PM2 — see `/opt/fatoven/DEPLOY.md` (sibling to this repo).

Before building:

```env
# fatoven_frontend/.env.production
VITE_API_BASE_URL=http://YOUR_SERVER_IP:3000
```

Then from `/opt/fatoven`: `./deploy.sh` (starts `fatoven-web` on port **4173**).

---

## 5. Updates / restart

```bash
cd /opt/fatoven_backend
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## 6. Backup DB

```bash
docker exec fatoven-postgres pg_dump -U fatoven fatoven > backup.sql
```

---

## Local dev (your Mac)

Still use default compose (ports 3001 / 5433 if other apps use 3000 / 5432):

```bash
docker compose up -d --build
```

---

## Later: domain + HTTPS

Add Nginx/Caddy in front of `localhost:3000` and close public port `3000` in the firewall.
