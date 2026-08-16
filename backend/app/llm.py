"""The one place this app talks to OpenRouter.

Extracted from growth.py once a second feature (the weekly/monthly/yearly
review in summaries.py) needed the same call. Everything that was subtle about
that original client is subtle for the same reasons here, so it lives in one
function rather than being copied:

  * `json_mode` retries once without `response_format` on a 400. OpenRouter
    routes to many models and only some accept that parameter — the ones that
    don't reject the entire request, and the prompt asks for JSON anyway.
  * A 200 response can still carry an `error` object. OpenRouter reports
    upstream provider failures (model down, content filtered) that way instead
    of with an HTTP status, so checking `res.ok` alone isn't enough.
  * Header values are latin-1 on the wire, and http.client raises before the
    connection is even opened on anything outside that range — see header_safe.

Talks over plain `requests` for the same reason gcal.py talks to Google that
way: one URL does not justify an SDK and its dependency tree on a Raspberry Pi.

The API key is never logged, never persisted, and never leaves this module — it
exists only as an Authorization header built at call time.
"""

import json
import logging
import re

import requests

from .config import settings

logger = logging.getLogger(__name__)

# A single generation is a few hundred to a couple of thousand tokens; 60s is
# generous enough for a slow model behind the gateway while still failing
# before the browser gives up.
HTTP_TIMEOUT = 60


class LLMError(Exception):
    """Anything that went wrong talking to the model, with a message fit to
    show a user. Every caller-facing failure in growth.py and summaries.py is
    either this or a subclass of it, so a router can catch one type."""


def header_safe(value: str, fallback: str) -> str:
    """A header value `requests` can actually put on the wire.

    HTTP header values are encoded latin-1, and http.client raises
    UnicodeEncodeError — before opening the connection, so you get a 500 rather
    than an API error — on anything outside that range. Easy to trip over: an
    em dash in a title, or a non-ASCII hostname in FRONTEND_URL. These headers
    are pure attribution metadata, so degrading to a plain fallback is strictly
    better than failing the request over them.
    """
    try:
        value.encode("latin-1")
    except UnicodeEncodeError:
        return fallback
    return value


def extract_json(content: str) -> dict:
    """Parse the model's reply, tolerating the ways models wrap JSON.

    `response_format: json_object` is requested below, but OpenRouter honours
    that hint only where the underlying provider supports it — so some replies
    still arrive fenced in ```json, or with a sentence in front. Rather than
    fail a request the user has spent budget on, pull the outermost object out
    and parse that.
    """
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise LLMError("The model replied with something unreadable. Try again.")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise LLMError("Couldn't read the model's reply. Try again.") from e


def chat_completion(
    messages: list[dict],
    *,
    x_title: str,
    temperature: float = 0.9,
    max_tokens: int = 500,
    json_mode: bool = True,
) -> str:
    """POST to OpenRouter and return the assistant's message content.

    `x_title` is pure attribution — it shows up in OpenRouter's activity log,
    which is how you work out which feature actually spent your credit. Each
    caller passes its own, ASCII only (see header_safe).
    """
    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"

    payload: dict = {
        "model": settings.openrouter_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        res = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": header_safe(settings.frontend_url, "http://localhost"),
                "X-Title": header_safe(x_title, "Task Dashboard"),
            },
            json=payload,
            timeout=HTTP_TIMEOUT,
        )
    except requests.RequestException as e:
        raise LLMError(f"Couldn't reach OpenRouter: {e}") from e

    if res.status_code == 400 and json_mode:
        logger.info(
            "Model %s rejected json_object mode; retrying without it",
            settings.openrouter_model,
        )
        return chat_completion(
            messages,
            x_title=x_title,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=False,
        )

    if res.status_code == 401:
        raise LLMError(
            "OpenRouter rejected the API key. Check OPENROUTER_API_KEY on the server."
        )
    if res.status_code == 402:
        raise LLMError("Your OpenRouter account is out of credit.")
    if res.status_code == 429:
        raise LLMError("OpenRouter is rate-limiting this key. Try again in a minute.")
    if not res.ok:
        # Deliberately truncated: gateway error bodies can carry a full echo of
        # the request, and nothing here should page a wall of text to the UI.
        raise LLMError(f"OpenRouter error {res.status_code}: {res.text[:300]}")

    data = res.json()

    if isinstance(data.get("error"), dict):
        raise LLMError(f"OpenRouter error: {data['error'].get('message', 'unknown')}")

    try:
        return data["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as e:
        raise LLMError("OpenRouter returned an unexpected response shape.") from e
