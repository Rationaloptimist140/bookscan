"""
BookScan — OCR pipeline.
Pillow preprocessing -> pytesseract -> clean_ocr_text -> local filesystem storage.
Runs as a FastAPI BackgroundTask.
pytesseract and PIL are imported lazily so the app boots on hosts without
Tesseract installed; a clear error is surfaced if they are unavailable.
"""

from __future__ import annotations

import io
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Storage directory (configurable via env var, default ./storage)
# ---------------------------------------------------------------------------

STORAGE_DIR = os.environ.get("STORAGE_DIR", "./storage")


def _storage_path(*parts: str) -> Path:
    """Build an absolute path under STORAGE_DIR and ensure parent dirs exist."""
    p = Path(STORAGE_DIR).joinpath(*parts)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


# ---------------------------------------------------------------------------
# Entry point (called from main.py as BackgroundTasks.add_task)
# ---------------------------------------------------------------------------


async def run_ocr_pipeline(book_id: str) -> None:
    """
    Main OCR entry point designed to be swapped for a job queue later.
    1. Fetch scan_pages rows for the book.
    2. Read each image from local filesystem storage.
    3. Preprocess + OCR each page.
    4. Combine, clean, write text to local storage.
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
                from sqlalchemy import text as sa_text

                async for session in database.get_session():
                    await session.execute(
                        sa_text(
                            "UPDATE books SET scan_status = 'scanned' "
                            "WHERE id = :book_id"
                        ),
                        {"book_id": book_id},
                    )
                    await session.commit()
                    break
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
    from sqlalchemy import text as sa_text
    from triage_logic import clean_ocr_text

    if not database.is_configured():
        raise RuntimeError("Database is not configured; cannot run OCR pipeline.")

    async for session in database.get_session():
        # Mark as scanning
        await session.execute(
            sa_text("UPDATE books SET scan_status = 'scanning' WHERE id = :book_id"),
            {"book_id": book_id},
        )
        await session.commit()

        # Fetch page records in order
        result = await session.execute(
            sa_text(
                "SELECT * FROM scan_pages "
                "WHERE book_id = :book_id ORDER BY page_number"
            ),
            {"book_id": book_id},
        )
        pages: list[dict[str, Any]] = [dict(r) for r in result.mappings().all()]

        if not pages:
            logger.warning("No scan_pages found for book %s", book_id)
            await session.execute(
                sa_text(
                    "UPDATE books SET scan_status = 'not_scanned' WHERE id = :book_id"
                ),
                {"book_id": book_id},
            )
            await session.commit()
            return

        page_texts: list[str] = []
        page_confidences: list[float] = []

        for page in pages:
            page_id = page["id"]
            image_path = page["image_path"]

            try:
                # Read image bytes from local filesystem storage
                image_bytes = _read_image(image_path)
                if image_bytes is None:
                    logger.warning("Could not read image for page %s", page_id)
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
                await session.execute(
                    sa_text(
                        "UPDATE scan_pages "
                        "SET ocr_text = :ocr_text, ocr_confidence = :ocr_confidence "
                        "WHERE id = :page_id"
                    ),
                    {
                        "ocr_text": raw_text,
                        "ocr_confidence": round(confidence, 2),
                        "page_id": page_id,
                    },
                )
                await session.commit()

            except Exception as exc:
                logger.warning("OCR failed for page %s: %s", page_id, exc)

        if not page_texts:
            logger.warning("No pages successfully OCR'd for book %s", book_id)
            await session.execute(
                sa_text(
                    "UPDATE books SET scan_status = 'scanned' WHERE id = :book_id"
                ),
                {"book_id": book_id},
            )
            await session.commit()
            return

        # Combine and clean
        combined_raw = "\n\n".join(page_texts)
        clean_text = clean_ocr_text(combined_raw)

        word_count = len(clean_text.split())
        avg_confidence = (
            sum(page_confidences) / len(page_confidences)
            if page_confidences
            else 0.0
        )
        quality_score = round(avg_confidence / 100.0, 2)  # normalise 0-1

        # Write to local filesystem storage under "ocr-text"
        text_path = f"{book_id}.txt"
        text_bytes = clean_text.encode("utf-8")
        upload_success = _write_text(text_path, text_bytes)

        # Update books row
        await session.execute(
            sa_text(
                "UPDATE books SET "
                "scan_status = 'ocr_complete', "
                "ocr_text_path = :ocr_text_path, "
                "ocr_quality_score = :ocr_quality_score, "
                "ocr_word_count = :ocr_word_count, "
                "ocr_page_count = :ocr_page_count "
                "WHERE id = :book_id"
            ),
            {
                "ocr_text_path": text_path if upload_success else None,
                "ocr_quality_score": quality_score,
                "ocr_word_count": word_count,
                "ocr_page_count": len(page_texts),
                "book_id": book_id,
            },
        )
        await session.commit()

        logger.info(
            "OCR complete for book %s: %d pages, %d words, quality=%.2f",
            book_id,
            len(page_texts),
            word_count,
            quality_score,
        )
        break  # only need one iteration of the generator


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
    Estimate skew by checking small rotations (-3 to +3 degrees) and returning
    the rotation that minimises the variance of horizontal projection (row sums).
    This is a lightweight approximation that handles typical book scans.
    """
    try:
        import statistics

        best_angle = 0.0
        best_variance: float | None = None

        for angle in [a * 0.5 for a in range(-6, 7)]:  # -3.0 to +3.0 in 0.5 steps
            rotated = img.rotate(angle, expand=False, fillcolor=255)
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
    Returns mean confidence (0-100) ignoring words with conf < 0.
    """
    try:
        import pandas as pd  # optional; use manual parsing as fallback

        data = pytesseract.image_to_data(
            img, output_type=pytesseract.Output.DATAFRAME
        )
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
# Local filesystem storage helpers
# ---------------------------------------------------------------------------


def _read_image(image_path: str) -> bytes | None:
    """Read an image from the scan-pages storage directory."""
    try:
        full_path = _storage_path("scan-pages", image_path)
        return full_path.read_bytes()
    except Exception as exc:
        logger.warning("Failed to read image %s: %s", image_path, exc)
        return None


def _write_text(path: str, content: bytes) -> bool:
    """Write cleaned text to the ocr-text storage directory. Returns True on success."""
    try:
        full_path = _storage_path("ocr-text", path)
        full_path.write_bytes(content)
        return True
    except Exception as exc:
        logger.warning("Failed to write OCR text %s: %s", path, exc)
        return False


def get_text_from_storage(text_path: str) -> str | None:
    """Read and decode OCR text from local storage. Returns None on failure."""
    try:
        full_path = Path(STORAGE_DIR) / "ocr-text" / text_path
        if not full_path.exists():
            return None
        return full_path.read_text(encoding="utf-8")
    except Exception as exc:
        logger.warning("Failed to read OCR text %s: %s", text_path, exc)
        return None
