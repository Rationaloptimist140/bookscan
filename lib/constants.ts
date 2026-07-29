/**
 * BookScan — Shared Constants
 * ===========================
 * Status colour mappings, labels and platform metadata. The badge styles here
 * are the EXACT mappings from the BookScan specification. Do not alter the hex
 * values — they are referenced by the design system contract.
 */

import type {
  AiTrainingValue,
  BadgeStyle,
  BookSort,
  DatasetSaleStatus,
  PublicDomainStatus,
  ResaleStatus,
  SaleStatus,
  ScanStatus,
  TriageAction,
} from './types';

/* ------------------------------------------------------------------ */
/* Badge colour mappings — exact per specification                     */
/* ------------------------------------------------------------------ */

export const PD_STATUS_STYLES: Record<PublicDomainStatus, BadgeStyle> = {
  confirmed_pd: { bg: '#E8F3E8', text: '#166534', label: 'CONFIRMED PD' },
  likely_pd: { bg: '#F7F0E0', text: '#92400E', label: 'LIKELY PD' },
  not_pd: { bg: '#F5E8E4', text: '#991B1B', label: 'NOT PD' },
  unknown: { bg: '#F1F5F9', text: '#475569', label: 'UNKNOWN' },
};

export const AI_VALUE_STYLES: Record<AiTrainingValue, BadgeStyle> = {
  premium: { bg: '#E8F3E8', text: '#166534', label: 'PREMIUM' },
  high: { bg: '#E8F0EF', text: '#1E40AF', label: 'HIGH VALUE' },
  medium: { bg: '#F7F0E0', text: '#92400E', label: 'MEDIUM' },
  low: { bg: '#F5E8E4', text: '#B5523E', label: 'LOW' },
  none: { bg: '#F1F5F9', text: '#6B7280', label: 'NONE' },
  unassessed: { bg: '#F1F5F9', text: '#6B7280', label: 'UNASSESSED' },
};

export const TRIAGE_ACTION_STYLES: Record<TriageAction, BadgeStyle> = {
  scan_and_sell_data: { bg: '#E8F3E8', text: '#166534', label: 'SCAN & SELL DATA' },
  preserve_only: { bg: '#E8F0EF', text: '#1E40AF', label: 'PRESERVE ONLY' },
  sell_physical: { bg: '#F7F0E0', text: '#92400E', label: 'SELL PHYSICAL' },
  already_available: { bg: '#F1F5F9', text: '#6B7280', label: 'ALREADY AVAILABLE' },
  pending: { bg: '#F1F5F9', text: '#6B7280', label: 'PENDING' },
};

export const SCAN_STATUS_STYLES: Record<ScanStatus, BadgeStyle> = {
  not_scanned: { bg: '#F1F5F9', text: '#6B7280', label: 'NOT SCANNED' },
  queued: { bg: '#F7F0E0', text: '#92400E', label: 'QUEUED' },
  scanning: { bg: '#E8F0EF', text: '#1E40AF', label: 'SCANNING' },
  scanned: { bg: '#E8F0EF', text: '#1E40AF', label: 'SCANNED' },
  ocr_complete: { bg: '#F7F0E0', text: '#92400E', label: 'OCR COMPLETE' },
  reviewed: { bg: '#E8F3E8', text: '#166534', label: 'REVIEWED' },
  ready_for_sale: { bg: '#E8F3E8', text: '#166534', label: 'READY FOR SALE' },
};

export const RESALE_STATUS_STYLES: Record<ResaleStatus, BadgeStyle> = {
  not_listed: { bg: '#F1F5F9', text: '#6B7280', label: 'NOT LISTED' },
  listed: { bg: '#E8F0EF', text: '#1E40AF', label: 'LISTED' },
  sold: { bg: '#E8F3E8', text: '#166534', label: 'SOLD' },
  delisted: { bg: '#F5E8E4', text: '#B5523E', label: 'DELISTED' },
};

export const DATASET_SALE_STATUS_STYLES: Record<DatasetSaleStatus, BadgeStyle> = {
  not_listed: { bg: '#F1F5F9', text: '#6B7280', label: 'NOT LISTED' },
  listed: { bg: '#E8F0EF', text: '#1E40AF', label: 'LISTED' },
  negotiating: { bg: '#F7F0E0', text: '#92400E', label: 'NEGOTIATING' },
  sold: { bg: '#E8F3E8', text: '#166534', label: 'SOLD' },
  rejected: { bg: '#F5E8E4', text: '#B5523E', label: 'REJECTED' },
  expired: { bg: '#F1F5F9', text: '#6B7280', label: 'EXPIRED' },
};

export const SALE_STATUS_STYLES: Record<SaleStatus, BadgeStyle> = {
  draft: { bg: '#F1F5F9', text: '#6B7280', label: 'DRAFT' },
  listed: { bg: '#E8F0EF', text: '#1E40AF', label: 'LISTED' },
  negotiating: { bg: '#F7F0E0', text: '#92400E', label: 'NEGOTIATING' },
  sold: { bg: '#E8F3E8', text: '#166534', label: 'SOLD' },
  rejected: { bg: '#F5E8E4', text: '#B5523E', label: 'REJECTED' },
  expired: { bg: '#F1F5F9', text: '#6B7280', label: 'EXPIRED' },
};

/* ------------------------------------------------------------------ */
/* Triage score gauge colour bands                                     */
/* ------------------------------------------------------------------ */

export const SCORE_BANDS = [
  { min: 80, max: 100, colour: '#5C8D5C', label: 'Excellent' },
  { min: 60, max: 79, colour: '#C49A4D', label: 'Good' },
  { min: 40, max: 59, colour: '#B5523E', label: 'Marginal' },
  { min: 0, max: 39, colour: '#9CA3AF', label: 'Low' },
] as const;

export function scoreColour(score: number): string {
  if (score >= 80) return '#5C8D5C';
  if (score >= 60) return '#C49A4D';
  if (score >= 40) return '#B5523E';
  return '#9CA3AF';
}

export function scoreBandLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Marginal';
  return 'Low';
}

/* ------------------------------------------------------------------ */
/* Chart palette                                                       */
/* ------------------------------------------------------------------ */

export const CHART_COLOURS = {
  data: '#C49A4D', // warm gold — data sales
  physical: '#5B8C8A', // muted teal — physical sales
  primary: '#2D5F4F',
  primaryLight: '#3A7A66',
  accent: '#C49A4D',
  accentLight: '#D4AF6A',
  secondary: '#5B8C8A',
  secondaryLight: '#7BA8A6',
  success: '#5C8D5C',
  danger: '#B5523E',
  muted: '#9CA3AF',
  grid: '#EFEBE4',
} as const;

export const TRIAGE_DISTRIBUTION_COLOURS: Record<TriageAction, string> = {
  scan_and_sell_data: '#2D5F4F',
  preserve_only: '#5B8C8A',
  sell_physical: '#C49A4D',
  already_available: '#9CA3AF',
  pending: '#D8D3CA',
};

export const PLATFORM_COLOURS: Record<string, string> = {
  abebooks: '#2D5F4F',
  ebay: '#5B8C8A',
  amazon: '#C49A4D',
  ziffit: '#7BA8A6',
  amazon_or_ziffit: '#D4AF6A',
  world_of_books: '#3A7A66',
  defined_ai: '#1F4537',
  aws_data_exchange: '#B5523E',
  hugging_face: '#C49A4D',
  direct: '#9CA3AF',
};

/* ------------------------------------------------------------------ */
/* Human-readable labels                                               */
/* ------------------------------------------------------------------ */

export const PLATFORM_LABELS: Record<string, string> = {
  abebooks: 'AbeBooks',
  ebay: 'eBay',
  amazon: 'Amazon',
  ziffit: 'Ziffit',
  amazon_or_ziffit: 'Amazon / Ziffit',
  world_of_books: 'World of Books',
  defined_ai: 'Defined.ai',
  aws_data_exchange: 'AWS Data Exchange',
  hugging_face: 'Hugging Face',
  direct: 'Direct Sale',
};

export const RESALE_PLATFORM_OPTIONS = [
  { value: 'abebooks', label: 'AbeBooks' },
  { value: 'ebay', label: 'eBay' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'ziffit', label: 'Ziffit' },
  { value: 'world_of_books', label: 'World of Books' },
  { value: 'direct', label: 'Direct Sale' },
] as const;

export const DATA_PLATFORM_OPTIONS = [
  { value: 'defined_ai', label: 'Defined.ai' },
  { value: 'aws_data_exchange', label: 'AWS Data Exchange' },
  { value: 'hugging_face', label: 'Hugging Face' },
  { value: 'direct', label: 'Direct Sale' },
] as const;

export const SCAN_METHOD_OPTIONS = [
  { value: 'phone_camera', label: 'Phone Camera' },
  { value: 'document_scanner', label: 'Document Scanner' },
  { value: 'dslr', label: 'DSLR / Copy Stand' },
  { value: 'flatbed', label: 'Flatbed Scanner' },
] as const;

export const CONDITION_OPTIONS = [
  { value: 'mint', label: 'Mint' },
  { value: 'very_good', label: 'Very Good' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'unknown', label: 'Unknown' },
] as const;

export const SORT_OPTIONS: { value: BookSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'score_desc', label: 'Highest score' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'author_asc', label: 'Author A–Z' },
  { value: 'year_asc', label: 'Publish year (oldest)' },
  { value: 'year_desc', label: 'Publish year (newest)' },
];

/* ------------------------------------------------------------------ */
/* Scan workflow stepper                                               */
/* ------------------------------------------------------------------ */

export const SCAN_STEPS: { status: ScanStatus; label: string; description: string }[] = [
  { status: 'not_scanned', label: 'Not Scanned', description: 'Awaiting scan queue' },
  { status: 'queued', label: 'Queued', description: 'Scheduled for scanning' },
  { status: 'scanning', label: 'Scanning', description: 'Pages being captured' },
  { status: 'scanned', label: 'Scanned', description: 'All pages captured' },
  { status: 'ocr_complete', label: 'OCR Complete', description: 'Text extracted' },
  { status: 'reviewed', label: 'Reviewed', description: 'Text quality verified' },
  { status: 'ready_for_sale', label: 'Ready for Sale', description: 'Dataset can be listed' },
];

/* ------------------------------------------------------------------ */
/* Niche domains used by the AI-value assessor                          */
/* ------------------------------------------------------------------ */

export const NICHE_DOMAINS = [
  'botany',
  'medicine',
  'philosophy',
  'law',
  'navigation',
  'engineering',
  'chemistry',
  'astronomy',
  'agriculture',
  'history',
  'mathematics',
  'physics',
  'biology',
  'theology',
] as const;

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/triage', label: 'Triage Tool', icon: 'ScanLine' },
  { href: '/inventory', label: 'Inventory', icon: 'BookOpen' },
  { href: '/scan', label: 'Scan Workflow', icon: 'Camera' },
  { href: '/datasets', label: 'Datasets', icon: 'Database' },
  { href: '/sales', label: 'Sales', icon: 'TrendingUp' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
] as const;

/* ------------------------------------------------------------------ */
/* App metadata                                                        */
/* ------------------------------------------------------------------ */

export const APP_NAME = 'BookScan';
export const APP_VERSION = '1.0.0';
export const APP_TAGLINE = 'Triage, scan and sell pre-2022 books as clean AI training data';
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Current year used by public-domain calculations. */
export const CURRENT_YEAR = new Date().getFullYear();

/** UK copyright term: life of author + 70 years. */
export const UK_COPYRIGHT_TERM_YEARS = 70;

/** Cutoff year for "pre-LLM era" clean training data. */
export const PRE_LLM_CUTOFF_YEAR = 2022;
