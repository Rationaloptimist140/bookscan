"""
BookScan — Pydantic v2 models.
Mirrors lib/types.ts field-for-field.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# StrEnum definitions (must match TypeScript literal unions exactly)
# ---------------------------------------------------------------------------


class PublicDomainStatus(str, enum.Enum):
    confirmed_pd = "confirmed_pd"
    likely_pd = "likely_pd"
    not_pd = "not_pd"
    unknown = "unknown"


class AiTrainingValue(str, enum.Enum):
    premium = "premium"
    high = "high"
    medium = "medium"
    low = "low"
    none = "none"
    unassessed = "unassessed"


class TriageAction(str, enum.Enum):
    scan_and_sell_data = "scan_and_sell_data"
    preserve_only = "preserve_only"
    sell_physical = "sell_physical"
    already_available = "already_available"
    pending = "pending"


class ScanStatus(str, enum.Enum):
    not_scanned = "not_scanned"
    queued = "queued"
    scanning = "scanning"
    scanned = "scanned"
    ocr_complete = "ocr_complete"
    reviewed = "reviewed"
    ready_for_sale = "ready_for_sale"


class ResaleStatus(str, enum.Enum):
    not_listed = "not_listed"
    listed = "listed"
    sold = "sold"
    delisted = "delisted"


class DatasetSaleStatus(str, enum.Enum):
    not_listed = "not_listed"
    listed = "listed"
    negotiating = "negotiating"
    sold = "sold"
    rejected = "rejected"
    expired = "expired"


class SaleStatus(str, enum.Enum):
    draft = "draft"
    listed = "listed"
    negotiating = "negotiating"
    sold = "sold"
    rejected = "rejected"
    expired = "expired"


class SaleType(str, enum.Enum):
    data = "data"
    physical = "physical"


class BookCondition(str, enum.Enum):
    mint = "mint"
    very_good = "very_good"
    good = "good"
    fair = "fair"
    poor = "poor"
    unknown = "unknown"


class CopiesSurviving(str, enum.Enum):
    unique = "unique"
    very_rare = "very_rare"
    rare = "rare"
    uncommon = "uncommon"
    common = "common"
    unknown = "unknown"


class BookSort(str, enum.Enum):
    newest = "newest"
    score_desc = "score_desc"
    title_asc = "title_asc"
    author_asc = "author_asc"
    year_asc = "year_asc"
    year_desc = "year_desc"


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class ProvenanceEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event: str
    date: str | None = None
    detail: str | None = None
    cost: float | None = None
    platform: str | None = None
    price: float | None = None
    quality: float | None = None
    method: str | None = None


class ResaleRecommendation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    platform: str
    platform_label: str
    reason: str
    estimated_price_range: str
    listing_tips: list[str]


# ---------------------------------------------------------------------------
# Core entity: Book
# ---------------------------------------------------------------------------


class Book(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    isbn: str | None = None
    title: str
    subtitle: str | None = None
    author_name: str
    author_birth_year: int | None = None
    author_death_year: int | None = None
    publisher: str | None = None
    publish_year: int | None = None
    publish_date_exact: str | None = None
    language: str = "en"
    page_count: int | None = None
    genre: str | None = None
    subject_keywords: list[str] = Field(default_factory=list)
    description: str | None = None

    public_domain_status: PublicDomainStatus = PublicDomainStatus.unknown
    public_domain_reason: str | None = None
    public_domain_checked_at: str | None = None

    gutenberg_id: int | None = None
    gutenberg_url: str | None = None
    openlibrary_id: str | None = None
    openlibrary_url: str | None = None
    already_digitised: bool = False
    digitised_source: str | None = None

    estimated_copies_surviving: CopiesSurviving = CopiesSurviving.unknown
    worldcat_holding_count: int | None = None

    ai_training_value: AiTrainingValue = AiTrainingValue.unassessed
    ai_value_factors: list[str] = Field(default_factory=list)
    pre_llm_era: bool | None = None

    triage_action: TriageAction = TriageAction.pending
    triage_notes: str | None = None
    triage_score: int = 0
    triage_run_at: str | None = None

    physical_location: str | None = None
    acquisition_cost: float | None = None
    acquisition_date: str | None = None
    acquisition_source: str | None = None
    condition: BookCondition = BookCondition.good

    scan_status: ScanStatus = ScanStatus.not_scanned
    scan_method: str | None = None
    scan_started_at: str | None = None
    scan_completed_at: str | None = None
    ocr_text_path: str | None = None
    ocr_quality_score: float | None = None
    ocr_word_count: int | None = None
    ocr_page_count: int | None = None

    resale_status: ResaleStatus = ResaleStatus.not_listed
    resale_platform: str | None = None
    resale_price: float | None = None
    resale_listed_at: str | None = None
    resale_sold_at: str | None = None

    provenance_chain: list[ProvenanceEntry] = Field(default_factory=list)

    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# ScanPage
# ---------------------------------------------------------------------------


class ScanPage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    book_id: str
    page_number: int
    image_path: str
    image_url: str | None = None
    ocr_text: str | None = None
    ocr_confidence: float | None = None
    reviewed: bool = False
    reviewed_text: str | None = None
    created_at: str


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------


class Dataset(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    book_id: str
    title: str
    description: str | None = None
    domain_tags: list[str] = Field(default_factory=list)
    language: str = "en"
    word_count: int | None = None
    page_count: int | None = None
    text_file_path: str
    text_preview: str | None = None
    ocr_quality_score: float | None = None
    provenance_document: dict[str, Any] = Field(default_factory=dict)

    sale_status: DatasetSaleStatus = DatasetSaleStatus.not_listed
    asking_price: float | None = None
    final_price: float | None = None
    listed_platform: str | None = None
    listed_url: str | None = None
    buyer_name: str | None = None
    buyer_type: str | None = None
    nda_signed: bool = False
    listed_at: str | None = None
    sold_at: str | None = None

    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Sale
# ---------------------------------------------------------------------------


class Sale(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    book_id: str | None = None
    dataset_id: str | None = None
    sale_type: SaleType
    platform: str
    listing_url: str | None = None
    asking_price: float | None = None
    final_price: float | None = None
    buyer_name: str | None = None
    buyer_type: str | None = None
    nda_signed: bool = False
    status: SaleStatus = SaleStatus.draft
    listed_at: str | None = None
    sold_at: str | None = None
    notes: str | None = None
    created_at: str
    book_title: str | None = None


# ---------------------------------------------------------------------------
# Triage models
# ---------------------------------------------------------------------------


class TriageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    isbn: str | None = None
    title: str | None = None
    author: str | None = None


class BulkTriageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    isbns: list[str]


class TriageResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    isbn: str | None = None
    title: str
    subtitle: str | None = None
    author_name: str
    author_birth_year: int | None = None
    author_death_year: int | None = None
    publisher: str | None = None
    publish_year: int | None = None
    language: str = "en"
    page_count: int | None = None
    subject_keywords: list[str] = Field(default_factory=list)
    description: str | None = None

    public_domain_status: PublicDomainStatus
    public_domain_reason: str
    ai_training_value: AiTrainingValue
    ai_value_factors: list[str]
    pre_llm_era: bool | None = None
    triage_action: TriageAction
    triage_score: int
    triage_notes: str | None = None

    already_digitised: bool
    gutenberg_id: int | None = None
    gutenberg_url: str | None = None
    openlibrary_id: str | None = None
    openlibrary_url: str | None = None

    resale_recommendation: ResaleRecommendation

    cached: bool = False
    triage_run_at: str
    warnings: list[str] = Field(default_factory=list)


class BulkTriageResultRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    isbn: str
    ok: bool
    error: str | None = None
    result: TriageResult | None = None


class TriageHistoryEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    isbn: str | None = None
    title: str | None = None
    author: str | None = None
    triage_score: int
    triage_action: TriageAction
    created_at: str


# ---------------------------------------------------------------------------
# Dashboard / analytics
# ---------------------------------------------------------------------------


class StatsSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_books: int
    public_domain_books: int
    public_domain_pct: float
    ready_to_scan: int
    total_revenue: float
    data_revenue: float
    physical_revenue: float
    total_acquisition_cost: float
    net_profit: float
    datasets_count: int
    datasets_sold: int


class MonthlyRevenuePoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    month: str
    label: str
    data_revenue: float
    physical_revenue: float
    total: float


class TriageDistributionSlice(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: TriageAction
    label: str
    count: int


class PlatformRevenueSlice(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    platform: str
    label: str
    revenue: float
    count: int


class ActivityEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    kind: str  # book_added | book_sold | dataset_created | dataset_sold | scan_complete
    title: str
    detail: str | None = None
    amount: float | None = None
    timestamp: str


class RevenueSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_revenue: float
    data_revenue: float
    physical_revenue: float
    by_month: list[MonthlyRevenuePoint]
    by_platform: list[PlatformRevenueSlice]


# ---------------------------------------------------------------------------
# Scan workflow
# ---------------------------------------------------------------------------


class ScanStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    book_id: str
    scan_status: ScanStatus
    scan_method: str | None = None
    pages_uploaded: int
    pages_ocr_complete: int
    pages_reviewed: int
    ocr_quality_score: float | None = None
    ocr_word_count: int | None = None
    ocr_page_count: int | None = None
    progress_pct: float
    text_preview: str | None = None


# ---------------------------------------------------------------------------
# Request payloads
# ---------------------------------------------------------------------------


class BookCreatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    isbn: str | None = None
    title: str
    subtitle: str | None = None
    author_name: str
    author_birth_year: int | None = None
    author_death_year: int | None = None
    publisher: str | None = None
    publish_year: int | None = None
    language: str = "en"
    page_count: int | None = None
    genre: str | None = None
    subject_keywords: list[str] = Field(default_factory=list)
    description: str | None = None
    public_domain_status: PublicDomainStatus = PublicDomainStatus.unknown
    public_domain_reason: str | None = None
    gutenberg_id: int | None = None
    gutenberg_url: str | None = None
    openlibrary_id: str | None = None
    openlibrary_url: str | None = None
    already_digitised: bool = False
    ai_training_value: AiTrainingValue = AiTrainingValue.unassessed
    ai_value_factors: list[str] = Field(default_factory=list)
    pre_llm_era: bool | None = None
    triage_action: TriageAction = TriageAction.pending
    triage_score: int = 0
    triage_notes: str | None = None
    physical_location: str | None = None
    acquisition_cost: float | None = None
    acquisition_date: str | None = None
    acquisition_source: str | None = None
    condition: BookCondition = BookCondition.good

    @field_validator("triage_score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("triage_score must be between 0 and 100")
        return v


class BookUpdatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    isbn: str | None = None
    title: str | None = None
    subtitle: str | None = None
    author_name: str | None = None
    author_birth_year: int | None = None
    author_death_year: int | None = None
    publisher: str | None = None
    publish_year: int | None = None
    language: str | None = None
    page_count: int | None = None
    genre: str | None = None
    subject_keywords: list[str] | None = None
    description: str | None = None
    public_domain_status: PublicDomainStatus | None = None
    public_domain_reason: str | None = None
    gutenberg_id: int | None = None
    gutenberg_url: str | None = None
    openlibrary_id: str | None = None
    openlibrary_url: str | None = None
    already_digitised: bool | None = None
    ai_training_value: AiTrainingValue | None = None
    ai_value_factors: list[str] | None = None
    pre_llm_era: bool | None = None
    triage_action: TriageAction | None = None
    triage_score: int | None = None
    triage_notes: str | None = None
    physical_location: str | None = None
    acquisition_cost: float | None = None
    acquisition_date: str | None = None
    acquisition_source: str | None = None
    condition: BookCondition | None = None
    scan_status: ScanStatus | None = None
    scan_method: str | None = None
    resale_status: ResaleStatus | None = None
    resale_platform: str | None = None
    resale_price: float | None = None
    estimated_copies_surviving: CopiesSurviving | None = None


class DatasetCreatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    book_id: str
    title: str
    description: str | None = None
    domain_tags: list[str] = Field(default_factory=list)
    language: str = "en"
    asking_price: float | None = None


class DatasetUpdatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = None
    description: str | None = None
    domain_tags: list[str] | None = None
    asking_price: float | None = None
    final_price: float | None = None
    sale_status: DatasetSaleStatus | None = None
    listed_platform: str | None = None
    listed_url: str | None = None
    buyer_name: str | None = None
    buyer_type: str | None = None
    nda_signed: bool | None = None


class SaleCreatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    book_id: str | None = None
    dataset_id: str | None = None
    sale_type: SaleType
    platform: str
    listing_url: str | None = None
    asking_price: float | None = None
    final_price: float | None = None
    buyer_name: str | None = None
    buyer_type: str | None = None
    nda_signed: bool = False
    status: SaleStatus = SaleStatus.draft
    notes: str | None = None


class SaleUpdatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    book_id: str | None = None
    dataset_id: str | None = None
    sale_type: SaleType | None = None
    platform: str | None = None
    listing_url: str | None = None
    asking_price: float | None = None
    final_price: float | None = None
    buyer_name: str | None = None
    buyer_type: str | None = None
    nda_signed: bool | None = None
    status: SaleStatus | None = None
    notes: str | None = None


class ScanReviewPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ocr_quality_score: float | None = None
    reviewed: bool | None = None


# ---------------------------------------------------------------------------
# Generic paginated response
# ---------------------------------------------------------------------------


class PaginatedBooks(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[Book]
    total: int
    page: int
    limit: int
    pages: int


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str
    version: str
    supabase_configured: bool
