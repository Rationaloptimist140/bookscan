"""
BookScan — Supabase client setup.
Degrades gracefully when credentials are absent so the app can boot on Render
before environment variables are configured.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level client — may be None when Supabase is not configured.
# ---------------------------------------------------------------------------
_supabase_client = None
_supabase_configured = False


def _init_client() -> None:
    """Attempt to initialise the Supabase client once at import time."""
    global _supabase_client, _supabase_configured  # noqa: PLW0603

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()

    if not url or not key:
        logger.warning(
            "SUPABASE_URL or SUPABASE_SERVICE_KEY not set — "
            "running in unconfigured mode; DB-backed routes will return 503."
        )
        return

    try:
        from supabase import create_client  # lazy import

        _supabase_client = create_client(url, key)
        _supabase_configured = True
        logger.info("Supabase client initialised successfully.")
    except Exception as exc:
        logger.exception("Failed to initialise Supabase client: %s", exc)


# Run once on module load.
_init_client()


def get_client():
    """
    Return the Supabase client, or raise RuntimeError when not configured.
    Callers should convert RuntimeError to HTTPException 503.
    """
    if _supabase_client is None:
        raise RuntimeError("Supabase is not configured.")
    return _supabase_client


def is_configured() -> bool:
    """Return True when Supabase credentials are present and the client is live."""
    return _supabase_configured


def require_db():
    """
    Call this at the top of any endpoint that needs the database.
    Raises RuntimeError (caller catches and converts to 503).
    """
    if not _supabase_configured:
        raise RuntimeError("Supabase is not configured.")
    return _supabase_client
