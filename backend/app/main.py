from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import sections, subsections, tasks, analytics
from .reminders import start_scheduler

app = FastAPI(title="Task Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sections.router)
app.include_router(subsections.router)
app.include_router(tasks.router)
app.include_router(analytics.router)

# Serve uploaded attachments (PDFs, images, etc.) directly — the DB only ever
# stores the /uploads/<filename> path, never the file bytes themselves.
Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")


@app.on_event("startup")
def on_startup():
    start_scheduler()


@app.get("/health")
def health_check():
    return {"status": "ok"}
