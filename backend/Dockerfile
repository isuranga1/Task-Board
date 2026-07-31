FROM python:3.12-slim

WORKDIR /app

# psycopg2-binary ships its own libpq, so no build toolchain is needed on
# most amd64/arm64 targets. If `pip install` falls back to compiling it from
# source on your Pi (no prebuilt wheel for your Python/arch combo), install
# `build-essential libpq-dev` here first — see DEPLOY.md troubleshooting.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

ENTRYPOINT ["./entrypoint.sh"]
