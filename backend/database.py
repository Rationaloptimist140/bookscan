"""
BookScan — SQLAlchemy 2.0 async database layer (asyncpg + Neon PostgreSQL).
Degrades gracefully when DATABASE_URL is absent so the app can boot on a fresh
host before environment variables are configured.
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------

_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_configured = False


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def is_configured() -> bool:
    """Return True when DATABASE_URL was set and the engine initialised."""
    return _configured


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI ``Depends()``-compatible async generator that yields a session."""
    if _session_factory is None:
        raise RuntimeError("Database is not configured.")
    async with _session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Lifecycle hooks (called from the FastAPI lifespan)
# ---------------------------------------------------------------------------


async def startup() -> None:
    """Create the async engine and verify the connection."""
    global _engine, _session_factory, _configured  # noqa: PLW0603

    raw_url = os.environ.get("DATABASE_URL", "").strip()
    if not raw_url:
        logger.warning(
            "DATABASE_URL not set — running in unconfigured mode; "
            "DB-backed routes will return 503."
        )
        return

    # Normalise the scheme for asyncpg
    if raw_url.startswith("postgresql://"):
        dsn = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif raw_url.startswith("postgres://"):
        dsn = raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
    else:
        dsn = raw_url

    _engine = create_async_engine(
        dsn,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Connection test
    try:
        async with _engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        _configured = True
        logger.info("Database connection established successfully.")
    except Exception as exc:
        logger.exception("Failed to connect to the database: %s", exc)
        _engine = None
        _session_factory = None


async def shutdown() -> None:
    """Dispose of the engine connection pool."""
    global _engine, _session_factory, _configured  # noqa: PLW0603
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        _configured = False
        logger.info("Database engine disposed.")
