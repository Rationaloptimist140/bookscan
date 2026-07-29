"""
BookScan — External API integration.
Open Library (ISBN, author, search) + Gutendex (Gutenberg duplicate check).
All calls use httpx.AsyncClient with timeouts, exponential backoff on 5xx/timeout,
and graceful degradation — a failed lookup returns None + warning string.
Every call is logged to api_logs (best-effort, never breaks the request).
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_OPEN_LIBRARY_BASE = "https://openlibrary.org"
_GUTENDEX_BASE = "https://gutendex.com"
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_MAX_RETRIES = 3
_RETRY_STATUSES = {500, 502, 503, 504}


# ---------------------------------------------------------------------------
# Logging helper (best-effort, never raises)
# ---------------------------------------------------------------------------


async def _log_api_call(
    api_name: str,
    endpoint: str,
    params: dict[str, Any] | None,
    status: int,
    elapsed_ms: int,
    cached: bool = False,
) -> None:
    """Write a row to api_logs. Silently swallows all errors."""
    try:
        import database  # local import to avoid circular dependency at module level

        if not database.is_configured():
            return
        db = database.get_client()
        db.table("api_logs").insert(
            {
                "api_name": api_name,
                "endpoint": endpoint,
                "request_params": params or {},
                "response_status": status,
                "response_cached": cached,
                "response_time_ms": elapsed_ms,
            }
        ).execute()
    except Exception:
        pass  # logging must never break the request


# ---------------------------------------------------------------------------
# HTTP helper with retries
# ---------------------------------------------------------------------------


async def _get_with_retry(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any] | None = None,
) -> tuple[httpx.Response | None, str | None]:
    """
    GET with exponential backoff on 5xx / network errors.
    Returns (response, warning_or_None).
    """
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            resp = await client.get(url, params=params)
            if resp.status_code in _RETRY_STATUSES and attempt < _MAX_RETRIES - 1:
                await asyncio.sleep(0.5 * (2**attempt))
                continue
            return resp, None
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES - 1:
                await asyncio.sleep(0.5 * (2**attempt))

    return None, f"Request failed after {_MAX_RETRIES} attempts: {last_exc}"


# ---------------------------------------------------------------------------
# Date parsing helpers
# ---------------------------------------------------------------------------


def _parse_year(date_str: str | None) -> int | None:
    """
    Robustly extract a four-digit year from strings like:
      "1832", "22 January 1832", "1832-01-22", "January 1, 1832", "c. 1832"
    """
    if not date_str:
        return None
    m = re.search(r"\b(\d{4})\b", date_str)
    if m:
        return int(m.group(1))
    return None


# ---------------------------------------------------------------------------
# Open Library — ISBN lookup
# ---------------------------------------------------------------------------


async def lookup_isbn(
    isbn: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Fetch book data from Open Library by ISBN.
    Returns (book_data_dict, warning_or_None).
    book_data_dict keys: title, subtitle, authors, publish_date, publishers,
                         number_of_pages, subjects, openlibrary_id, openlibrary_url
    """
    url = f"{_OPEN_LIBRARY_BASE}/api/books"
    params = {
        "bibkeys": f"ISBN:{isbn}",
        "format": "json",
        "jscmd": "data",
    }
    start = time.monotonic()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp, warning = await _get_with_retry(client, url, params)

    elapsed = int((time.monotonic() - start) * 1000)

    if warning or resp is None:
        await _log_api_call("open_library", url, {"isbn": isbn}, 0, elapsed)
        return None, warning or "No response from Open Library"

    await _log_api_call("open_library", url, {"isbn": isbn}, resp.status_code, elapsed)

    if resp.status_code != 200:
        return None, f"Open Library returned HTTP {resp.status_code}"

    try:
        data = resp.json()
    except Exception as exc:
        return None, f"Open Library JSON parse error: {exc}"

    key = f"ISBN:{isbn}"
    if key not in data:
        return None, f"ISBN {isbn} not found in Open Library"

    raw = data[key]

    # Normalise into a flat dict
    result: dict[str, Any] = {
        "title": raw.get("title"),
        "subtitle": raw.get("subtitle"),
        "publish_date": raw.get("publish_date"),
        "publishers": [p["name"] for p in raw.get("publishers", [])],
        "number_of_pages": raw.get("number_of_pages"),
        "subjects": [s["name"] for s in raw.get("subjects", [])],
        "openlibrary_url": raw.get("url"),
        "openlibrary_id": None,
        "author_key": None,
        "authors": [],
    }

    # Extract OL key from URL e.g. "/books/OL12345M"
    if result["openlibrary_url"]:
        m = re.search(r"/(OL\w+)", result["openlibrary_url"])
        if m:
            result["openlibrary_id"] = m.group(1)

    # Authors
    raw_authors = raw.get("authors", [])
    result["authors"] = [a.get("name") for a in raw_authors if a.get("name")]
    if raw_authors:
        first_author_url = raw_authors[0].get("url", "")
        m2 = re.search(r"/(OL\d+A)", first_author_url)
        if m2:
            result["author_key"] = m2.group(1)

    return result, None


# ---------------------------------------------------------------------------
# Open Library — author detail lookup
# ---------------------------------------------------------------------------


async def lookup_author(
    author_key: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Fetch author details by Open Library author key (e.g. "OL26320A").
    Returns (author_data, warning_or_None).
    author_data keys: name, birth_year, death_year, bio
    """
    url = f"{_OPEN_LIBRARY_BASE}/authors/{author_key}.json"
    start = time.monotonic()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp, warning = await _get_with_retry(client, url)

    elapsed = int((time.monotonic() - start) * 1000)
    await _log_api_call("open_library_author", url, {"author_key": author_key}, resp.status_code if resp else 0, elapsed)

    if warning or resp is None:
        return None, warning or "No response from Open Library author endpoint"

    if resp.status_code != 200:
        return None, f"Open Library author returned HTTP {resp.status_code}"

    try:
        data = resp.json()
    except Exception as exc:
        return None, f"Open Library author JSON parse error: {exc}"

    bio_raw = data.get("bio", "")
    bio_text = bio_raw if isinstance(bio_raw, str) else bio_raw.get("value", "")

    return {
        "name": data.get("name"),
        "birth_year": _parse_year(data.get("birth_date")),
        "death_year": _parse_year(data.get("death_date")),
        "bio": bio_text,
    }, None


# ---------------------------------------------------------------------------
# Open Library — search
# ---------------------------------------------------------------------------


async def search_open_library(
    title: str | None = None,
    author: str | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Search Open Library by title and/or author.
    Returns (first_result_dict, warning_or_None).
    """
    query_parts: list[str] = []
    if title:
        query_parts.append(title)
    if author:
        query_parts.append(author)
    if not query_parts:
        return None, "No search terms provided"

    url = f"{_OPEN_LIBRARY_BASE}/search.json"
    params: dict[str, Any] = {"limit": 1}
    if title:
        params["title"] = title
    if author:
        params["author"] = author

    start = time.monotonic()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp, warning = await _get_with_retry(client, url, params)

    elapsed = int((time.monotonic() - start) * 1000)
    await _log_api_call("open_library_search", url, params, resp.status_code if resp else 0, elapsed)

    if warning or resp is None:
        return None, warning or "No response from Open Library search"

    if resp.status_code != 200:
        return None, f"Open Library search returned HTTP {resp.status_code}"

    try:
        data = resp.json()
    except Exception as exc:
        return None, f"Open Library search JSON parse error: {exc}"

    docs = data.get("docs", [])
    if not docs:
        return None, f"No results found in Open Library for query: {' '.join(query_parts)}"

    doc = docs[0]
    author_keys: list[str] = doc.get("author_key", [])

    return {
        "title": doc.get("title"),
        "authors": doc.get("author_name", []),
        "first_publish_year": doc.get("first_publish_year"),
        "author_key": author_keys[0] if author_keys else None,
        "openlibrary_id": doc.get("key", "").replace("/works/", "") if doc.get("key") else None,
        "isbn": (doc.get("isbn", [None]) or [None])[0],
        "publisher": (doc.get("publisher", [None]) or [None])[0],
        "number_of_pages": doc.get("number_of_pages_median"),
        "subjects": doc.get("subject", [])[:10],
    }, None


# ---------------------------------------------------------------------------
# Gutendex — Gutenberg duplicate check
# ---------------------------------------------------------------------------


async def check_gutenberg(
    title: str,
    author: str | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Search Gutendex for a matching public-domain text.
    Returns (gutenberg_data, warning_or_None) where gutenberg_data may be None
    if no matching PD text is found.
    gutenberg_data keys: gutenberg_id, gutenberg_url, title, author, already_digitised
    """
    search_terms = title
    if author:
        search_terms = f"{title} {author}"

    url = f"{_GUTENDEX_BASE}/books"
    params = {"search": search_terms}
    start = time.monotonic()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp, warning = await _get_with_retry(client, url, params)

    elapsed = int((time.monotonic() - start) * 1000)
    await _log_api_call("gutendex", url, params, resp.status_code if resp else 0, elapsed)

    if warning or resp is None:
        return None, warning or "No response from Gutendex"

    if resp.status_code != 200:
        return None, f"Gutendex returned HTTP {resp.status_code}"

    try:
        data = resp.json()
    except Exception as exc:
        return None, f"Gutendex JSON parse error: {exc}"

    results = data.get("results", [])
    if not results:
        # Clean — not on Gutenberg
        return None, None

    title_lower = title.lower()
    author_lower = (author or "").lower()

    for book in results:
        # Match on title (case-insensitive, partial)
        book_title = book.get("title", "").lower()
        book_authors = [
            a.get("name", "").lower() for a in book.get("authors", [])
        ]
        title_match = title_lower in book_title or book_title in title_lower
        author_match = not author_lower or any(
            author_lower in ba or ba in author_lower for ba in book_authors
        )

        if title_match and author_match:
            # copyright=False means public domain on Gutenberg
            is_pd = book.get("copyright") is False
            if is_pd:
                book_id = book.get("id")
                return {
                    "gutenberg_id": book_id,
                    "gutenberg_url": f"https://www.gutenberg.org/ebooks/{book_id}",
                    "title": book.get("title"),
                    "author": book_authors[0] if book_authors else None,
                    "already_digitised": True,
                }, None

    # Results found but none matched (or copyright not False)
    return None, None
