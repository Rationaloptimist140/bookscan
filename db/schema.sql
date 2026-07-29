-- =====================================================================
-- BookScan — Complete PostgreSQL / Supabase Schema
-- =====================================================================
-- Run this in the Supabase SQL Editor (or via psql) before first launch.
-- Idempotent where practical: safe to re-run on a fresh project.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================================
-- TABLE: books
-- =====================================================================
CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    isbn VARCHAR(20) UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    author_name TEXT NOT NULL,
    author_birth_year INTEGER,
    author_death_year INTEGER,
    publisher TEXT,
    publish_year INTEGER,
    publish_date_exact DATE,
    language VARCHAR(10) DEFAULT 'en',
    page_count INTEGER,
    genre TEXT,
    subject_keywords TEXT[] DEFAULT '{}',
    description TEXT,

    -- Public domain status
    public_domain_status VARCHAR(20) DEFAULT 'unknown'
        CHECK (public_domain_status IN ('confirmed_pd', 'likely_pd', 'not_pd', 'unknown')),
    public_domain_reason TEXT,
    public_domain_checked_at TIMESTAMPTZ,

    -- External cross-references
    gutenberg_id INTEGER,
    gutenberg_url TEXT,
    openlibrary_id TEXT,
    openlibrary_url TEXT,
    already_digitised BOOLEAN DEFAULT FALSE,
    digitised_source TEXT,

    -- Rarity estimation
    estimated_copies_surviving VARCHAR(20) DEFAULT 'unknown'
        CHECK (estimated_copies_surviving IN ('unique', 'very_rare', 'rare', 'uncommon', 'common', 'unknown')),
    worldcat_holding_count INTEGER,

    -- AI training value
    ai_training_value VARCHAR(20) DEFAULT 'unassessed'
        CHECK (ai_training_value IN ('premium', 'high', 'medium', 'low', 'none', 'unassessed')),
    ai_value_factors TEXT[] DEFAULT '{}',
    pre_llm_era BOOLEAN,

    -- Triage
    triage_action VARCHAR(30) DEFAULT 'pending'
        CHECK (triage_action IN ('scan_and_sell_data', 'preserve_only', 'sell_physical', 'already_available', 'pending')),
    triage_notes TEXT,
    triage_score INTEGER DEFAULT 0 CHECK (triage_score BETWEEN 0 AND 100),
    triage_run_at TIMESTAMPTZ,

    -- Physical tracking
    physical_location VARCHAR(200),
    acquisition_cost DECIMAL(10,2),
    acquisition_date DATE,
    acquisition_source VARCHAR(200),
    condition VARCHAR(20) DEFAULT 'good'
        CHECK (condition IN ('mint', 'very_good', 'good', 'fair', 'poor', 'unknown')),

    -- Scanning
    scan_status VARCHAR(20) DEFAULT 'not_scanned'
        CHECK (scan_status IN ('not_scanned', 'queued', 'scanning', 'scanned', 'ocr_complete', 'reviewed', 'ready_for_sale')),
    scan_method VARCHAR(50),
    scan_started_at TIMESTAMPTZ,
    scan_completed_at TIMESTAMPTZ,
    ocr_text_path TEXT,
    ocr_quality_score DECIMAL(3,2),
    ocr_word_count INTEGER,
    ocr_page_count INTEGER,

    -- Sale tracking (physical)
    resale_status VARCHAR(20) DEFAULT 'not_listed'
        CHECK (resale_status IN ('not_listed', 'listed', 'sold', 'delisted')),
    resale_platform VARCHAR(50),
    resale_price DECIMAL(10,2),
    resale_listed_at TIMESTAMPTZ,
    resale_sold_at TIMESTAMPTZ,

    -- Provenance
    provenance_chain JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_title ON books USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_books_author ON books USING gin(to_tsvector('english', author_name));
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON books USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_books_author_trgm ON books USING gin(author_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_books_public_domain ON books(public_domain_status);
CREATE INDEX IF NOT EXISTS idx_books_ai_value ON books(ai_training_value);
CREATE INDEX IF NOT EXISTS idx_books_triage_action ON books(triage_action);
CREATE INDEX IF NOT EXISTS idx_books_scan_status ON books(scan_status);
CREATE INDEX IF NOT EXISTS idx_books_resale_status ON books(resale_status);
CREATE INDEX IF NOT EXISTS idx_books_triage_score ON books(triage_score DESC);
CREATE INDEX IF NOT EXISTS idx_books_publish_year ON books(publish_year);
CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_subject_keywords ON books USING gin(subject_keywords);

-- =====================================================================
-- TABLE: scan_pages
-- =====================================================================
CREATE TABLE IF NOT EXISTS scan_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    image_url TEXT,
    ocr_text TEXT,
    ocr_confidence DECIMAL(5,2),
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_scan_pages_book ON scan_pages(book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_scan_pages_reviewed ON scan_pages(book_id, reviewed);

-- =====================================================================
-- TABLE: datasets
-- =====================================================================
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    domain_tags TEXT[] DEFAULT '{}',
    language VARCHAR(10) DEFAULT 'en',
    word_count INTEGER,
    page_count INTEGER,
    text_file_path TEXT NOT NULL,
    text_preview TEXT,
    ocr_quality_score DECIMAL(3,2),
    provenance_document JSONB DEFAULT '{}'::jsonb,

    sale_status VARCHAR(20) DEFAULT 'not_listed'
        CHECK (sale_status IN ('not_listed', 'listed', 'negotiating', 'sold', 'rejected', 'expired')),
    asking_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    listed_platform VARCHAR(50),
    listed_url TEXT,
    buyer_name TEXT,
    buyer_type VARCHAR(50),
    nda_signed BOOLEAN DEFAULT FALSE,
    listed_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datasets_book ON datasets(book_id);
CREATE INDEX IF NOT EXISTS idx_datasets_sale_status ON datasets(sale_status);
CREATE INDEX IF NOT EXISTS idx_datasets_domain ON datasets USING gin(domain_tags);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at DESC);

-- =====================================================================
-- TABLE: sales
-- =====================================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE SET NULL,
    dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
    sale_type VARCHAR(20) NOT NULL
        CHECK (sale_type IN ('data', 'physical')),
    platform VARCHAR(50) NOT NULL,
    listing_url TEXT,
    asking_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    buyer_name TEXT,
    buyer_type VARCHAR(50),
    nda_signed BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft', 'listed', 'negotiating', 'sold', 'rejected', 'expired')),
    listed_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_book ON sales(book_id);
CREATE INDEX IF NOT EXISTS idx_sales_dataset ON sales(dataset_id);
CREATE INDEX IF NOT EXISTS idx_sales_type ON sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_sales_platform ON sales(platform);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);

-- =====================================================================
-- TABLE: triage_cache
-- =====================================================================
CREATE TABLE IF NOT EXISTS triage_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    isbn VARCHAR(20),
    title TEXT,
    author TEXT,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_triage_cache_isbn ON triage_cache(isbn);
CREATE INDEX IF NOT EXISTS idx_triage_cache_expires ON triage_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_triage_cache_title_author ON triage_cache(title, author);
CREATE INDEX IF NOT EXISTS idx_triage_cache_created ON triage_cache(created_at DESC);

-- =====================================================================
-- TABLE: api_logs
-- =====================================================================
CREATE TABLE IF NOT EXISTS api_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_name VARCHAR(50) NOT NULL,
    endpoint TEXT,
    request_params JSONB,
    response_status INTEGER,
    response_cached BOOLEAN DEFAULT FALSE,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_name ON api_logs(api_name);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);

-- =====================================================================
-- TRIGGERS — auto-maintain updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS books_updated_at ON books;
CREATE TRIGGER books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS datasets_updated_at ON datasets;
CREATE TRIGGER datasets_updated_at BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
-- Single-user application for now: RLS is enabled so that Supabase does not
-- expose tables by default, with permissive policies. Tighten these to
-- `auth.uid() = owner_id` when multi-tenancy is introduced.

ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON books;
CREATE POLICY "Allow all for authenticated" ON books
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON scan_pages;
CREATE POLICY "Allow all for authenticated" ON scan_pages
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON datasets;
CREATE POLICY "Allow all for authenticated" ON datasets
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON sales;
CREATE POLICY "Allow all for authenticated" ON sales
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON triage_cache;
CREATE POLICY "Allow all for authenticated" ON triage_cache
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON api_logs;
CREATE POLICY "Allow all for authenticated" ON api_logs
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================================
-- STORAGE BUCKETS
-- =====================================================================
-- Create these in the Supabase dashboard (Storage → New bucket), or run:
INSERT INTO storage.buckets (id, name, public)
VALUES ('scan-pages', 'scan-pages', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ocr-text', 'ocr-text', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- HELPER VIEW: revenue by month (used by /api/sales/revenue/summary)
-- =====================================================================
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT
    to_char(date_trunc('month', COALESCE(sold_at, created_at)), 'YYYY-MM') AS month,
    sale_type,
    SUM(COALESCE(final_price, asking_price, 0)) AS revenue,
    COUNT(*) AS sale_count
FROM sales
WHERE status = 'sold'
GROUP BY 1, 2
ORDER BY 1;

-- =====================================================================
-- MAINTENANCE: purge expired triage cache
-- =====================================================================
CREATE OR REPLACE FUNCTION purge_expired_triage_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted INTEGER;
BEGIN
    DELETE FROM triage_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$ LANGUAGE 'plpgsql';

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
