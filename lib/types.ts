/**
 * BookScan — Shared Type Contracts
 * ================================
 * SOURCE OF TRUTH for all shared types, enums, status values and API payload
 * shapes across the frontend. The FastAPI backend's Pydantic models mirror
 * these definitions exactly. Do not diverge without updating both sides.
 */

/* ------------------------------------------------------------------ */
/* Enumerations — must match backend CHECK constraints in schema.sql   */
/* ------------------------------------------------------------------ */

export const PUBLIC_DOMAIN_STATUSES = [
  'confirmed_pd',
  'likely_pd',
  'not_pd',
  'unknown',
] as const;
export type PublicDomainStatus = (typeof PUBLIC_DOMAIN_STATUSES)[number];

export const AI_TRAINING_VALUES = [
  'premium',
  'high',
  'medium',
  'low',
  'none',
  'unassessed',
] as const;
export type AiTrainingValue = (typeof AI_TRAINING_VALUES)[number];

export const TRIAGE_ACTIONS = [
  'scan_and_sell_data',
  'preserve_only',
  'sell_physical',
  'already_available',
  'pending',
] as const;
export type TriageAction = (typeof TRIAGE_ACTIONS)[number];

export const SCAN_STATUSES = [
  'not_scanned',
  'queued',
  'scanning',
  'scanned',
  'ocr_complete',
  'reviewed',
  'ready_for_sale',
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const RESALE_STATUSES = ['not_listed', 'listed', 'sold', 'delisted'] as const;
export type ResaleStatus = (typeof RESALE_STATUSES)[number];

export const DATASET_SALE_STATUSES = [
  'not_listed',
  'listed',
  'negotiating',
  'sold',
  'rejected',
  'expired',
] as const;
export type DatasetSaleStatus = (typeof DATASET_SALE_STATUSES)[number];

export const SALE_STATUSES = [
  'draft',
  'listed',
  'negotiating',
  'sold',
  'rejected',
  'expired',
] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const SALE_TYPES = ['data', 'physical'] as const;
export type SaleType = (typeof SALE_TYPES)[number];

export const BOOK_CONDITIONS = [
  'mint',
  'very_good',
  'good',
  'fair',
  'poor',
  'unknown',
] as const;
export type BookCondition = (typeof BOOK_CONDITIONS)[number];

export const COPIES_SURVIVING = [
  'unique',
  'very_rare',
  'rare',
  'uncommon',
  'common',
  'unknown',
] as const;
export type CopiesSurviving = (typeof COPIES_SURVIVING)[number];

export const RESALE_PLATFORMS = [
  'abebooks',
  'ebay',
  'amazon',
  'ziffit',
  'amazon_or_ziffit',
  'world_of_books',
  'direct',
] as const;
export type ResalePlatform = (typeof RESALE_PLATFORMS)[number];

export const DATA_PLATFORMS = [
  'defined_ai',
  'aws_data_exchange',
  'hugging_face',
  'direct',
] as const;
export type DataPlatform = (typeof DATA_PLATFORMS)[number];

export const SCAN_METHODS = [
  'phone_camera',
  'document_scanner',
  'dslr',
  'flatbed',
] as const;
export type ScanMethod = (typeof SCAN_METHODS)[number];

/* ------------------------------------------------------------------ */
/* Core entities                                                       */
/* ------------------------------------------------------------------ */

/** A provenance chain entry — an auditable event in a book's lifecycle. */
export interface ProvenanceEntry {
  event: string;
  date: string | null;
  detail?: string | null;
  cost?: number | null;
  platform?: string | null;
  price?: number | null;
  quality?: number | null;
  method?: string | null;
}

export interface Book {
  id: string;
  isbn: string | null;
  title: string;
  subtitle: string | null;
  author_name: string;
  author_birth_year: number | null;
  author_death_year: number | null;
  publisher: string | null;
  publish_year: number | null;
  publish_date_exact: string | null;
  language: string;
  page_count: number | null;
  genre: string | null;
  subject_keywords: string[];
  description: string | null;

  // Public domain
  public_domain_status: PublicDomainStatus;
  public_domain_reason: string | null;
  public_domain_checked_at: string | null;

  // External cross-references
  gutenberg_id: number | null;
  gutenberg_url: string | null;
  openlibrary_id: string | null;
  openlibrary_url: string | null;
  already_digitised: boolean;
  digitised_source: string | null;

  // Rarity
  estimated_copies_surviving: CopiesSurviving;
  worldcat_holding_count: number | null;

  // AI training value
  ai_training_value: AiTrainingValue;
  ai_value_factors: string[];
  pre_llm_era: boolean | null;

  // Triage
  triage_action: TriageAction;
  triage_notes: string | null;
  triage_score: number;
  triage_run_at: string | null;

  // Physical tracking
  physical_location: string | null;
  acquisition_cost: number | null;
  acquisition_date: string | null;
  acquisition_source: string | null;
  condition: BookCondition;

  // Scanning
  scan_status: ScanStatus;
  scan_method: string | null;
  scan_started_at: string | null;
  scan_completed_at: string | null;
  ocr_text_path: string | null;
  ocr_quality_score: number | null;
  ocr_word_count: number | null;
  ocr_page_count: number | null;

  // Physical resale
  resale_status: ResaleStatus;
  resale_platform: string | null;
  resale_price: number | null;
  resale_listed_at: string | null;
  resale_sold_at: string | null;

  provenance_chain: ProvenanceEntry[];

  created_at: string;
  updated_at: string;
}

export interface ScanPage {
  id: string;
  book_id: string;
  page_number: number;
  image_path: string;
  image_url: string | null;
  ocr_text: string | null;
  ocr_confidence: number | null;
  reviewed: boolean;
  reviewed_text: string | null;
  created_at: string;
}

export interface Dataset {
  id: string;
  book_id: string;
  title: string;
  description: string | null;
  domain_tags: string[];
  language: string;
  word_count: number | null;
  page_count: number | null;
  text_file_path: string;
  text_preview: string | null;
  ocr_quality_score: number | null;
  provenance_document: Record<string, unknown>;

  sale_status: DatasetSaleStatus;
  asking_price: number | null;
  final_price: number | null;
  listed_platform: string | null;
  listed_url: string | null;
  buyer_name: string | null;
  buyer_type: string | null;
  nda_signed: boolean;
  listed_at: string | null;
  sold_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  book_id: string | null;
  dataset_id: string | null;
  sale_type: SaleType;
  platform: string;
  listing_url: string | null;
  asking_price: number | null;
  final_price: number | null;
  buyer_name: string | null;
  buyer_type: string | null;
  nda_signed: boolean;
  status: SaleStatus;
  listed_at: string | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
  /** Denormalised for table display — populated by the backend join. */
  book_title?: string | null;
}

/* ------------------------------------------------------------------ */
/* Triage                                                              */
/* ------------------------------------------------------------------ */

export interface TriageRequest {
  isbn?: string;
  title?: string;
  author?: string;
}

export interface BulkTriageRequest {
  isbns: string[];
}

export interface ResaleRecommendation {
  platform: string;
  platform_label: string;
  reason: string;
  estimated_price_range: string;
  listing_tips: string[];
}

export interface TriageResult {
  // Identity
  isbn: string | null;
  title: string;
  subtitle: string | null;
  author_name: string;
  author_birth_year: number | null;
  author_death_year: number | null;
  publisher: string | null;
  publish_year: number | null;
  language: string;
  page_count: number | null;
  subject_keywords: string[];
  description: string | null;

  // Assessment
  public_domain_status: PublicDomainStatus;
  public_domain_reason: string;
  ai_training_value: AiTrainingValue;
  ai_value_factors: string[];
  pre_llm_era: boolean | null;
  triage_action: TriageAction;
  triage_score: number;
  triage_notes: string | null;

  // Cross-references
  already_digitised: boolean;
  gutenberg_id: number | null;
  gutenberg_url: string | null;
  openlibrary_id: string | null;
  openlibrary_url: string | null;

  // Resale
  resale_recommendation: ResaleRecommendation;

  // Meta
  cached: boolean;
  triage_run_at: string;
  /** Set when a lookup partially failed — surfaced to the user as a warning. */
  warnings: string[];
}

export interface BulkTriageResultRow {
  isbn: string;
  ok: boolean;
  error: string | null;
  result: TriageResult | null;
}

export interface TriageHistoryEntry {
  id: string;
  isbn: string | null;
  title: string | null;
  author: string | null;
  triage_score: number;
  triage_action: TriageAction;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Dashboard & analytics                                               */
/* ------------------------------------------------------------------ */

export interface StatsSummary {
  total_books: number;
  public_domain_books: number;
  public_domain_pct: number;
  ready_to_scan: number;
  total_revenue: number;
  data_revenue: number;
  physical_revenue: number;
  total_acquisition_cost: number;
  net_profit: number;
  datasets_count: number;
  datasets_sold: number;
}

export interface MonthlyRevenuePoint {
  month: string; // "2026-03"
  label: string; // "Mar 26"
  data_revenue: number;
  physical_revenue: number;
  total: number;
}

export interface TriageDistributionSlice {
  action: TriageAction;
  label: string;
  count: number;
}

export interface PlatformRevenueSlice {
  platform: string;
  label: string;
  revenue: number;
  count: number;
}

export interface ActivityEntry {
  id: string;
  kind: 'book_added' | 'book_sold' | 'dataset_created' | 'dataset_sold' | 'scan_complete';
  title: string;
  detail: string | null;
  amount: number | null;
  timestamp: string;
}

export interface RevenueSummary {
  total_revenue: number;
  data_revenue: number;
  physical_revenue: number;
  by_month: MonthlyRevenuePoint[];
  by_platform: PlatformRevenueSlice[];
}

/* ------------------------------------------------------------------ */
/* Scan workflow                                                       */
/* ------------------------------------------------------------------ */

export interface ScanStatusResponse {
  book_id: string;
  scan_status: ScanStatus;
  scan_method: string | null;
  pages_uploaded: number;
  pages_ocr_complete: number;
  pages_reviewed: number;
  ocr_quality_score: number | null;
  ocr_word_count: number | null;
  ocr_page_count: number | null;
  progress_pct: number;
  text_preview: string | null;
}

/* ------------------------------------------------------------------ */
/* API request payloads                                                */
/* ------------------------------------------------------------------ */

export interface BookCreatePayload {
  isbn?: string | null;
  title: string;
  subtitle?: string | null;
  author_name: string;
  author_birth_year?: number | null;
  author_death_year?: number | null;
  publisher?: string | null;
  publish_year?: number | null;
  language?: string;
  page_count?: number | null;
  genre?: string | null;
  subject_keywords?: string[];
  description?: string | null;
  public_domain_status?: PublicDomainStatus;
  public_domain_reason?: string | null;
  gutenberg_id?: number | null;
  gutenberg_url?: string | null;
  openlibrary_id?: string | null;
  openlibrary_url?: string | null;
  already_digitised?: boolean;
  ai_training_value?: AiTrainingValue;
  ai_value_factors?: string[];
  pre_llm_era?: boolean | null;
  triage_action?: TriageAction;
  triage_score?: number;
  triage_notes?: string | null;
  physical_location?: string | null;
  acquisition_cost?: number | null;
  acquisition_date?: string | null;
  acquisition_source?: string | null;
  condition?: BookCondition;
}

export type BookUpdatePayload = Partial<BookCreatePayload> & {
  scan_status?: ScanStatus;
  scan_method?: string | null;
  resale_status?: ResaleStatus;
  resale_platform?: string | null;
  resale_price?: number | null;
  estimated_copies_surviving?: CopiesSurviving;
};

export interface DatasetCreatePayload {
  book_id: string;
  title: string;
  description?: string | null;
  domain_tags?: string[];
  language?: string;
  asking_price?: number | null;
}

export type DatasetUpdatePayload = Partial<{
  title: string;
  description: string | null;
  domain_tags: string[];
  asking_price: number | null;
  final_price: number | null;
  sale_status: DatasetSaleStatus;
  listed_platform: string | null;
  listed_url: string | null;
  buyer_name: string | null;
  buyer_type: string | null;
  nda_signed: boolean;
}>;

export interface SaleCreatePayload {
  book_id?: string | null;
  dataset_id?: string | null;
  sale_type: SaleType;
  platform: string;
  listing_url?: string | null;
  asking_price?: number | null;
  final_price?: number | null;
  buyer_name?: string | null;
  buyer_type?: string | null;
  nda_signed?: boolean;
  status?: SaleStatus;
  notes?: string | null;
}

export type SaleUpdatePayload = Partial<SaleCreatePayload>;

/* ------------------------------------------------------------------ */
/* Query / listing contracts                                           */
/* ------------------------------------------------------------------ */

export const BOOK_SORT_OPTIONS = [
  'newest',
  'score_desc',
  'title_asc',
  'author_asc',
  'year_asc',
  'year_desc',
] as const;
export type BookSort = (typeof BOOK_SORT_OPTIONS)[number];

export interface BookQuery {
  page?: number;
  limit?: number;
  search?: string;
  public_domain_status?: PublicDomainStatus[];
  ai_training_value?: AiTrainingValue[];
  triage_action?: TriageAction[];
  scan_status?: ScanStatus[];
  sale_status?: ResaleStatus[];
  sort?: BookSort;
}

export interface DatasetQuery {
  domain?: string;
  language?: string;
  sale_status?: DatasetSaleStatus[];
}

export interface SaleQuery {
  sale_type?: SaleType;
  platform?: string;
  date_from?: string;
  date_to?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/* ------------------------------------------------------------------ */
/* UI-only helper types                                                */
/* ------------------------------------------------------------------ */

export type BadgeTone =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'primary'
  | 'accent';

export interface BadgeStyle {
  bg: string;
  text: string;
  label: string;
}

export type ViewMode = 'table' | 'grid';
export type ThemeMode = 'light' | 'dark';

export interface ApiError {
  detail: string;
  status: number;
}

export interface UserSettings {
  name: string;
  email: string;
  default_location: string;
  default_resale_platform: ResalePlatform;
  auto_save_triage: boolean;
  currency: 'GBP' | 'USD';
  theme: ThemeMode;
}
