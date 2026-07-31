# Deploying to a Raspberry Pi (with Tailscale)

This runs the whole stack — Postgres, the FastAPI backend, and the built
frontend served by nginx — as three Docker containers on the Pi, reachable
from any device on your tailnet, with a one-command way to push updates.

## 0. What you'll end up with

- `docker compose up -d` on the Pi runs everything.
- The frontend is reachable at `http://<pi-tailscale-address>` from any
  device signed into the same tailnet — no port forwarding, no public
  exposure, nothing to open on your router.
- `./deploy.sh` (or a GitHub Actions push trigger, see §5) pulls your latest
  `main` and redeploys, including any new database migrations.

## 1. One-time Pi setup

Needs a 64-bit Raspberry Pi OS (Bookworm or newer — Docker's arm64 wheel
support is much better on 64-bit). A Pi 4 (4GB+) or Pi 5 is plenty.

```bash
# Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker   # or log out/in

# Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Note the Pi's Tailscale address once it's up:

```bash
tailscale status   # shows the device's 100.x.y.z IP and its MagicDNS name
```

Prefer the **MagicDNS name** (e.g. `raspberrypi.tailxxxxx.ts.net`) over the
raw `100.x.y.z` IP everywhere below — it doesn't change if the device
re-registers, so you won't need to rebuild the frontend image later.

## 2. Get the code onto the Pi

```bash
git clone <your-repo-url> Task-Board
cd Task-Board
chmod +x deploy.sh   # this repo was authored on Windows, so the exec bit isn't set in git
```

## 3. Configure

Copy the root env template and fill it in:

```bash
cp .env.example .env
nano .env
```

At minimum, set `POSTGRES_PASSWORD` to something real, and set
`CORS_ORIGINS` / `VITE_API_URL` to your Pi's actual Tailscale address from
step 1 (both **must** use that address, not `localhost` — the browser on
your other devices needs to reach it over the tailnet). SMTP settings are
optional; leave them blank to skip email reminders.

This root `.env` is **only** for `docker-compose.yml`. It's separate from
`backend/.env` / `frontend/.env`, which are for running things natively
without Docker (e.g. on your dev machine) — you don't need those on the Pi.

## 4. First deploy

```bash
docker compose up -d --build
```

This builds both images, starts Postgres, waits for it to be healthy,
starts the backend (which runs `alembic upgrade head` automatically before
serving — see `backend/entrypoint.sh`), then starts the frontend.

Check it's healthy:

```bash
docker compose ps
curl http://localhost:8000/health   # {"status": "ok"}
```

From **any other device on your tailnet**, open:

```
http://<pi-tailscale-address>
```

That's the Tailscale connection — nothing else to configure. Tailscale
already puts every device on the tailnet on the same private network, so
any port a container binds on the Pi is reachable from your laptop/phone
the moment both are signed into the same tailnet.

*(Optional: if you want a single clean HTTPS URL instead of `http://` +
remembering port 8000 exists, look at `tailscale serve` — it can front the
frontend container with a proper cert on your tailnet's `.ts.net` domain.
Not required for basic access.)*

## 5. Pushing changes

### Manual (simplest, recommended to start)

After `git push`ing from your dev machine:

```bash
ssh <user>@<pi-tailscale-address>      # or: tailscale ssh <pi-hostname>
cd Task-Board
./deploy.sh
```

`deploy.sh` does `git fetch` + `git reset --hard origin/main`, rebuilds
whatever changed, restarts containers, and runs any new migrations
(automatically, via the backend's entrypoint). Safe to run repeatedly.

### Automatic deploys on push

`.github/workflows/deploy.yml` is already in the repo, disabled until you
add these repo secrets (GitHub repo → Settings → Secrets and variables →
Actions):

| Secret | What it is |
|---|---|
| `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` | A Tailscale OAuth client (admin console → Settings → OAuth clients). Scope it to a tag, e.g. `tag:ci`, and make sure your tailnet ACLs let `tag:ci` reach the Pi on port 22. |
| `PI_TAILSCALE_HOST` | The Pi's MagicDNS name or Tailscale IP. |
| `PI_SSH_USER` | The Pi username to SSH as. |
| `PI_SSH_PRIVATE_KEY` | Private half of a dedicated deploy keypair (`ssh-keygen -t ed25519 -f deploy_key -N ""`) whose **public** half you add to the Pi's `~/.ssh/authorized_keys`. |
| `PI_DEPLOY_SCRIPT_PATH` | Full path to run, e.g. `/home/pi/Task-Board/deploy.sh`. |

Security note: that SSH key can run one command. Consider restricting it in
`authorized_keys` with a `command="/home/pi/Task-Board/deploy.sh"` prefix so
even if the key leaked, it can't do anything but redeploy:

```
command="/home/pi/Task-Board/deploy.sh",no-port-forwarding,no-X11-forwarding ssh-ed25519 AAAA... deploy-key
```

Once the secrets exist, every push to `main` redeploys automatically. Until
then, the workflow is just dormant — use the manual path above.

## 6. Everyday operations

```bash
docker compose logs -f backend     # tail backend logs
docker compose restart backend     # restart just one service
docker compose down                # stop everything (data volumes persist)
```

**Backups** — the Postgres data lives in the named volume `pgdata`; back it
up with `docker compose exec db pg_dump -U <user> <db> > backup.sql`
periodically (e.g. a cron job piping to a file off-device).

## 7. Troubleshooting

- **`pip install` fails building `psycopg2-binary` on the Pi** — no
  prebuilt wheel for your exact Python/arch. Add build deps to
  `backend/Dockerfile` right before the `pip install` line:
  ```dockerfile
  RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
  ```
- **CORS errors in the browser console** — `CORS_ORIGINS` in `.env` must be
  a JSON array containing the *exact* origin the frontend is served from
  (scheme + host, no trailing slash), e.g.
  `CORS_ORIGINS=["http://raspberrypi.tailxxxxx.ts.net"]`.
- **Frontend calls are hitting the wrong backend / `localhost`** —
  `VITE_API_URL` is baked in at image build time. Changing `.env` alone
  does nothing until you rebuild: `docker compose up -d --build frontend`.
- **Uploaded attachments "disappear" after a redeploy** — make sure you
  didn't remove the `uploads` named volume (`docker compose down -v` would
  do that — plain `docker compose down` / `deploy.sh` never do).
