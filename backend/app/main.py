from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import sections, subsections, tasks

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


@app.get("/health")
def health_check():
    return {"status": "ok"}
