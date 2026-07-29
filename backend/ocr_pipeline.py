"""
BookScan — OCR pipeline.
Pillow preprocessing → pytesseract → clean_ocr_text → Supabase Storage upload.
Runs as a FastAPI BackgroundTask.
pytesseract and PIL are imported lazily so the app boots on hosts without
Tesseract installed; a clear error is surfaced if they are unavailable.
"""

from __future__ import annotations

import io
import logging
import os
from collections.abc import AsyncIterator
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Entry point (called from main.py as BackgroundTasks.add_task)
# ---------------------------------------------------------------------------


async def run_ocr_pipeline(book_id: str) -> None:
    """
    Main OCR entry point designed to be swapped for a job queue later.
    1. Fetch scan_pages rows for the book.
    2. Download each image from Supabase Storage.
    3. Preprocess + OCR each page.
    4. Combine, clean, upload text.
    5. Update books row with results.
    """
    try:
        await _execute_pipeline(book_id)
    except Exception as exc:
        logger.exception("OCR pipeline failed for book %s: %s", book_id, exc)
        # Best-effort: mark scan as failed
        try:
            import database

            if database.is_configured():
                database.get_client().table("books").update(
                    {"scan_status": "scanned"}  # fall back to last safe status
                ).eq("id", book_id).execute()
        except Exception:
            pass


async def _execute_pipeline(book_id: str) -> None:
    """Inner implementation — raises on unrecoverable errors."""
    # Lazy imports so the app boots without Tesseract
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageOps
    except ImportError as exc:
        raise RuntimeError(
            "pytesseract and/or Pillow are not installed. "
            "Run: pip install pytesseract Pillow"
        ) from exc

    import database
    from triage_logic import clean_ocr_text

    if not database.is_configured():
        raise RuntimeError("Supabase is not configured; cannot run OCR pipeline.")

    db = database.get_client()

    # Mark as scanning
    db.table("books").update({"scan_status": "scanning"}).eq("id", book_id).execute()

    # Fetch page records in order
    pages_resp = (
        db.table("scan_pages")
        .select("*")
        .eq("book_id", book_id)
        .order("page_number")
        .execute()
    )
    pages: list[dict[str, Any]] = pages_resp.data or []

    if not pages:
        logger.warning("No scan_pages found for book %s", book_id)
        db.table("books").update({"scan_status": "not_scanned"}).eq("id", book_id).execute()
        return

    page_texts: list[str] = []
    page_confidences: list[float] = []

    for page in pages:
        page_id = page["id"]
        image_path = page["image_path"]

        try:
            # Download image bytes from Supabase Storage
            image_bytes = _download_image(db, image_path)
            if image_bytes is None:
                logger.warning("Could not download image for page %s", page_id)
                continue

            # Preprocess
            pil_image = _preprocess_image(image_bytes, Image, ImageFilter, ImageOps)

            # OCR
            raw_text: str = pytesseract.image_to_string(pil_image, lang="eng")

            # Confidence via image_to_data
            confidence = _calculate_confidence(pil_image, pytesseract)

            page_texts.append(raw_text)
            page_confidences.append(confidence)

            # Update scan_page row
            db.table("scan_pages").update(
                {
                    "ocr_text": raw_text,
                    "ocr_confidence": round(confidence, 2),
                }
            ).eq("id", page_id).execute()

        except Exception as exc:
            logger.warning("OCR failed for page %s: %s", page_id, exc)

    if not page_texts:
        logger.warning("No pages successfully OCR'd for book %s", book_id)
        db.table("books").update({"scan_status": "scanned"}).eq("id", book_id).execute()
        return

    # Combine and clean
    combined_raw = "\n\n".join(page_texts)
    clean_text = clean_ocr_text(combined_raw)

    word_count = len(clean_text.split())
    avg_confidence = sum(page_confidences) / len(page_confidences) if page_confidences else 0.0
    quality_score = round(avg_confidence / 100.0, 2)  # normalise 0–1

    # Upload to Supabase Storage bucket "ocr-text"
    text_path = f"{book_id}.txt"
    text_bytes = clean_text.encode("utf-8")
    upload_success = _upload_text(db, text_path, text_bytes)

    # Update books row
    update_data: dict[str, Any] = {
        "scan_status": "ocr_complete",
        "ocr_text_path": text_path if upload_success else None,
        "ocr_quality_score": quality_score,
        "ocr_word_count": word_count,
        "ocr_page_count": len(page_texts),
    }
    db.table("books").update(update_data).eq("id", book_id).execute()

    logger.info(
        "OCR complete for book %s: %d pages, %d words, quality=%.2f",
        book_id,
        len(page_texts),
        word_count,
        quality_score,
    )


# ---------------------------------------------------------------------------
# Image preprocessing helpers
# ---------------------------------------------------------------------------


def _preprocess_image(
    image_bytes: bytes,
    Image: Any,
    ImageFilter: Any,
    ImageOps: Any,
) -> Any:
    """
    Preprocess a page image for optimal OCR:
    1. Convert to greyscale
    2. Auto-contrast (histogram normalisation)
    3. Sharpen (unsharp mask)
    4. Deskew estimate via rotation of whitespace minimisation (light version)
    """
    img = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB first if needed (handles RGBA / P modes)
    if img.mode not in ("L", "RGB"):
        img = img.convert("RGB")

    # Greyscale
    img = ImageOps.grayscale(img)

    # Auto-contrast: stretch histogram to full range
    img = ImageOps.autocontrast(img, cutoff=1)

    # Sharpen
    img = img.filter(ImageFilter.SHARPEN)

    # Light deskew: try small rotations and pick the one with least variance
    img = _deskew(img, Image)

    return img


def _deskew(img: Any, Image: Any) -> Any:
    """
    Estimate skew by checking small rotations (-3° to +3°) and returning the
    rotation that minimises the variance of horizontal projection (row sums).
    This is a lightweight approximation that handles typical book scans.
    """
    try:
        import statistics

        best_angle = 0.0
        best_variance: float | None = None

        for angle in [a * 0.5 for a in range(-6, 7)]:  # -3.0 to +3.0 in 0.5 steps
            rotated = img.rotate(angle, expand=False, fillcolor=255)
            import struct
            pixels = list(rotated.getdata())
            width, height = rotated.size
            row_sums = [
                sum(pixels[r * width : (r + 1) * width]) for r in range(height)
            ]
            variance = statistics.variance(row_sums) if len(row_sums) > 1 else 0
            if best_variance is None or variance < best_variance:
                best_variance = variance
                best_angle = angle

        if best_angle != 0.0:
            img = img.rotate(best_angle, expand=False, fillcolor=255)
    except Exception:
        pass  # deskew is optional; never break the pipeline

    return img


# ---------------------------------------------------------------------------
# Confidence calculation
# ---------------------------------------------------------------------------


def _calculate_confidence(img: Any, pytesseract: Any) -> float:
    """
    Use image_to_data to get per-word confidence scores.
    Returns mean confidence (0–100) ignoring words with conf < 0.
    """
    try:
        import pandas as pd  # optional; use manual parsing as fallback

        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DATAFRAME)
        conf_values = data["conf"].dropna()
        conf_values = conf_values[conf_values >= 0]
        if conf_values.empty:
            return 0.0
        return float(conf_values.mean())
    except ImportError:
        pass

    # Manual TSV parsing fallback (no pandas)
    try:
        tsv = pytesseract.image_to_data(img)
        lines = tsv.strip().split("\n")
        if len(lines) < 2:
            return 0.0
        header = lines[0].split("\t")
        conf_idx = header.index("conf") if "conf" in header else -1
        if conf_idx < 0:
            return 0.0
        values: list[float] = []
        for line in lines[1:]:
            parts = line.split("\t")
            if len(parts) > conf_idx:
                try:
                    v = float(parts[conf_idx])
                    if v >= 0:
                        values.append(v)
                except ValueError:
                    pass
        return sum(values) / len(values) if values else 0.0
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Supabase Storage helpers
# ---------------------------------------------------------------------------


def _download_image(db: Any, image_path: str) -> bytes | None:
    """Download an image from the scan-pages bucket."""
    try:
        response = db.storage.from_("scan-pages").download(image_path)
        return response
    except Exception as exc:
        logger.warning("Failed to download image %s: %s", image_path, exc)
        return None


def _upload_text(db: Any, path: str, content: bytes) -> bool:
    """Upload cleaned text to the ocr-text bucket. Returns True on success."""
    try:
        db.storage.from_("ocr-text").upload(
            path,
            content,
            {"content-type": "text/plain; charset=utf-8", "upsert": "true"},
        )
        return True
    except Exception as exc:
        logger.warning("Failed to upload OCR text %s: %s", path, exc)
        return False


def get_text_from_storage(db: Any, text_path: str) -> str | None:
    """Download and decode OCR text from storage. Returns None on failure."""
    try:
        raw: bytes = db.storage.from_("ocr-text").download(text_path)
        return raw.decode("utf-8")
    except Exception as exc:
        logger.warning("Failed to download OCR text %s: %s", text_path, exc)
        return None
