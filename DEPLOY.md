# Deploying to a Raspberry Pi (with Tailscale)

This runs the whole stack — Postgres, the FastAPI backend, and the built
frontend served by nginx — as three Docker containers on the Pi, reachable
from any device on your tailnet, with a one-command way to push updates.

## 0. What you'll end up with

- `docker compose up -d` on the Pi runs everything.
- The app is reachable over **HTTPS** at `https://<pi-magicdns-name>` from any
  device signed into the same tailnet — a real, publicly-trusted, auto-renewing
  certificate, with no port forwarding, no public exposure, and nothing to open
  on your router (§4.1).
- `./deploy.sh` (or a GitHub Actions push trigger, see §5) pulls your latest
  `main` and redeploys, including any new database migrations.
- `scripts/backup-db.sh` dumps the database and uploads it to Google Drive
  (and/or another tailnet device) — schedule it with cron, or just run it
  by hand whenever; either way losing the Pi doesn't mean losing your data (§7).
- Optionally, the Calendar tab shows your Google Calendar events next to your
  task deadlines (§8) — read-only, and skippable.

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

Use the **MagicDNS name** (e.g. `raspberrypi.tailxxxxx.ts.net`), not the raw
`100.x.y.z` IP, everywhere below. HTTPS makes this mandatory rather than
merely advisable: the certificate in §4.1 is issued *for that name*, and a
browser pointed at the bare IP will reject it.

MagicDNS and HTTPS certificates both have to be switched on for your tailnet
— they're one checkbox each in the [admin console](https://login.tailscale.com/admin/dns),
under **DNS**. Do that now; §4.1 fails without them.

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

At minimum, set `POSTGRES_PASSWORD` to something real, and replace
`raspberrypi.tailxxxxx.ts.net` with your Pi's actual MagicDNS name from step 1
wherever it appears (`CORS_ORIGINS`, and the Google settings if you use them).
Keep the scheme as `https://` — that's what §4.1 will be serving.

Leave `VITE_API_URL=/api` alone. The frontend calls the API through its own
origin, which nginx proxies to the backend; that's what allows a single
certificate to cover the whole app, and it's what stops the browser blocking
API calls from an HTTPS page as mixed content.

SMTP settings are optional; leave them blank to skip email reminders.

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

Both containers deliberately bind to **loopback only** (`127.0.0.1:80` and
`127.0.0.1:8000` in `docker-compose.yml`), so at this point nothing is
reachable from your other devices yet. That's intentional: the next step is
what puts the app on the tailnet, and it does so over HTTPS only. There is no
window where the app is served unencrypted.

## 4.1 HTTPS

Tailscale can issue and renew a genuine certificate for your Pi's
`.ts.net` name from Let's Encrypt, and terminate TLS in front of the app.
One command, on the Pi:

```bash
sudo tailscale serve --bg 80
```

That reads: *listen on HTTPS :443 on the tailnet, forward to 127.0.0.1:80* —
the frontend container. Check it took:

```bash
tailscale serve status
```

Then, from any device on your tailnet:

```
https://raspberrypi.tailxxxxx.ts.net
```

A real padlock, no warning, no exception to click. The certificate is issued
to that MagicDNS name and **renews itself** — there's no cron job to add and
nothing that expires in 90 days and takes the app down with it.

Some things worth knowing about this arrangement:

- **The name is the certificate.** `https://100.x.y.z` will not work — the
  cert is for the MagicDNS name only. Use the name.
- **It's still private.** `serve` publishes to your tailnet and nowhere else;
  the certificate is publicly trusted, but the site is not publicly reachable.
  Your router configuration is untouched. (`tailscale funnel` is the command
  that *would* expose it to the internet — this app has no login, so don't
  run it without adding authentication first.)
- **The cert is fetched on first request**, so the very first load after
  running the command can take a few seconds longer than usual.
- **It survives reboots** — `--bg` persists the config; you don't re-run it
  after a restart or a `./deploy.sh`.

To undo it entirely: `sudo tailscale serve --bg off`.

### Optional: identity-based access

Because traffic now passes through Tailscale, you can put access control in
front of an app that has no login of its own. Tailnet ACLs can restrict which
devices reach port 443 on the Pi at all, and if you ever enable Funnel,
`tailscale serve` can require Tailscale identity. Worth a look if other people
are on your tailnet; unnecessary if it's only your own devices.

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

## 7. Backups (off the Pi)

Local Docker volumes don't help if the Pi itself is lost, has SD card
corruption, or otherwise dies — `scripts/backup-db.sh` dumps the DB, keeps a
rotating local window, and can push a copy to **Google Drive**, **another
device on your tailnet**, or both — each one is an independent on/off
switch in `backup.env`. Running it on a schedule (cron, §7.3) is itself
optional; it's just as safe to run by hand whenever you want a fresh backup.

```bash
cp backup.env.example backup.env
nano backup.env
```

### 7.1 Google Drive (recommended — `BACKUP_TO_GDRIVE=true`)

Uses [rclone](https://rclone.org), which handles the Google OAuth dance and
the actual upload. One-time setup on the Pi:

```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
rclone config
```

Walk through the prompts:

1. `n` — New remote
2. Name: `gdrive` (must match `GDRIVE_REMOTE_NAME` in `backup.env`)
3. Storage type: search/enter `drive` (Google Drive)
4. `client_id` / `client_secret`: leave both **blank** (uses rclone's own)
5. `scope`: **read the option text, don't just pick a number** — the menu
   order isn't the same across rclone versions. Pick the one whose
   description literally says *"Access to files created by rclone"* (this
   is `drive.file` — rclone can only see/manage files it creates, not your
   whole Drive). If you're at all unsure which one that is, picking *"Full
   access all files, excluding Application Data Folder"* (`drive`) is the
   foolproof option for a personal single-account backup script — it just
   grants more than strictly necessary. Picking a read-only option here is
   the single most common cause of a `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT`
   error later when the script tries to upload.
6. `root_folder_id`, `service_account_file`: leave blank
7. `Edit advanced config?` → `n`
8. `Use auto config?` → **`n`** — the Pi has no browser. rclone prints
   something like:
   ```
   Execute the following on a computer with a web browser and paste the
   config here:
   rclone authorize "drive" "scope" "..."
   ```
9. On your PC (with [rclone installed](https://rclone.org/downloads/) too),
   run that exact `rclone authorize ...` command — it opens a browser, you
   sign into the Google account you want backups to land in, and it prints
   a config token back in that PC's terminal.
10. Paste that token back into the Pi's `rclone config` prompt, confirm
    `y` it looks right, `q` to quit config.

Then create the target folder and test:

```bash
rclone mkdir gdrive:task-board-backups
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
rclone ls gdrive:task-board-backups   # should show today's .sql.gz
```

`GDRIVE_RETENTION_DAYS` (default 30) is the "renew daily" part — each run
deletes anything older than that from the Drive folder, so it stays a
rolling window of recent backups instead of growing forever.

### 7.2 Another device on your tailnet (optional — `BACKUP_TO_REMOTE=true`)

Can be used instead of or alongside Google Drive.

Generate a dedicated key on the Pi so a scheduled run can `scp` without a
password prompt, and make sure the remote path in `backup.env` already
exists:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/backup_key -N ""
```

Add the **public** half (`~/.ssh/backup_key.pub`) to the remote's allowed
keys:

- **Linux/Mac remote:** `ssh-copy-id -i ~/.ssh/backup_key.pub user@remote`
  (or append it to `~/.ssh/authorized_keys` there by hand).
- **Windows remote** (needs *OpenSSH Server*, an optional Windows feature —
  Settings → Apps → Optional Features → Add → OpenSSH Server): append the
  key to `C:\Users\<user>\.ssh\authorized_keys` for a normal account, or
  `C:\ProgramData\ssh\administrators_authorized_keys` (with restricted ACLs
  — see Microsoft's OpenSSH docs) if that account is an administrator.

Test with `./scripts/backup-db.sh` — you should see a new file both in
`./backups/` on the Pi and on the remote path you configured.

### 7.3 Scheduling (optional)

Nothing above requires a schedule — running `./scripts/backup-db.sh` by
hand whenever is a perfectly valid way to use it. If you want it automatic,
cron is the standard way: daily at 3am, logging to a file so failures are
visible.

```bash
crontab -e
# add:
0 3 * * * /home/pi/Task-Board/scripts/backup-db.sh >> /home/pi/Task-Board/backups/backup.log 2>&1
```

**If a destination is unreachable at backup time** (Drive API hiccup,
tailnet device asleep), the script logs it and moves on rather than
failing the whole run — the local copy still exists either way.
`LOCAL_RETENTION_DAYS` in `backup.env` is your buffer: as long as the
destination comes back within that window, the next successful run catches
it up.

**Restoring** a dump (e.g. onto a freshly re-imaged Pi, after redoing steps
1–4 above):

```bash
gunzip -c backups/task_dashboard-<timestamp>.sql.gz \
  | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Run that against a just-created, empty database (i.e. right after
`docker compose up -d db` on a brand new deployment, before starting the
backend) — restoring on top of an already-populated DB will hit constraint
conflicts.

## 8. Google Calendar sync (optional)

The **Calendar** tab shows your task deadlines on a month grid. Connecting a
Google account adds your Google events alongside them, with a tick-box per
calendar (and per space) to control what's shown.

This is **read-only** — the app requests only `calendar.readonly` and never
writes to, edits, or deletes anything in your Google Calendar.

Skip this whole section if you don't want it: without credentials the Calendar
tab still works, it just shows task deadlines and says Google isn't set up.

### 8.1 Create an OAuth client

In the [Google Cloud Console](https://console.cloud.google.com):

1. **New project** (top-left project dropdown → New Project). Any name.
2. **APIs & Services → Library** → search "Google Calendar API" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type **External**, fill in the required app name / support email.
   - On the *Data access* step, add the scope
     `https://www.googleapis.com/auth/calendar.readonly`.
   - On the *Audience* step, add your own Google address under **Test users**.
     A personal project in "Testing" mode never needs Google's verification
     review — test users can consent to it as-is. The only catch is that a
     refresh token issued in Testing mode expires after 7 days, so you'll
     re-click Connect about weekly. To stop that, hit **Publish app** on the
     consent screen; for a single-account app using only this scope, that
     doesn't require submitting anything for review.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, add the callback URL. This has to
     match `GOOGLE_REDIRECT_URI` byte for byte — scheme, host, port, path:
     ```
     https://raspberrypi.tailxxxxx.ts.net/api/gcal/callback
     ```
     Note the `/api` prefix and the absence of `:8000`: Google redirects the
     *browser* here, so the URL has to be the one the browser can reach —
     through nginx's proxy on the public HTTPS origin, not the backend's
     container-internal port.
     Add `http://localhost:8000/gcal/callback` too if you also run the app
     natively on your dev machine; a client can hold several redirect URIs.
5. Copy the **Client ID** and **Client secret**.

### 8.2 Configure

In the root `.env` (the one `docker-compose.yml` reads):

```bash
GOOGLE_CLIENT_ID=<client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_REDIRECT_URI=https://raspberrypi.tailxxxxx.ts.net/api/gcal/callback
FRONTEND_URL=https://raspberrypi.tailxxxxx.ts.net
```

`FRONTEND_URL` is where the browser gets sent back to after you consent — the
app's own HTTPS origin, without the `/api` prefix. If you leave it blank it
falls back to the first entry in `CORS_ORIGINS`.

These are read by the backend at startup, so a plain restart picks them up —
no image rebuild needed (unlike `VITE_API_URL`, which is baked in at build time):

```bash
docker compose up -d backend
```

### 8.3 Connect

Open the app → **Calendar** tab → **Connect** in the left-hand panel. You'll
land on Google's consent screen, and get redirected back to the Calendar tab
with your calendars listed, all ticked on. Untick any you don't want to see.

The tokens live in the `google_credentials` table in Postgres, so the
connection survives container rebuilds and is picked up by `scripts/backup-db.sh`
along with everything else. **Disconnect** (the unlink icon) deletes them and
revokes the grant with Google.

## 9. The LLM features (optional)

Two things here talk to a language model, and they share one OpenRouter key:

- **The Grow orb** — the floating circle in the bottom-right corner, which asks
  for one grown-up thing worth understanding (how an engine breathes, what an
  index fund actually is, why bread needs salt) plus something concrete to go
  and try.
- **The look-back** — at the bottom of the Insights tab, a written review of
  your week, month or year, built from the tasks you finished and the note you
  wrote on each one when you finished it.

Both are off unless you give it a key, and the rest of the app doesn't care
either way. Note that the *reflection prompt itself* — the "how did that feel,
what did you get out of it" box that appears when a task reaches Done — needs
no key and always works; it's a plain database write. The key is only needed to
have those reflections read back to you as a summary.

### 9.1 Get a key

1. Sign in at [openrouter.ai](https://openrouter.ai) and add a little credit
   (a few dollars lasts a very long time at this volume).
2. Create a key at **openrouter.ai/keys**.
3. **Set a spend limit on the key itself while you're there.** The app's
   per-day caps are a safety net, not a billing control — the limit on the key
   is what actually cannot be exceeded.

### 9.2 Configure

Add to the root `.env` on the Pi:

```bash
OPENROUTER_API_KEY=<the key you just created>
OPENROUTER_MODEL=openai/gpt-4o-mini
GROWTH_DAILY_LIMIT=25
SUMMARY_DAILY_LIMIT=10
```

Then recreate the backend — env vars are read at startup, and no image
rebuild is needed:

```bash
docker compose up -d backend
```

Treat that key like a password: it belongs only in `.env` (already
gitignored) and in OpenRouter's dashboard. It's never written to the
database, never logged, and `/growth/status` and `/summaries/{period}` report
only whether one is present — never its value.

### 9.3 How the daily limits work

Both features work the same way, on **separate counters** — so a busy day of
Grow clicks can't leave you unable to write a weekly review.

| Feature   | Table              | Env var                | Default |
| --------- | ------------------ | ---------------------- | ------- |
| Grow orb  | `growth_tips`      | `GROWTH_DAILY_LIMIT`   | 25/day  |
| Look-back | `period_summaries` | `SUMMARY_DAILY_LIMIT`  | 10/day  |

Every generation is a row in its table, stamped with the UTC date it was made,
and the cap is a count of today's rows. That means it survives backend restarts
(which happen on every deploy) and applies across all your devices at once —
not 25 per browser.

Requests that *fail* don't count: the row is only written once a reply actually
comes back, so a network blip doesn't eat your budget. A look-back over a period
where you finished nothing is refused before any API call at all. The counters
reset at midnight UTC. To change a ceiling, edit the env var and re-run the
`docker compose up -d backend` above.

Reading is always free — no API call is involved in the orb's history button,
in the list of what you finished in a period, or in re-opening a look-back that
has already been written. A summary is cached against its window (the Monday of
that week, the 1st of that month, Jan 1 of that year), so every day of the same
week finds the same one. The button only re-offers a rewrite once more work has
actually been finished since it was written.

The look-back is capped at the 120 most recent completed tasks in a window, so
a heavy year can't turn into an enormous prompt; the model is told the real
total so it never implies the sample was everything.

### 9.4 Changing the model

`OPENROUTER_MODEL` takes any slug from
[openrouter.ai/models](https://openrouter.ai/models). Anything that can follow
a "reply with JSON" instruction works; the code copes with models that wrap
their JSON in a code fence. If you want it to cost nothing at all, the
`:free` variants work too, at some cost in how interesting the suggestions
are.

One slug drives both features. The look-back sends a bigger prompt and asks for
more back, so if you pick a very small model, that's the one that will show it
first — a thin, generic review is usually the model, not your week.

## 10. Troubleshooting

- **`pip install` fails building `psycopg2-binary` on the Pi** — no
  prebuilt wheel for your exact Python/arch. Add build deps to
  `backend/Dockerfile` right before the `pip install` line:
  ```dockerfile
  RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
  ```
- **The site won't load at all from another device** — expected until
  §4.1 is done; the containers bind to loopback on purpose. Check
  `tailscale serve status` on the Pi. Also confirm you're using `https://`
  and the MagicDNS name, not `http://` or the `100.x.y.z` IP.
- **`tailscale serve --bg 80` errors on the flags** — that shorthand needs
  Tailscale 1.60 or newer. Either upgrade (`sudo tailscale update`), or use
  the older, longer form, which does the same thing:
  `sudo tailscale serve https / http://127.0.0.1:80`.
- **Certificate error, or `serve` complains it can't get a cert** — HTTPS
  certificates and MagicDNS are per-tailnet switches in the
  [admin console](https://login.tailscale.com/admin/dns) → **DNS**. Both must
  be on (§1).
- **"Blocked loading mixed active content" / API calls fail only over
  HTTPS** — something is calling an `http://` URL from the HTTPS page.
  `VITE_API_URL` should be exactly `/api`; if an absolute `http://…:8000`
  value is still baked into the image, rebuild the frontend (see below).
- **CORS errors in the browser console** — shouldn't happen now that the API
  is same-origin behind `/api`. If you see one, something is still calling the
  API by absolute URL (see the mixed-content entry above). Otherwise,
  `CORS_ORIGINS` must be a JSON array containing the *exact* origin the
  frontend is served from (scheme + host, no trailing slash), e.g.
  `CORS_ORIGINS=["https://raspberrypi.tailxxxxx.ts.net"]`.
- **404s from `/api/...`, or the API responding on the wrong paths** — the
  trailing slash on `proxy_pass http://backend:8000/;` in
  `frontend/nginx.conf` is what strips the `/api` prefix. Removing it makes
  the backend receive `/api/tasks/…`, which matches no route.
- **Frontend calls are hitting the wrong backend / `localhost`** —
  `VITE_API_URL` is baked in at image build time. Changing `.env` alone
  does nothing until you rebuild: `docker compose up -d --build frontend`.
- **Uploads over ~1MB fail with an nginx HTML error** — `client_max_body_size`
  in `frontend/nginx.conf` (30m) has to stay above the backend's
  `MAX_UPLOAD_SIZE_MB` (25), or nginx rejects the request before the API can
  return its own readable error.
- **Uploaded attachments "disappear" after a redeploy** — make sure you
  didn't remove the `uploads` named volume (`docker compose down -v` would
  do that — plain `docker compose down` / `deploy.sh` never do).
- **Google says `redirect_uri_mismatch`** — `GOOGLE_REDIRECT_URI` in `.env`
  and the URI on the OAuth client have to be *identical* strings. Common
  mismatches: `http` vs `https`, a leftover `:8000`, a missing `/api` prefix,
  a Tailscale IP in one and the MagicDNS name in the other, or a trailing
  slash. If this worked before HTTPS, it's almost certainly one of the first
  three — the correct value is now
  `https://<magicdns-name>/api/gcal/callback`, and it has to be updated in
  **both** places.
- **Calendar page says "Not set up on the server"** — the backend booted
  without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Check they're in the
  **root** `.env` (not `backend/.env`, which Docker doesn't read) and restart
  with `docker compose up -d backend`. Note these must be `KEY=value` lines —
  a stray label like `Client ID abc123` is silently ignored by dotenv.
- **"That sign-in link expired or didn't come from here"** — the `state` sent
  back by Google didn't verify. Now that state is signed rather than held in
  memory, a backend restart mid-consent no longer causes this; the remaining
  causes are taking more than 30 minutes on the consent screen, or
  `GOOGLE_CLIENT_SECRET` changing between clicking Connect and being
  redirected back (the secret is what signs the state). Click Connect again.
- **"Google didn't return a refresh token"** — Google only issues one on a
  fresh grant. Remove the app at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions),
  then hit Connect again.
- **The connection stops working after about a week** — your OAuth consent
  screen is still in **Testing** mode, where refresh tokens expire in 7 days.
  Publish the app (§8.1 step 3) or just reconnect when it lapses.
- **A calendar's events don't show** — check it's ticked in the left panel, and
  that its events actually fall in the month you're looking at. A calendar that
  errors on Google's side is skipped rather than failing the page, so check
  `docker compose logs backend` for a "Skipping calendar" warning.
