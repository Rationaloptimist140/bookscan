"""
BookScan — FastAPI application.
All endpoints, middleware, error handling.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
from datetime import datetime

try:
    from datetime import UTC
except ImportError:
    import datetime as _dt_mod
    UTC = _dt_mod.timezone.utc  # type: ignore[assignment]
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse

import database
import external_apis
import ocr_pipeline
import triage_logic
from models import (
    ActivityEntry,
    Book,
    BookCreatePayload,
    BookSort,
    BookUpdatePayload,
    BulkTriageRequest,
    BulkTriageResultRow,
    Dataset,
    DatasetCreatePayload,
    DatasetUpdatePayload,
    HealthResponse,
    MonthlyRevenuePoint,
    PaginatedBooks,
    PlatformRevenueSlice,
    ResaleRecommendation,
    RevenueSummary,
    Sale,
    SaleCreatePayload,
    SaleUpdatePayload,
    ScanPage,
    ScanReviewPayload,
    ScanStatusResponse,
    StatsSummary,
    TriageDistributionSlice,
    TriageHistoryEntry,
    TriageRequest,
    TriageResult,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------

VERSION = "1.0.0"

app = FastAPI(
    title="BookScan API",
    version=VERSION,
    description="Backend for triaging, scanning, and selling pre-2022 books as AI training data.",
)

# CORS
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
origins: list[str] = (
    ["*"] if _raw_origins.strip() == "*"
    else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _db_or_503():
    """Return Supabase client or raise 503."""
    try:
        return database.require_db()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _row_or_404(data: list[dict[str, Any]], entity: str, entity_id: str) -> dict[str, Any]:
    if not data:
        raise HTTPException(status_code=404, detail=f"{entity} {entity_id} not found")
    return data[0]


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _coerce_book(row: dict[str, Any]) -> Book:
    """Convert raw Supabase row to Book model, coercing array nulls."""
    row.setdefault("subject_keywords", [])
    row.setdefault("ai_value_factors", [])
    row.setdefault("provenance_chain", [])
    if row.get("subject_keywords") is None:
        row["subject_keywords"] = []
    if row.get("ai_value_factors") is None:
        row["ai_value_factors"] = []
    if row.get("provenance_chain") is None:
        row["provenance_chain"] = []
    return Book(**row)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/", response_model=HealthResponse, tags=["health"])
@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=VERSION,
        supabase_configured=database.is_configured(),
    )


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@app.get("/api/stats/summary", response_model=StatsSummary, tags=["stats"])
async def get_stats_summary() -> StatsSummary:
    db = _db_or_503()

    total_resp = db.table("books").select("id", count="exact").execute()
    total_books = total_resp.count or 0

    pd_resp = (
        db.table("books")
        .select("id", count="exact")
        .in_("public_domain_status", ["confirmed_pd", "likely_pd"])
        .execute()
    )
    pd_books = pd_resp.count or 0

    ready_resp = (
        db.table("books")
        .select("id", count="exact")
        .eq("triage_action", "scan_and_sell_data")
        .execute()
    )
    ready_to_scan = ready_resp.count or 0

    # Revenue from sales table
    sales_resp = db.table("sales").select("final_price,asking_price,sale_type").eq("status", "sold").execute()
    sales_rows = sales_resp.data or []
    data_revenue = 0.0
    physical_revenue = 0.0
    for s in sales_rows:
        amount = float(s.get("final_price") or s.get("asking_price") or 0)
        if s.get("sale_type") == "data":
            data_revenue += amount
        else:
            physical_revenue += amount
    total_revenue = data_revenue + physical_revenue

    # Acquisition cost
    cost_resp = db.table("books").select("acquisition_cost").execute()
    total_cost = sum(float(r.get("acquisition_cost") or 0) for r in (cost_resp.data or []))

    datasets_resp = db.table("datasets").select("id", count="exact").execute()
    datasets_count = datasets_resp.count or 0

    datasets_sold_resp = (
        db.table("datasets").select("id", count="exact").eq("sale_status", "sold").execute()
    )
    datasets_sold = datasets_sold_resp.count or 0

    pd_pct = round((pd_books / total_books * 100) if total_books else 0, 1)

    return StatsSummary(
        total_books=total_books,
        public_domain_books=pd_books,
        public_domain_pct=pd_pct,
        ready_to_scan=ready_to_scan,
        total_revenue=round(total_revenue, 2),
        data_revenue=round(data_revenue, 2),
        physical_revenue=round(physical_revenue, 2),
        total_acquisition_cost=round(total_cost, 2),
        net_profit=round(total_revenue - total_cost, 2),
        datasets_count=datasets_count,
        datasets_sold=datasets_sold,
    )


@app.get("/api/stats/triage-distribution", response_model=list[TriageDistributionSlice], tags=["stats"])
async def get_triage_distribution() -> list[TriageDistributionSlice]:
    db = _db_or_503()
    resp = db.table("books").select("triage_action").execute()
    rows = resp.data or []

    action_labels = {
        "scan_and_sell_data": "Scan & Sell Data",
        "preserve_only": "Preserve Only",
        "sell_physical": "Sell Physical",
        "already_available": "Already Available",
        "pending": "Pending",
    }
    counts: dict[str, int] = {k: 0 for k in action_labels}
    for row in rows:
        action = row.get("triage_action", "pending") or "pending"
        if action in counts:
            counts[action] += 1

    return [
        TriageDistributionSlice(action=action, label=label, count=counts[action])  # type: ignore[arg-type]
        for action, label in action_labels.items()
    ]


# ---------------------------------------------------------------------------
# Activity feed
# ---------------------------------------------------------------------------


@app.get("/api/activity", response_model=list[ActivityEntry], tags=["stats"])
async def get_activity(limit: int = Query(default=20, ge=1, le=100)) -> list[ActivityEntry]:
    db = _db_or_503()
    entries: list[ActivityEntry] = []

    # Recent books added
    books_resp = (
        db.table("books")
        .select("id,title,author_name,created_at,triage_score")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    for b in books_resp.data or []:
        entries.append(
            ActivityEntry(
                id=b["id"],
                kind="book_added",
                title=b["title"],
                detail=b.get("author_name"),
                amount=None,
                timestamp=b["created_at"],
            )
        )

    # Recent sales
    sales_resp = (
        db.table("sales")
        .select("id,platform,final_price,asking_price,sale_type,sold_at,created_at,book_id")
        .eq("status", "sold")
        .order("sold_at", desc=True)
        .limit(limit)
        .execute()
    )
    for s in sales_resp.data or []:
        amount = float(s.get("final_price") or s.get("asking_price") or 0)
        kind = "dataset_sold" if s.get("sale_type") == "data" else "book_sold"
        entries.append(
            ActivityEntry(
                id=s["id"],
                kind=kind,
                title=f"Sold on {s['platform']}",
                detail=None,
                amount=amount,
                timestamp=s.get("sold_at") or s["created_at"],
            )
        )

    # Recent datasets created
    ds_resp = (
        db.table("datasets")
        .select("id,title,created_at,word_count")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    for d in ds_resp.data or []:
        entries.append(
            ActivityEntry(
                id=d["id"],
                kind="dataset_created",
                title=d["title"],
                detail=f"{d.get('word_count') or 0:,} words" if d.get("word_count") else None,
                amount=None,
                timestamp=d["created_at"],
            )
        )

    # Sort by timestamp descending and truncate
    entries.sort(key=lambda e: e.timestamp, reverse=True)
    return entries[:limit]


# ---------------------------------------------------------------------------
# Triage orchestration
# ---------------------------------------------------------------------------


async def _run_triage(
    isbn: str | None,
    title: str | None,
    author: str | None,
) -> TriageResult:
    """Core triage logic shared by single and bulk endpoints."""
    db_configured = database.is_configured()
    warnings: list[str] = []
    now_str = _now_iso()

    # Normalise ISBN
    normalised_isbn: str | None = None
    if isbn:
        normalised_isbn = triage_logic.normalise_isbn(isbn)
        if not triage_logic.validate_isbn(normalised_isbn):
            warnings.append(f"ISBN {normalised_isbn} failed checksum validation — proceeding anyway.")

    # Check triage cache
    if db_configured:
        try:
            db = database.get_client()
            cache_q = db.table("triage_cache").select("*")
            if normalised_isbn:
                cache_q = cache_q.eq("isbn", normalised_isbn)
            elif title:
                cache_q = cache_q.eq("title", title)
                if author:
                    cache_q = cache_q.eq("author", author)
            cache_q = cache_q.gte("expires_at", now_str).limit(1)
            cache_resp = cache_q.execute()
            if cache_resp.data:
                cached_result = TriageResult(**cache_resp.data[0]["result"])
                cached_result.cached = True
                return cached_result
        except Exception as exc:
            warnings.append(f"Cache lookup failed: {exc}")

    # --- External API lookups ---
    book_data: dict[str, Any] = {}
    author_key: str | None = None

    if normalised_isbn:
        ol_data, warn = await external_apis.lookup_isbn(normalised_isbn)
        if warn:
            warnings.append(warn)
        if ol_data:
            book_data = ol_data
            author_key = ol_data.get("author_key")
    elif title:
        ol_data, warn = await external_apis.search_open_library(title=title, author=author)
        if warn:
            warnings.append(warn)
        if ol_data:
            book_data = ol_data
            author_key = ol_data.get("author_key")

    # Author detail lookup for birth/death years
    author_birth_year: int | None = None
    author_death_year: int | None = None
    if author_key:
        author_detail, warn = await external_apis.lookup_author(author_key)
        if warn:
            warnings.append(warn)
        if author_detail:
            author_birth_year = author_detail.get("birth_year")
            author_death_year = author_detail.get("death_year")

    # Build working values
    resolved_title: str = (
        book_data.get("title")
        or title
        or "Unknown Title"
    )
    resolved_author: str = (
        (book_data.get("authors") or [None])[0]
        or author
        or "Unknown Author"
    )
    publish_year: int | None = (
        book_data.get("first_publish_year")
        or triage_logic._parse_year_from_str(book_data.get("publish_date"))  # type: ignore[attr-defined]
        if book_data.get("publish_date")
        else book_data.get("first_publish_year")
    )
    # Fallback: parse year from publish_date string
    if publish_year is None and book_data.get("publish_date"):
        import re as _re
        m = _re.search(r"\b(\d{4})\b", str(book_data["publish_date"]))
        if m:
            publish_year = int(m.group(1))

    subjects: list[str] = book_data.get("subjects", []) or []
    publisher_name: str | None = (
        (book_data.get("publishers") or [None])[0]
        if book_data.get("publishers")
        else book_data.get("publisher")
    )

    # Gutenberg duplicate check
    gutenberg_data: dict[str, Any] | None = None
    gb_result, gb_warn = await external_apis.check_gutenberg(
        resolved_title, resolved_author
    )
    if gb_warn:
        warnings.append(gb_warn)
    if gb_result:
        gutenberg_data = gb_result

    already_digitised: bool = gutenberg_data is not None and gutenberg_data.get("already_digitised", False)
    gutenberg_id: int | None = gutenberg_data.get("gutenberg_id") if gutenberg_data else None
    gutenberg_url: str | None = gutenberg_data.get("gutenberg_url") if gutenberg_data else None

    # Business logic
    pd_status, pd_reason = triage_logic.determine_public_domain(publish_year, author_death_year)
    ai_value, ai_factors, pre_llm = triage_logic.assess_ai_value(
        publish_year, already_digitised, pd_status, subjects
    )
    triage_score = triage_logic.calculate_triage_score(ai_value, pd_status, already_digitised, pre_llm)
    triage_action = triage_logic.determine_triage_action(ai_value, pd_status, already_digitised)
    resale_rec_dict = triage_logic.recommend_resale_platform(pd_status, ai_value, already_digitised)

    result = TriageResult(
        isbn=normalised_isbn,
        title=resolved_title,
        subtitle=None,
        author_name=resolved_author,
        author_birth_year=author_birth_year,
        author_death_year=author_death_year,
        publisher=publisher_name,
        publish_year=publish_year,
        language=book_data.get("language", "en") or "en",
        page_count=book_data.get("number_of_pages"),
        subject_keywords=subjects[:20],
        description=None,
        public_domain_status=pd_status,  # type: ignore[arg-type]
        public_domain_reason=pd_reason,
        ai_training_value=ai_value,  # type: ignore[arg-type]
        ai_value_factors=ai_factors,
        pre_llm_era=pre_llm,
        triage_action=triage_action,  # type: ignore[arg-type]
        triage_score=triage_score,
        triage_notes=None,
        already_digitised=already_digitised,
        gutenberg_id=gutenberg_id,
        gutenberg_url=gutenberg_url,
        openlibrary_id=book_data.get("openlibrary_id"),
        openlibrary_url=book_data.get("openlibrary_url"),
        resale_recommendation=ResaleRecommendation(**resale_rec_dict),
        cached=False,
        triage_run_at=now_str,
        warnings=warnings,
    )

    # Write to cache (best-effort)
    if db_configured:
        try:
            db = database.get_client()
            cache_row: dict[str, Any] = {
                "isbn": normalised_isbn,
                "title": resolved_title,
                "author": resolved_author,
                "result": result.model_dump(mode="json"),
            }
            db.table("triage_cache").insert(cache_row).execute()
        except Exception as exc:
            logger.warning("Failed to write triage cache: %s", exc)

    return result


@app.post("/api/triage", response_model=TriageResult, tags=["triage"])
async def triage_book(payload: TriageRequest) -> TriageResult:
    if not payload.isbn and not payload.title:
        raise HTTPException(status_code=422, detail="Provide isbn or title to run triage.")
    return await _run_triage(payload.isbn, payload.title, payload.author)


@app.post("/api/triage/bulk", response_model=list[BulkTriageResultRow], tags=["triage"])
async def triage_bulk(payload: BulkTriageRequest) -> list[BulkTriageResultRow]:
    if not payload.isbns:
        raise HTTPException(status_code=422, detail="isbns list must not be empty.")
    results: list[BulkTriageResultRow] = []
    for raw_isbn in payload.isbns:
        try:
            result = await _run_triage(raw_isbn, None, None)
            results.append(BulkTriageResultRow(isbn=raw_isbn, ok=True, error=None, result=result))
        except Exception as exc:
            results.append(BulkTriageResultRow(isbn=raw_isbn, ok=False, error=str(exc), result=None))
    return results


@app.get("/api/triage/history", response_model=list[TriageHistoryEntry], tags=["triage"])
async def triage_history(limit: int = Query(default=50, ge=1, le=200)) -> list[TriageHistoryEntry]:
    db = _db_or_503()
    resp = (
        db.table("triage_cache")
        .select("id,isbn,title,author,result,created_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    entries: list[TriageHistoryEntry] = []
    for row in resp.data or []:
        result_data = row.get("result", {})
        entries.append(
            TriageHistoryEntry(
                id=row["id"],
                isbn=row.get("isbn"),
                title=row.get("title") or result_data.get("title"),
                author=row.get("author") or result_data.get("author_name"),
                triage_score=result_data.get("triage_score", 0),
                triage_action=result_data.get("triage_action", "pending"),  # type: ignore[arg-type]
                created_at=row["created_at"],
            )
        )
    return entries


# ---------------------------------------------------------------------------
# Books CRUD
# ---------------------------------------------------------------------------


@app.post("/api/books", response_model=Book, status_code=201, tags=["books"])
async def create_book(payload: BookCreatePayload) -> Book:
    db = _db_or_503()

    insert_data = payload.model_dump(exclude_none=False, mode="json")
    insert_data.pop("id", None)

    # Remove None values for cleaner inserts (let DB defaults apply)
    insert_data = {k: v for k, v in insert_data.items() if v is not None or k in (
        "isbn", "subtitle", "author_birth_year", "author_death_year",
        "publish_year", "page_count", "description", "public_domain_reason",
        "gutenberg_id", "gutenberg_url", "openlibrary_id", "openlibrary_url",
        "pre_llm_era", "triage_notes", "physical_location", "acquisition_cost",
        "acquisition_date", "acquisition_source", "genre",
    )}

    try:
        resp = db.table("books").insert(insert_data).execute()
    except Exception as exc:
        raise HTTPException(status_code=409, detail=f"Failed to create book: {exc}") from exc

    if not resp.data:
        raise HTTPException(status_code=500, detail="Book creation returned no data.")

    return _coerce_book(resp.data[0])


@app.get("/api/books", response_model=PaginatedBooks, tags=["books"])
async def list_books(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    public_domain_status: str | None = Query(default=None),
    ai_training_value: str | None = Query(default=None),
    triage_action: str | None = Query(default=None),
    scan_status: str | None = Query(default=None),
    sale_status: str | None = Query(default=None),
    sort: BookSort = Query(default=BookSort.newest),
) -> PaginatedBooks:
    db = _db_or_503()

    query = db.table("books").select("*", count="exact")

    # Full-text search via ilike on title + author
    if search:
        query = query.or_(f"title.ilike.%{search}%,author_name.ilike.%{search}%,isbn.ilike.%{search}%")

    # Multi-value filters (comma-separated)
    if public_domain_status:
        values = [v.strip() for v in public_domain_status.split(",") if v.strip()]
        if values:
            query = query.in_("public_domain_status", values)

    if ai_training_value:
        values = [v.strip() for v in ai_training_value.split(",") if v.strip()]
        if values:
            query = query.in_("ai_training_value", values)

    if triage_action:
        values = [v.strip() for v in triage_action.split(",") if v.strip()]
        if values:
            query = query.in_("triage_action", values)

    if scan_status:
        values = [v.strip() for v in scan_status.split(",") if v.strip()]
        if values:
            query = query.in_("scan_status", values)

    if sale_status:
        values = [v.strip() for v in sale_status.split(",") if v.strip()]
        if values:
            query = query.in_("resale_status", values)

    # Sorting
    sort_map: dict[str, tuple[str, bool]] = {
        "newest": ("created_at", True),
        "score_desc": ("triage_score", True),
        "title_asc": ("title", False),
        "author_asc": ("author_name", False),
        "year_asc": ("publish_year", False),
        "year_desc": ("publish_year", True),
    }
    sort_col, sort_desc = sort_map.get(sort.value, ("created_at", True))
    query = query.order(sort_col, desc=sort_desc)

    # Pagination
    offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    resp = query.execute()
    total = resp.count or 0
    items = [_coerce_book(row) for row in (resp.data or [])]
    pages = max(1, (total + limit - 1) // limit)

    return PaginatedBooks(items=items, total=total, page=page, limit=limit, pages=pages)


@app.get("/api/books/{book_id}", response_model=Book, tags=["books"])
async def get_book(book_id: str) -> Book:
    db = _db_or_503()
    resp = db.table("books").select("*").eq("id", book_id).execute()
    row = _row_or_404(resp.data, "Book", book_id)
    return _coerce_book(row)


@app.patch("/api/books/{book_id}", response_model=Book, tags=["books"])
async def update_book(book_id: str, payload: BookUpdatePayload) -> Book:
    db = _db_or_503()

    # Verify book exists
    existing = db.table("books").select("id").eq("id", book_id).execute()
    _row_or_404(existing.data, "Book", book_id)

    update_data = {k: v for k, v in payload.model_dump(mode="json").items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="No update fields provided.")

    # Coerce enum values to strings
    for key, val in update_data.items():
        if hasattr(val, "value"):
            update_data[key] = val.value

    resp = db.table("books").update(update_data).eq("id", book_id).execute()
    row = _row_or_404(resp.data, "Book", book_id)
    return _coerce_book(row)


@app.delete("/api/books/{book_id}", tags=["books"])
async def delete_book(book_id: str) -> dict[str, bool]:
    db = _db_or_503()
    existing = db.table("books").select("id").eq("id", book_id).execute()
    _row_or_404(existing.data, "Book", book_id)
    db.table("books").delete().eq("id", book_id).execute()
    return {"deleted": True}


@app.post("/api/books/{book_id}/rerun-triage", response_model=Book, tags=["books"])
async def rerun_triage(book_id: str) -> Book:
    db = _db_or_503()
    resp = db.table("books").select("*").eq("id", book_id).execute()
    row = _row_or_404(resp.data, "Book", book_id)
    book = _coerce_book(row)

    triage_result = await _run_triage(book.isbn, book.title, book.author_name)

    update_data: dict[str, Any] = {
        "public_domain_status": triage_result.public_domain_status.value,
        "public_domain_reason": triage_result.public_domain_reason,
        "public_domain_checked_at": _now_iso(),
        "ai_training_value": triage_result.ai_training_value.value,
        "ai_value_factors": triage_result.ai_value_factors,
        "pre_llm_era": triage_result.pre_llm_era,
        "triage_action": triage_result.triage_action.value,
        "triage_score": triage_result.triage_score,
        "triage_run_at": triage_result.triage_run_at,
        "already_digitised": triage_result.already_digitised,
        "gutenberg_id": triage_result.gutenberg_id,
        "gutenberg_url": triage_result.gutenberg_url,
    }
    if triage_result.author_death_year and not book.author_death_year:
        update_data["author_death_year"] = triage_result.author_death_year

    update_resp = db.table("books").update(update_data).eq("id", book_id).execute()
    row2 = _row_or_404(update_resp.data, "Book", book_id)
    return _coerce_book(row2)


@app.get("/api/books/{book_id}/resale", response_model=ResaleRecommendation, tags=["books"])
async def get_resale_recommendation(book_id: str) -> ResaleRecommendation:
    db = _db_or_503()
    resp = db.table("books").select("public_domain_status,ai_training_value,already_digitised").eq("id", book_id).execute()
    row = _row_or_404(resp.data, "Book", book_id)

    rec = triage_logic.recommend_resale_platform(
        row.get("public_domain_status", "unknown"),
        row.get("ai_training_value", "unassessed"),
        bool(row.get("already_digitised", False)),
    )
    return ResaleRecommendation(**rec)


# ---------------------------------------------------------------------------
# Scan workflow
# ---------------------------------------------------------------------------


@app.post("/api/scan/queue/{book_id}", response_model=ScanStatusResponse, tags=["scan"])
async def queue_scan(book_id: str) -> ScanStatusResponse:
    db = _db_or_503()
    existing = db.table("books").select("id,scan_status,scan_method").eq("id", book_id).execute()
    _row_or_404(existing.data, "Book", book_id)

    db.table("books").update({
        "scan_status": "queued",
        "scan_started_at": _now_iso(),
    }).eq("id", book_id).execute()

    return ScanStatusResponse(
        book_id=book_id,
        scan_status="queued",  # type: ignore[arg-type]
        scan_method=existing.data[0].get("scan_method"),
        pages_uploaded=0,
        pages_ocr_complete=0,
        pages_reviewed=0,
        ocr_quality_score=None,
        ocr_word_count=None,
        ocr_page_count=None,
        progress_pct=0.0,
        text_preview=None,
    )


@app.post("/api/scan/upload", response_model=ScanPage, tags=["scan"])
async def upload_scan_page(
    book_id: str = Form(...),
    page_number: int = Form(...),
    image_file: UploadFile = File(...),
) -> ScanPage:
    db = _db_or_503()

    # Verify book exists
    existing = db.table("books").select("id").eq("id", book_id).execute()
    _row_or_404(existing.data, "Book", book_id)

    if not image_file.content_type or not image_file.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="Uploaded file must be an image.")

    image_bytes = await image_file.read()
    ext = (image_file.filename or "page.jpg").rsplit(".", 1)[-1].lower()
    image_path = f"{book_id}/{page_number:04d}.{ext}"

    # Upload to Supabase Storage
    try:
        db.storage.from_("scan-pages").upload(
            image_path,
            image_bytes,
            {"content-type": image_file.content_type or "image/jpeg", "upsert": "true"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {exc}") from exc

    # Get public URL (or signed URL)
    try:
        url_data = db.storage.from_("scan-pages").get_public_url(image_path)
        image_url: str | None = url_data if isinstance(url_data, str) else None
    except Exception:
        image_url = None

    # Upsert scan_pages row
    page_row: dict[str, Any] = {
        "book_id": book_id,
        "page_number": page_number,
        "image_path": image_path,
        "image_url": image_url,
    }
    resp = (
        db.table("scan_pages")
        .upsert(page_row, on_conflict="book_id,page_number")
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=500, detail="Failed to save scan page record.")

    # Update book scan_status to 'scanning' if still queued
    db.table("books").update({"scan_status": "scanning"}).eq("id", book_id).eq("scan_status", "queued").execute()

    return ScanPage(**resp.data[0])


@app.post("/api/scan/process/{book_id}", tags=["scan"])
async def process_scan(book_id: str, background_tasks: BackgroundTasks) -> dict[str, Any]:
    db = _db_or_503()
    existing = db.table("books").select("id").eq("id", book_id).execute()
    _row_or_404(existing.data, "Book", book_id)

    pages_resp = db.table("scan_pages").select("id", count="exact").eq("book_id", book_id).execute()
    n_pages = pages_resp.count or 0

    if n_pages == 0:
        raise HTTPException(status_code=422, detail="No scan pages uploaded for this book.")

    background_tasks.add_task(ocr_pipeline.run_ocr_pipeline, book_id)

    return {"queued": True, "pages": n_pages}


@app.get("/api/scan/status/{book_id}", response_model=ScanStatusResponse, tags=["scan"])
async def get_scan_status(book_id: str) -> ScanStatusResponse:
    db = _db_or_503()

    book_resp = db.table("books").select(
        "id,scan_status,scan_method,ocr_quality_score,ocr_word_count,ocr_page_count,ocr_text_path"
    ).eq("id", book_id).execute()
    book_row = _row_or_404(book_resp.data, "Book", book_id)

    pages_resp = db.table("scan_pages").select("id,ocr_text,reviewed").eq("book_id", book_id).execute()
    pages = pages_resp.data or []
    pages_uploaded = len(pages)
    pages_ocr_complete = sum(1 for p in pages if p.get("ocr_text"))
    pages_reviewed = sum(1 for p in pages if p.get("reviewed"))

    progress_pct = (pages_ocr_complete / pages_uploaded * 100.0) if pages_uploaded > 0 else 0.0

    # Text preview from storage
    text_preview: str | None = None
    if book_row.get("ocr_text_path"):
        full_text = ocr_pipeline.get_text_from_storage(db, book_row["ocr_text_path"])
        if full_text:
            words = full_text.split()[:100]
            text_preview = " ".join(words)

    return ScanStatusResponse(
        book_id=book_id,
        scan_status=book_row.get("scan_status", "not_scanned"),  # type: ignore[arg-type]
        scan_method=book_row.get("scan_method"),
        pages_uploaded=pages_uploaded,
        pages_ocr_complete=pages_ocr_complete,
        pages_reviewed=pages_reviewed,
        ocr_quality_score=book_row.get("ocr_quality_score"),
        ocr_word_count=book_row.get("ocr_word_count"),
        ocr_page_count=book_row.get("ocr_page_count"),
        progress_pct=round(progress_pct, 1),
        text_preview=text_preview,
    )


@app.get("/api/scan/text/{book_id}", response_class=PlainTextResponse, tags=["scan"])
async def get_scan_text(book_id: str) -> str:
    db = _db_or_503()
    book_resp = db.table("books").select("ocr_text_path,title").eq("id", book_id).execute()
    book_row = _row_or_404(book_resp.data, "Book", book_id)

    ocr_path = book_row.get("ocr_text_path")
    if not ocr_path:
        raise HTTPException(status_code=404, detail="No OCR text available for this book.")

    text = ocr_pipeline.get_text_from_storage(db, ocr_path)
    if text is None:
        raise HTTPException(status_code=404, detail="OCR text file not found in storage.")

    return text


@app.patch("/api/scan/review/{book_id}", response_model=ScanStatusResponse, tags=["scan"])
async def review_scan(book_id: str, payload: ScanReviewPayload) -> ScanStatusResponse:
    db = _db_or_503()
    existing = db.table("books").select("id").eq("id", book_id).execute()
    _row_or_404(existing.data, "Book", book_id)

    update: dict[str, Any] = {}
    if payload.ocr_quality_score is not None:
        update["ocr_quality_score"] = payload.ocr_quality_score
    if payload.reviewed is True:
        update["scan_status"] = "reviewed"

    if update:
        db.table("books").update(update).eq("id", book_id).execute()

    return await get_scan_status(book_id)


# ---------------------------------------------------------------------------
# Datasets
# ---------------------------------------------------------------------------


def _build_dataset_text_path(book_id: str, dataset_id: str) -> str:
    return f"datasets/{book_id}/{dataset_id}.txt"


@app.post("/api/datasets", response_model=Dataset, status_code=201, tags=["datasets"])
async def create_dataset(payload: DatasetCreatePayload) -> Dataset:
    db = _db_or_503()

    # Verify book exists and has OCR text
    book_resp = db.table("books").select("id,ocr_text_path,ocr_quality_score,ocr_word_count,ocr_page_count,title").eq("id", payload.book_id).execute()
    book_row = _row_or_404(book_resp.data, "Book", payload.book_id)

    if not book_row.get("ocr_text_path"):
        raise HTTPException(status_code=422, detail="Book has no OCR text. Run OCR pipeline first.")

    # Fetch full text and generate preview
    full_text = ocr_pipeline.get_text_from_storage(db, book_row["ocr_text_path"])
    text_preview: str | None = None
    if full_text:
        words = full_text.split()
        text_preview = " ".join(words[:500])

    # Build provenance document
    provenance: dict[str, Any] = {
        "source_book_id": payload.book_id,
        "source_book_title": book_row.get("title"),
        "ocr_quality_score": book_row.get("ocr_quality_score"),
        "created_at": _now_iso(),
        "pipeline": "bookscan-ocr-v1",
    }

    # The text_file_path points at the OCR output; create a stable path
    text_file_path = book_row["ocr_text_path"]

    insert_row: dict[str, Any] = {
        "book_id": payload.book_id,
        "title": payload.title,
        "description": payload.description,
        "domain_tags": payload.domain_tags,
        "language": payload.language,
        "word_count": book_row.get("ocr_word_count"),
        "page_count": book_row.get("ocr_page_count"),
        "text_file_path": text_file_path,
        "text_preview": text_preview,
        "ocr_quality_score": book_row.get("ocr_quality_score"),
        "provenance_document": provenance,
        "asking_price": payload.asking_price,
    }

    resp = db.table("datasets").insert(insert_row).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Dataset creation returned no data.")

    return Dataset(**resp.data[0])


@app.get("/api/datasets", response_model=list[Dataset], tags=["datasets"])
async def list_datasets(
    domain: str | None = Query(default=None),
    language: str | None = Query(default=None),
    sale_status: str | None = Query(default=None),
) -> list[Dataset]:
    db = _db_or_503()
    query = db.table("datasets").select("*").order("created_at", desc=True)

    if language:
        query = query.eq("language", language)

    if sale_status:
        values = [v.strip() for v in sale_status.split(",") if v.strip()]
        if values:
            query = query.in_("sale_status", values)

    resp = query.execute()
    rows = resp.data or []

    # Domain filter (array contains)
    if domain:
        rows = [r for r in rows if domain in (r.get("domain_tags") or [])]

    return [Dataset(**row) for row in rows]


@app.get("/api/datasets/{dataset_id}", response_model=Dataset, tags=["datasets"])
async def get_dataset(dataset_id: str) -> Dataset:
    db = _db_or_503()
    resp = db.table("datasets").select("*").eq("id", dataset_id).execute()
    row = _row_or_404(resp.data, "Dataset", dataset_id)
    return Dataset(**row)


@app.patch("/api/datasets/{dataset_id}", response_model=Dataset, tags=["datasets"])
async def update_dataset(dataset_id: str, payload: DatasetUpdatePayload) -> Dataset:
    db = _db_or_503()
    existing = db.table("datasets").select("id").eq("id", dataset_id).execute()
    _row_or_404(existing.data, "Dataset", dataset_id)

    update_data = {k: v for k, v in payload.model_dump(mode="json").items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="No update fields provided.")

    # Timestamp helpers
    if update_data.get("sale_status") == "listed" and "listed_at" not in update_data:
        update_data["listed_at"] = _now_iso()
    if update_data.get("sale_status") == "sold" and "sold_at" not in update_data:
        update_data["sold_at"] = _now_iso()

    resp = db.table("datasets").update(update_data).eq("id", dataset_id).execute()
    row = _row_or_404(resp.data, "Dataset", dataset_id)
    return Dataset(**row)


@app.delete("/api/datasets/{dataset_id}", tags=["datasets"])
async def delete_dataset(dataset_id: str) -> dict[str, bool]:
    db = _db_or_503()
    existing = db.table("datasets").select("id").eq("id", dataset_id).execute()
    _row_or_404(existing.data, "Dataset", dataset_id)
    db.table("datasets").delete().eq("id", dataset_id).execute()
    return {"deleted": True}


@app.get("/api/datasets/{dataset_id}/preview", tags=["datasets"])
async def get_dataset_preview(dataset_id: str) -> dict[str, Any]:
    db = _db_or_503()
    resp = db.table("datasets").select("text_file_path,text_preview,word_count").eq("id", dataset_id).execute()
    row = _row_or_404(resp.data, "Dataset", dataset_id)

    # Return cached preview if available
    if row.get("text_preview"):
        words = row["text_preview"].split()
        return {"preview": " ".join(words[:500]), "word_count": row.get("word_count") or 0}

    # Load from storage
    text = ocr_pipeline.get_text_from_storage(db, row["text_file_path"])
    if not text:
        raise HTTPException(status_code=404, detail="Dataset text file not found in storage.")

    words = text.split()
    return {"preview": " ".join(words[:500]), "word_count": len(words)}


@app.get("/api/datasets/{dataset_id}/download", response_class=PlainTextResponse, tags=["datasets"])
async def download_dataset(dataset_id: str) -> str:
    db = _db_or_503()
    resp = db.table("datasets").select("text_file_path,title").eq("id", dataset_id).execute()
    row = _row_or_404(resp.data, "Dataset", dataset_id)

    text = ocr_pipeline.get_text_from_storage(db, row["text_file_path"])
    if not text:
        raise HTTPException(status_code=404, detail="Dataset text file not found in storage.")

    return text


# ---------------------------------------------------------------------------
# Sales — register /revenue/summary BEFORE /{sale_id}
# ---------------------------------------------------------------------------


@app.get("/api/sales/revenue/summary", response_model=RevenueSummary, tags=["sales"])
async def get_revenue_summary() -> RevenueSummary:
    db = _db_or_503()

    sold_resp = db.table("sales").select("*").eq("status", "sold").execute()
    sales = sold_resp.data or []

    data_revenue = 0.0
    physical_revenue = 0.0
    monthly: dict[str, dict[str, float]] = {}
    platform_totals: dict[str, dict[str, Any]] = {}

    for s in sales:
        amount = float(s.get("final_price") or s.get("asking_price") or 0)
        sale_type = s.get("sale_type", "physical")
        platform = s.get("platform", "unknown")

        if sale_type == "data":
            data_revenue += amount
        else:
            physical_revenue += amount

        # Monthly aggregation
        ts = s.get("sold_at") or s.get("created_at") or ""
        month_key = ts[:7] if len(ts) >= 7 else "unknown"
        if month_key not in monthly:
            monthly[month_key] = {"data_revenue": 0.0, "physical_revenue": 0.0}
        monthly[month_key]["data_revenue" if sale_type == "data" else "physical_revenue"] += amount

        # Platform aggregation
        if platform not in platform_totals:
            platform_totals[platform] = {"revenue": 0.0, "count": 0}
        platform_totals[platform]["revenue"] += amount
        platform_totals[platform]["count"] += 1

    total_revenue = data_revenue + physical_revenue

    by_month: list[MonthlyRevenuePoint] = []
    for month_key in sorted(monthly.keys()):
        if month_key == "unknown":
            continue
        try:
            dt = datetime.strptime(month_key, "%Y-%m")
            label = dt.strftime("%b %y")
        except ValueError:
            label = month_key
        m = monthly[month_key]
        by_month.append(
            MonthlyRevenuePoint(
                month=month_key,
                label=label,
                data_revenue=round(m["data_revenue"], 2),
                physical_revenue=round(m["physical_revenue"], 2),
                total=round(m["data_revenue"] + m["physical_revenue"], 2),
            )
        )

    by_platform: list[PlatformRevenueSlice] = [
        PlatformRevenueSlice(
            platform=plat,
            label=plat.replace("_", " ").title(),
            revenue=round(v["revenue"], 2),
            count=v["count"],
        )
        for plat, v in sorted(platform_totals.items(), key=lambda x: x[1]["revenue"], reverse=True)
    ]

    return RevenueSummary(
        total_revenue=round(total_revenue, 2),
        data_revenue=round(data_revenue, 2),
        physical_revenue=round(physical_revenue, 2),
        by_month=by_month,
        by_platform=by_platform,
    )


@app.post("/api/sales", response_model=Sale, status_code=201, tags=["sales"])
async def create_sale(payload: SaleCreatePayload) -> Sale:
    db = _db_or_503()

    insert_data = {k: v for k, v in payload.model_dump(mode="json").items() if v is not None}

    if insert_data.get("status") == "listed":
        insert_data.setdefault("listed_at", _now_iso())
    if insert_data.get("status") == "sold":
        insert_data.setdefault("sold_at", _now_iso())

    resp = db.table("sales").insert(insert_data).execute()
    if not resp.data:
        raise HTTPException(status_code=500, detail="Sale creation returned no data.")

    sale_row = resp.data[0]

    # Denormalise book title
    if sale_row.get("book_id"):
        book_resp = db.table("books").select("title").eq("id", sale_row["book_id"]).execute()
        if book_resp.data:
            sale_row["book_title"] = book_resp.data[0]["title"]

    return Sale(**sale_row)


@app.get("/api/sales", response_model=list[Sale], tags=["sales"])
async def list_sales(
    sale_type: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
) -> list[Sale]:
    db = _db_or_503()
    query = db.table("sales").select("*").order("created_at", desc=True)

    if sale_type:
        query = query.eq("sale_type", sale_type)
    if platform:
        query = query.eq("platform", platform)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    resp = query.execute()
    sales: list[Sale] = []
    for row in resp.data or []:
        if row.get("book_id"):
            try:
                br = db.table("books").select("title").eq("id", row["book_id"]).execute()
                if br.data:
                    row["book_title"] = br.data[0]["title"]
            except Exception:
                pass
        sales.append(Sale(**row))
    return sales


@app.get("/api/sales/{sale_id}", response_model=Sale, tags=["sales"])
async def get_sale(sale_id: str) -> Sale:
    db = _db_or_503()
    resp = db.table("sales").select("*").eq("id", sale_id).execute()
    row = _row_or_404(resp.data, "Sale", sale_id)

    if row.get("book_id"):
        try:
            br = db.table("books").select("title").eq("id", row["book_id"]).execute()
            if br.data:
                row["book_title"] = br.data[0]["title"]
        except Exception:
            pass

    return Sale(**row)


@app.patch("/api/sales/{sale_id}", response_model=Sale, tags=["sales"])
async def update_sale(sale_id: str, payload: SaleUpdatePayload) -> Sale:
    db = _db_or_503()
    existing = db.table("sales").select("id").eq("id", sale_id).execute()
    _row_or_404(existing.data, "Sale", sale_id)

    update_data = {k: v for k, v in payload.model_dump(mode="json").items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="No update fields provided.")

    if update_data.get("status") == "sold" and "sold_at" not in update_data:
        update_data["sold_at"] = _now_iso()
    if update_data.get("status") == "listed" and "listed_at" not in update_data:
        update_data["listed_at"] = _now_iso()

    resp = db.table("sales").update(update_data).eq("id", sale_id).execute()
    row = _row_or_404(resp.data, "Sale", sale_id)
    return Sale(**row)


@app.delete("/api/sales/{sale_id}", tags=["sales"])
async def delete_sale(sale_id: str) -> dict[str, bool]:
    db = _db_or_503()
    existing = db.table("sales").select("id").eq("id", sale_id).execute()
    _row_or_404(existing.data, "Sale", sale_id)
    db.table("sales").delete().eq("id", sale_id).execute()
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


@app.get("/api/export/inventory.csv", tags=["export"])
async def export_inventory_csv() -> StreamingResponse:
    db = _db_or_503()
    resp = db.table("books").select("*").order("created_at", desc=True).execute()
    rows = resp.data or []

    output = io.StringIO()
    if rows:
        fieldnames = [
            "id", "isbn", "title", "author_name", "publish_year",
            "public_domain_status", "ai_training_value", "triage_action",
            "triage_score", "scan_status", "resale_status", "resale_price",
            "acquisition_cost", "language", "page_count", "genre",
            "condition", "created_at",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bookscan-inventory.csv"},
    )


@app.get("/api/export/books/{book_id}.json", tags=["export"])
async def export_book_json(book_id: str) -> StreamingResponse:
    db = _db_or_503()
    resp = db.table("books").select("*").eq("id", book_id).execute()
    row = _row_or_404(resp.data, "Book", book_id)

    book = _coerce_book(row)
    json_bytes = book.model_dump_json(indent=2).encode("utf-8")

    return StreamingResponse(
        iter([json_bytes]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=book-{book_id}.json"},
    )
