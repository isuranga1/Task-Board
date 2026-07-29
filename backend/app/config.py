from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    cors_origins: list[str] = ["http://localhost:5173"]  # Vite dev server default port

    class Config:
        env_file = ".env"


settings = Settings()
