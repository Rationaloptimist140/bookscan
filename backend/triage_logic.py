"""
BookScan — Pure business logic functions.
No I/O, no external calls, fully unit-testable.
"""

from __future__ import annotations

import datetime
import re
import unicodedata

# datetime.UTC is Python 3.11+; provide a fallback for older runtimes.
try:
    from datetime import UTC as _UTC  # Python 3.11+
except ImportError:
    import datetime as _dt_module
    _UTC = _dt_module.timezone.utc  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

NICHE_DOMAINS: tuple[str, ...] = (
    "botany",
    "medicine",
    "philosophy",
    "law",
    "navigation",
    "engineering",
    "chemistry",
    "astronomy",
    "agriculture",
    "history",
    "mathematics",
    "physics",
    "biology",
    "theology",
)

# ---------------------------------------------------------------------------
# ISBN utilities
# ---------------------------------------------------------------------------


def normalise_isbn(raw: str) -> str:
    """Strip hyphens and spaces, uppercase X."""
    return re.sub(r"[\s\-]", "", raw).upper()


def validate_isbn(isbn: str) -> bool:
    """Validate ISBN-10 or ISBN-13 via checksum."""
    s = normalise_isbn(isbn)
    if len(s) == 10:
        return _check_isbn10(s)
    if len(s) == 13:
        return _check_isbn13(s)
    return False


def _check_isbn10(s: str) -> bool:
    """ISBN-10 checksum: sum(digit * (10-i)) mod 11 == 0, X == 10."""
    if not re.match(r"^\d{9}[\dX]$", s):
        return False
    total = sum(
        (10 if c == "X" else int(c)) * (10 - i) for i, c in enumerate(s)
    )
    return total % 11 == 0


def _check_isbn13(s: str) -> bool:
    """ISBN-13 checksum: alternating 1/3 weights, mod 10 == 0."""
    if not re.match(r"^\d{13}$", s):
        return False
    total = sum(
        int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(s)
    )
    return total % 10 == 0


# ---------------------------------------------------------------------------
# Public-domain determination
# ---------------------------------------------------------------------------


def determine_public_domain(
    publish_year: int | None,
    author_death_year: int | None,
) -> tuple[str, str]:
    """
    UK life+70 rule.
    Returns (status, reason) where status is one of:
      confirmed_pd, likely_pd, not_pd, unknown.
    """
    current_year = datetime.datetime.now(_UTC).year

    if author_death_year is not None:
        pd_year = author_death_year + 70
        if current_year > pd_year:
            return (
                "confirmed_pd",
                f"Author died {author_death_year}, entered public domain in {pd_year} (UK life+70 rule).",
            )
        return (
            "not_pd",
            f"Author died {author_death_year}, copyright expires {pd_year} (UK life+70 rule).",
        )

    if publish_year is not None:
        if publish_year < 1900:
            return (
                "confirmed_pd",
                f"Published {publish_year}, well before 1900 — almost certainly public domain.",
            )
        if publish_year < 1929:
            return (
                "likely_pd",
                f"Published {publish_year} (pre-1929) — likely public domain, but verify author death year.",
            )
        return (
            "unknown",
            f"Published {publish_year} (post-1929) — need author death year to confirm.",
        )

    return ("unknown", "Insufficient data — provide publish year or author death year.")


# ---------------------------------------------------------------------------
# AI value assessment
# ---------------------------------------------------------------------------


def assess_ai_value(
    publish_year: int | None,
    already_digitised: bool,
    pd_status: str,
    subject_keywords: list[str],
) -> tuple[str, list[str], bool | None]:
    """
    Returns (ai_training_value, factors, pre_llm).
    ai_training_value: premium | high | medium | low | unassessed
    """
    factors: list[str] = []

    pre_llm: bool | None = None
    if publish_year is not None:
        pre_llm = publish_year < 2022
        if pre_llm:
            factors.append("pre-LLM era (pre-2022)")
        else:
            factors.append("post-2022 (potential AI contamination risk)")

    if pd_status in ("confirmed_pd", "likely_pd"):
        factors.append("public domain — no licensing needed")
    else:
        factors.append("copyrighted — requires licensing for commercial use")

    if not already_digitised:
        factors.append("not on Project Gutenberg — potentially unique training data")
    else:
        factors.append("already on Project Gutenberg — lower uniqueness value")

    # Niche domain detection
    keywords_lower = {kw.lower() for kw in subject_keywords}
    matched_domains = [
        d for d in NICHE_DOMAINS if d in keywords_lower
        or any(d in kw for kw in keywords_lower)
    ]
    if matched_domains:
        factors.append(f"niche domain(s): {', '.join(matched_domains)}")

    # Scoring logic
    is_pd = pd_status in ("confirmed_pd", "likely_pd")

    if pre_llm is True and not already_digitised and is_pd:
        value = "premium"
    elif pre_llm is True and not already_digitised:
        value = "high"
    elif pre_llm is True and already_digitised:
        value = "medium"
    elif pre_llm is False:
        value = "low"
    elif already_digitised and is_pd:
        value = "low"
    else:
        value = "unassessed"

    return value, factors, pre_llm


# ---------------------------------------------------------------------------
# Triage score
# ---------------------------------------------------------------------------


def calculate_triage_score(
    ai_value: str,
    pd_status: str,
    already_digitised: bool,
    pre_llm: bool | None,
) -> int:
    """Return a 0–100 triage score."""
    score = 0
    score += {"premium": 40, "high": 30, "medium": 20, "low": 5}.get(ai_value, 0)
    score += {"confirmed_pd": 25, "likely_pd": 20, "not_pd": 0, "unknown": 0}.get(pd_status, 0)
    if not already_digitised:
        score += 20
    if pre_llm is True:
        score += 15
    return min(score, 100)


# ---------------------------------------------------------------------------
# Triage action
# ---------------------------------------------------------------------------


def determine_triage_action(
    ai_value: str,
    pd_status: str,
    already_digitised: bool,
) -> str:
    """
    Returns one of: scan_and_sell_data, preserve_only, sell_physical,
    already_available, pending.
    """
    is_pd = pd_status in ("confirmed_pd", "likely_pd")

    if already_digitised and is_pd:
        return "already_available"
    if ai_value in ("premium", "high") and is_pd:
        return "scan_and_sell_data"
    if ai_value in ("premium", "high") and pd_status == "not_pd":
        return "preserve_only"
    if ai_value in ("medium", "low"):
        return "sell_physical"
    return "pending"


# ---------------------------------------------------------------------------
# Resale recommendation
# ---------------------------------------------------------------------------


_PLATFORM_LABELS: dict[str, str] = {
    "abebooks": "AbeBooks",
    "ebay": "eBay",
    "amazon": "Amazon",
    "ziffit": "Ziffit",
    "amazon_or_ziffit": "Amazon or Ziffit",
    "world_of_books": "World of Books",
    "direct": "Direct Sale",
}


def recommend_resale_platform(
    pd_status: str,
    ai_value: str,
    already_digitised: bool,
) -> dict[str, object]:
    """
    Returns a ResaleRecommendation dict with keys:
      platform, platform_label, reason, estimated_price_range, listing_tips.
    """
    is_pd = pd_status in ("confirmed_pd", "likely_pd")

    if ai_value == "premium" and is_pd:
        platform = "abebooks"
        reason = (
            "Rare public-domain book — scan for data revenue, then list on AbeBooks "
            "to maximise collector margin."
        )
        price_range = "£15–£50"
        tips = [
            "Photograph the cover, spine, and title page at high resolution.",
            "Describe condition thoroughly — note foxing, inscriptions, or binding quality.",
            "Set price 15–20 % above similar AbeBooks listings and accept best offers.",
            "Mention subject domain and rarity in the description to attract specialist buyers.",
        ]

    elif ai_value in ("high", "premium") and not already_digitised:
        platform = "abebooks"
        reason = (
            "Valuable or rare book not yet digitised — AbeBooks reaches the collector "
            "and library acquisition market."
        )
        price_range = "£10–£40"
        tips = [
            "Include full bibliographic details: edition, print run, place of publication.",
            "Cross-list on eBay if no sale within 60 days.",
            "Check WorldCat holding count — lower count justifies higher asking price.",
            "Consider contacting university libraries directly for institutional sales.",
        ]

    elif ai_value == "medium":
        platform = "ebay"
        reason = (
            "Moderate-value book — eBay's broad audience and auction format can surface "
            "competitive bids from general collectors."
        )
        price_range = "£5–£20"
        tips = [
            "Use a 7-day auction with a £3.99 starting price to generate bid competition.",
            "Free postage listings rank higher in eBay search results.",
            "Bundle multiple books from the same author or era for higher combined value.",
            "Schedule listing to end on a Sunday evening for maximum bidder activity.",
        ]

    else:
        platform = "amazon_or_ziffit"
        reason = (
            "Common or low-value title — Amazon FBA for volume sales, "
            "or Ziffit for instant cash-offer convenience."
        )
        price_range = "£1–£8"
        tips = [
            "Scan ISBN on the Ziffit app first for an instant offer before listing elsewhere.",
            "For Amazon, match the lowest used price and ship promptly to maintain seller rating.",
            "Batch-ship to Amazon FBA when you accumulate 10+ common titles.",
            "World of Books accepts bulk donations with a small cash payment per kilogram.",
        ]

    return {
        "platform": platform,
        "platform_label": _PLATFORM_LABELS.get(platform, platform),
        "reason": reason,
        "estimated_price_range": price_range,
        "listing_tips": tips,
    }


# ---------------------------------------------------------------------------
# Provenance helper
# ---------------------------------------------------------------------------


def build_provenance_entry(
    event: str,
    date: str | None = None,
    detail: str | None = None,
    cost: float | None = None,
    platform: str | None = None,
    price: float | None = None,
    quality: float | None = None,
    method: str | None = None,
) -> dict[str, object]:
    """Return a provenance chain entry dict (matches ProvenanceEntry TS interface)."""
    entry: dict[str, object] = {"event": event, "date": date}
    if detail is not None:
        entry["detail"] = detail
    if cost is not None:
        entry["cost"] = cost
    if platform is not None:
        entry["platform"] = platform
    if price is not None:
        entry["price"] = price
    if quality is not None:
        entry["quality"] = quality
    if method is not None:
        entry["method"] = method
    return entry


# ---------------------------------------------------------------------------
# OCR text cleaning
# ---------------------------------------------------------------------------


def clean_ocr_text(raw: str) -> str:
    """
    Clean raw OCR output:
    - Fix ligatures (fi, fl, ff, ffi, ffl)
    - Normalise smart quotes and typographic apostrophes
    - Normalise em-dashes and en-dashes
    - Repair soft-hyphen line-breaks (e.g. "hyphen-\\nated" → "hyphenated")
    - Collapse excessive whitespace within paragraphs
    - Preserve paragraph breaks (double newline)
    """
    text = raw

    # Fix common ligatures
    ligature_map = {
        "ﬁ": "fi",   # ﬁ
        "ﬂ": "fl",   # ﬂ
        "ﬀ": "ff",   # ﬀ
        "ﬃ": "ffi",  # ﬃ
        "ﬄ": "ffl",  # ﬄ
        "ﬅ": "st",   # ﬅ
        "ﬆ": "st",   # ﬆ
    }
    for ligature, replacement in ligature_map.items():
        text = text.replace(ligature, replacement)

    # Normalise smart / curly quotes to straight quotes
    text = text.replace("‘", "'").replace("’", "'")   # ' '
    text = text.replace("“", '"').replace("”", '"')   # " "
    text = text.replace("′", "'").replace("″", '"')   # ′ ″

    # Normalise dashes
    text = text.replace("—", " — ").replace("–", " – ")

    # Repair hyphenated line-breaks: "hyphen-\nated" → "hyphenated"
    text = re.sub(r"-\s*\n\s*", "", text)

    # Normalise Unicode to NFC (composed form)
    text = unicodedata.normalize("NFC", text)

    # Preserve paragraph breaks (two or more newlines → sentinel)
    text = re.sub(r"\n{2,}", "\x00PARA\x00", text)

    # Within paragraphs: collapse runs of whitespace (including single newlines)
    text = re.sub(r"[ \t\r\n]+", " ", text)

    # Restore paragraph breaks as double newline
    text = text.replace("\x00PARA\x00", "\n\n")

    # Strip leading/trailing whitespace per paragraph
    paragraphs = [p.strip() for p in text.split("\n\n")]
    paragraphs = [p for p in paragraphs if p]  # drop empty paragraphs

    return "\n\n".join(paragraphs)
