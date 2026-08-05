from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    cors_origins: list[str] = ["http://localhost:5173"]  # Vite dev server default port

    # File attachments (PDFs, images, etc.) are stored on disk, not in Postgres —
    # Postgres isn't a good fit for large binary blobs at any scale, and on a
    # Raspberry Pi you especially don't want to bloat the DB with file bytes.
    # Only the file's path/URL and metadata (name, size, type) go in the DB.
    uploads_dir: str = "uploads"
    max_upload_size_mb: int = 25

    # Reminder emails — all optional. If left blank, the reminder scheduler
    # still runs but skips sending (logs a warning) rather than crashing the
    # whole app on startup just because email isn't configured yet.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    reminder_to_email: str = ""

    # Google Calendar sync — all optional. Blank client id/secret simply means
    # the Calendar page shows "not configured" instead of a Connect button;
    # nothing else in the app changes. See DEPLOY.md §8 for how to fill these.
    google_client_id: str = ""
    google_client_secret: str = ""
    # Must match a redirect URI registered on the OAuth client EXACTLY, host
    # and port included — Google rejects the exchange otherwise. On the Pi
    # that's your Tailscale address, e.g.
    #   http://raspberrypi.tailxxxxx.ts.net:8000/gcal/callback
    google_redirect_uri: str = "http://localhost:8000/gcal/callback"
    # Where /gcal/callback sends the browser once consent is done — the
    # frontend origin, not the API's. Kept separate from cors_origins because
    # that's a list and this needs one unambiguous destination.
    frontend_url: str = "http://localhost:5173"

    @model_validator(mode="after")
    def _blank_urls_fall_back_to_defaults(self):
        # docker-compose passes optional vars through as `${FOO:-}`, which sets
        # them to an EMPTY STRING rather than leaving them unset — and an empty
        # string is a real value as far as pydantic-settings is concerned, so it
        # happily overwrites the defaults above. That would turn the OAuth
        # redirect into a bare "/?gcal=connected" with no origin. Treating blank
        # as "not set" is what keeps the defaults meaningful for anyone who
        # simply doesn't use Google Calendar.
        if not self.google_redirect_uri.strip():
            self.google_redirect_uri = "http://localhost:8000/gcal/callback"
        if not self.frontend_url.strip():
            self.frontend_url = self.cors_origins[0] if self.cors_origins else "http://localhost:5173"
        return self

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    class Config:
        env_file = ".env"


settings = Settings()
