"""Google Calendar integration — OAuth2 dance plus the two API reads we need.

Talks to Google's REST endpoints with plain `requests` rather than pulling in
`google-api-python-client`. That library exists to make a hundred Google APIs
discoverable; we call exactly three URLs, and its transitive dependency tree
(httplib2, protobuf) is the kind of thing that turns a Raspberry Pi rebuild
into an afternoon. The OAuth logic below is short enough to read in one sitting.

Scope is `calendar.readonly` only: this app shows your Google events next to
task deadlines, it never writes to your calendar. Asking for write access we
don't use would be a worse consent screen for no benefit.
"""

import hashlib
import hmac
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import requests
from sqlalchemy.orm import Session

from . import crud
from .config import settings

logger = logging.getLogger(__name__)

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# Refresh a little before the token actually dies, so a request that takes a
# moment to reach Google doesn't arrive just after expiry.
EXPIRY_SKEW = timedelta(seconds=60)

HTTP_TIMEOUT = 20  # seconds; a hung Google call shouldn't hang the calendar page


class GoogleCalendarError(Exception):
    """Anything that went wrong talking to Google, with a message fit to show a user."""


# ---------- CSRF state ----------
#
# The `state` parameter proves a callback came from a consent flow *this server*
# started, rather than an attacker's link. It's HMAC-signed rather than held in
# memory: an earlier version kept a dict of pending states, which broke in
# deployment because the backend container restarts on every `./deploy.sh` (and
# on every push, via .github/workflows/deploy.yml). Any restart between clicking
# Connect and Google redirecting back dropped the pending state, and the user
# got "that sign-in link expired" with nothing actually wrong.
#
# Signing removes the shared-memory requirement entirely: the callback can be
# served by a restarted process, a second worker, or a different container, and
# still verify a state it never issued. It also can't be filled up by anyone
# spamming /gcal/auth-url, since nothing is retained per request.
#
# The trade is that a state stays valid for its whole TTL instead of being
# strictly single-use. That's the standard signed-state design and it's the
# right call here: replaying a state is only useful to someone who already holds
# the matching one-time `code`, which Google itself will not redeem twice.

_STATE_TTL = 1800  # 30 minutes — a human clicking through Google's consent
                   # screen, unverified-app warning and account chooser can
                   # easily take several minutes.


def _state_key() -> bytes:
    """Signing key, derived from the OAuth client secret.

    Reusing that secret means there's no extra key to configure or rotate, and
    it already has exactly the right property: known to this server, and to
    nobody who might forge a callback.
    """
    return hashlib.sha256(
        f"gcal-state:{settings.google_client_secret}".encode()
    ).digest()


def _sign(payload: str) -> str:
    return hmac.new(_state_key(), payload.encode(), hashlib.sha256).hexdigest()


def _new_state() -> str:
    # The nonce makes each state unique even within the same second, so two
    # tabs mid-consent can't collide on an identical string.
    payload = f"{int(time.time())}.{secrets.token_urlsafe(12)}"
    return f"{payload}.{_sign(payload)}"


def _consume_state(state: str) -> bool:
    payload, _, signature = state.rpartition(".")
    if not payload or not signature:
        return False

    # compare_digest rather than == so a forged signature can't be recovered
    # byte-by-byte by timing the comparison.
    if not hmac.compare_digest(signature, _sign(payload)):
        return False

    issued_at, _, _nonce = payload.partition(".")
    try:
        age = time.time() - int(issued_at)
    except ValueError:
        return False

    # Negative age means a clock moved backwards; treat it as invalid rather
    # than trusting a timestamp from the future.
    return 0 <= age <= _STATE_TTL


# ---------- OAuth ----------

def build_auth_url() -> str:
    """The URL to send the browser to for consent."""
    if not settings.google_configured:
        raise GoogleCalendarError(
            "Google Calendar isn't configured on the server — "
            "set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        # offline + consent is what actually gets us a refresh token. Google
        # only issues one on a *fresh* grant, so without prompt=consent a
        # reconnect after the first time silently returns no refresh token and
        # the connection dies the moment the access token expires an hour later.
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": _new_state(),
    }
    return f"{AUTH_ENDPOINT}?{urlencode(params)}"


def _token_request(payload: dict) -> dict:
    try:
        res = requests.post(TOKEN_ENDPOINT, data=payload, timeout=HTTP_TIMEOUT)
    except requests.RequestException as e:
        raise GoogleCalendarError(f"Couldn't reach Google: {e}") from e
    if not res.ok:
        # Google's error bodies are small and genuinely useful
        # ("redirect_uri_mismatch", "invalid_grant") — worth surfacing verbatim.
        raise GoogleCalendarError(f"Google rejected the token request: {res.text}")
    return res.json()


def exchange_code(db: Session, code: str, state: str) -> None:
    """Turn the one-time `code` from the redirect into stored tokens."""
    if not _consume_state(state):
        raise GoogleCalendarError(
            "That sign-in link expired or didn't come from here. Try connecting again."
        )

    tokens = _token_request({
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    })

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    if not access_token:
        raise GoogleCalendarError("Google's response had no access token.")
    if not refresh_token:
        # Without this the connection would work for an hour and then break in
        # a way that's very hard to diagnose. Fail loudly now instead.
        raise GoogleCalendarError(
            "Google didn't return a refresh token. Remove this app at "
            "myaccount.google.com/permissions and connect again."
        )

    fields = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_expiry": _expiry_from(tokens),
        "scope": tokens.get("scope"),
    }

    existing = crud.get_google_credential(db)
    if existing is None:
        # A brand new connection starts with every calendar ticked on — an
        # empty list would render an empty calendar and look broken.
        fields["selected_calendar_ids"] = []

    cred = crud.upsert_google_credential(db, **fields)

    # The primary calendar's id IS the account's email address, so we get the
    # "connected as ..." label for free instead of requesting an extra
    # userinfo/email scope just to display one string.
    try:
        calendars = list_calendars(db)
        primary = next((c for c in calendars if c["primary"]), None)
        if primary:
            crud.upsert_google_credential(db, account_email=primary["id"])
        if existing is None:
            crud.set_selected_calendars(db, [c["id"] for c in calendars])
    except GoogleCalendarError:
        logger.warning("Connected to Google but couldn't read the calendar list yet", exc_info=True)

    logger.info("Google Calendar connected (%s)", cred.account_email or "unknown account")


def _expiry_from(tokens: dict) -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=int(tokens.get("expires_in", 3600)))


def _access_token(db: Session) -> str:
    """A currently-valid access token, refreshing it first if it's about to expire."""
    cred = crud.get_google_credential(db)
    if not cred:
        raise GoogleCalendarError("Google Calendar isn't connected.")

    expiry = cred.token_expiry
    if expiry is not None and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    if expiry is not None and datetime.now(timezone.utc) + EXPIRY_SKEW < expiry:
        return cred.access_token

    if not cred.refresh_token:
        raise GoogleCalendarError("The Google connection expired. Please reconnect.")

    tokens = _token_request({
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "refresh_token": cred.refresh_token,
        "grant_type": "refresh_token",
    })
    # Deliberately not writing refresh_token here: a refresh response usually
    # omits it, and blindly persisting `tokens.get("refresh_token")` would null
    # out the only credential that can ever get us a new access token.
    updated = crud.upsert_google_credential(
        db,
        access_token=tokens["access_token"],
        token_expiry=_expiry_from(tokens),
    )
    return updated.access_token


def _api_get(db: Session, path: str, params: dict | None = None) -> dict:
    try:
        res = requests.get(
            f"{CALENDAR_API}{path}",
            headers={"Authorization": f"Bearer {_access_token(db)}"},
            params=params or {},
            timeout=HTTP_TIMEOUT,
        )
    except requests.RequestException as e:
        raise GoogleCalendarError(f"Couldn't reach Google Calendar: {e}") from e
    if res.status_code == 401:
        raise GoogleCalendarError("Google rejected the stored credentials. Please reconnect.")
    if not res.ok:
        raise GoogleCalendarError(f"Google Calendar API error {res.status_code}: {res.text}")
    return res.json()


# ---------- Reads ----------

def list_calendars(db: Session) -> list[dict]:
    """Every calendar on the connected account — one tick-box each in the UI."""
    calendars: list[dict] = []
    page_token = None
    while True:
        params = {"maxResults": 250, "minAccessRole": "reader"}
        if page_token:
            params["pageToken"] = page_token
        data = _api_get(db, "/users/me/calendarList", params)
        for item in data.get("items", []):
            calendars.append({
                "id": item["id"],
                "name": item.get("summaryOverride") or item.get("summary") or item["id"],
                "description": item.get("description"),
                # backgroundColor is what Google shows in its own UI — reusing it
                # means a calendar looks the same here as it does over there.
                "color": item.get("backgroundColor"),
                "primary": bool(item.get("primary")),
            })
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    # Primary first, then alphabetical — matches Google's own sidebar ordering.
    calendars.sort(key=lambda c: (not c["primary"], c["name"].lower()))
    return calendars


def _normalize_event(item: dict, calendar: dict) -> dict:
    """Flatten Google's start/end shape into something the frontend can render directly.

    Google returns `{"date": "2026-08-05"}` for all-day events and
    `{"dateTime": "...", "timeZone": "..."}` for timed ones. Rather than make
    the frontend branch on which key exists, we hand it a flag and two strings.
    """
    start = item.get("start", {})
    end = item.get("end", {})
    all_day = "date" in start

    return {
        "id": item["id"],
        "calendar_id": calendar["id"],
        "calendar_name": calendar["name"],
        "color": calendar["color"],
        "title": item.get("summary") or "(no title)",
        "description": item.get("description"),
        "location": item.get("location"),
        "start": start.get("date") or start.get("dateTime"),
        # Google's all-day `end.date` is EXCLUSIVE (a one-day event on the 5th
        # ends on the 6th). Left as-is here and corrected once, in the
        # frontend's event-to-day expansion, so both ends agree on one rule.
        "end": end.get("date") or end.get("dateTime"),
        "all_day": all_day,
        "html_link": item.get("htmlLink"),
        "status": item.get("status"),
    }


def list_events(
    db: Session,
    time_min: datetime,
    time_max: datetime,
    calendar_ids: list[str] | None = None,
) -> list[dict]:
    """Events in a window, across the selected calendars, merged into one list.

    Google has no cross-calendar events endpoint, so this fans out one request
    per calendar. That's fine at personal scale (a handful of calendars) and
    keeps a single broken/deleted calendar from failing the whole page — a
    calendar that errors is logged and skipped, not raised.
    """
    cred = crud.get_google_credential(db)
    if not cred:
        raise GoogleCalendarError("Google Calendar isn't connected.")

    all_calendars = list_calendars(db)
    wanted = calendar_ids if calendar_ids is not None else (cred.selected_calendar_ids or [])
    selected = [c for c in all_calendars if c["id"] in set(wanted)]

    events: list[dict] = []
    for calendar in selected:
        try:
            page_token = None
            while True:
                params = {
                    "timeMin": time_min.isoformat(),
                    "timeMax": time_max.isoformat(),
                    # Expands recurring events into their individual occurrences
                    # — without it a weekly standup shows up once, on the day the
                    # series was created, and nowhere else.
                    "singleEvents": "true",
                    "orderBy": "startTime",
                    "maxResults": 2500,
                }
                if page_token:
                    params["pageToken"] = page_token
                data = _api_get(db, f"/calendars/{requests.utils.quote(calendar['id'], safe='')}/events", params)
                for item in data.get("items", []):
                    if item.get("status") == "cancelled":
                        continue  # a deleted occurrence of a recurring series
                    events.append(_normalize_event(item, calendar))
                page_token = data.get("nextPageToken")
                if not page_token:
                    break
        except GoogleCalendarError:
            logger.warning("Skipping calendar %s — couldn't fetch events", calendar["id"], exc_info=True)

    events.sort(key=lambda e: (e["start"] or "", e["title"]))
    return events


def disconnect(db: Session) -> bool:
    """Drop the stored tokens, telling Google to forget the grant as well."""
    cred = crud.get_google_credential(db)
    if not cred:
        return False
    token = cred.refresh_token or cred.access_token
    if token:
        try:
            requests.post(REVOKE_ENDPOINT, data={"token": token}, timeout=HTTP_TIMEOUT)
        except requests.RequestException:
            # Revocation is courtesy; the local row is what actually governs
            # whether this app can reach your calendar, so a failure here must
            # not stop us deleting it.
            logger.warning("Couldn't revoke the Google token remotely", exc_info=True)
    return crud.delete_google_credential(db)
