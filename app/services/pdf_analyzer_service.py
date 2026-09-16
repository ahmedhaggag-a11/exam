import os
import io
import re
import unicodedata
from typing import List, Dict, Any, Optional, Tuple

class PDFAnalyzerService:
    """Enterprise PDF Analyzer Engine using PyMuPDF (pymupdf).

    Analyzes PDF pages, detects scanned image pages, cleans watermarks,
    preserves scientific formulas (Math, Physics, Chemistry, Biology),
    and structures content into page-indexed chunks.
    """

    WATERMARK_PATTERNS = [
        r'(?:https?://)?(?:t|telegram)\.me/\S+',
        r'@[A-Za-z0-9_\-]+',
        r'\b(?:SearchTelegram|margeleTnihcraeS|A7M_S3H4|4H3S_M7A)\b',
        r'^\s*[A-Za-z0-9_@\-\.]{12,}\s*$',
    ]

    SCIENTIFIC_SYMBOLS = set("∑∫√πθΩΔμλσ±∞≈≠≤≥≡αβγδεH₂Okey")

    @classmethod
    def analyze_pdf(cls, file_path: str) -> Dict[str, Any]:
        """Analyze PDF document and extract page info, text, and images using PyMuPDF."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")

        try:
            import pymupdf as fitz
        except ImportError:
            try:
                import fitz
            except ImportError:
                fitz = None

        pages_data: List[Dict[str, Any]] = []

        if fitz:
            doc = fitz.open(file_path)
            total_pages = len(doc)
            
            for page_num in range(total_pages):
                page = doc[page_num]
                raw_page_text = page.get_text("text") or ""
                cleaned_text = cls.clean_page_text(raw_page_text)
                
                # Check if page is scanned image (low text density vs page area)
                rect = page.rect
                page_area = float(rect.width * rect.height)
                char_count = len(cleaned_text.strip())
                is_scanned = bool(char_count < 40 or (page_area > 0 and char_count / page_area < 0.05))

                # Render page image buffer (150 DPI)
                image_bytes = None
                try:
                    pix = page.get_pixmap(dpi=150)
                    image_bytes = pix.tobytes("jpeg")
                except Exception:
                    pass

                pages_data.append({
                    "page_number": page_num + 1,
                    "text": cleaned_text,
                    "is_scanned": is_scanned,
                    "image_bytes": image_bytes,
                    "char_count": char_count,
                })
            doc.close()
        else:
            # Fallback to pdfplumber
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page_idx, page in enumerate(pdf.pages, 1):
                    p_text = page.extract_text() or ""
                    cleaned_text = cls.clean_page_text(p_text)
                    is_scanned = len(cleaned_text.strip()) < 40

                    image_bytes = None
                    try:
                        img = page.to_image(resolution=150).original
                        buf = io.BytesIO()
                        img.save(buf, format="JPEG", quality=85)
                        image_bytes = buf.getvalue()
                    except Exception:
                        pass

                    pages_data.append({
                        "page_number": page_idx,
                        "text": cleaned_text,
                        "is_scanned": is_scanned,
                        "image_bytes": image_bytes,
                        "char_count": len(cleaned_text.strip()),
                    })

        scanned_count = sum(1 for p in pages_data if p["is_scanned"])
        full_text = "\n".join(p["text"] for p in pages_data if p["text"])

        return {
            "total_pages": len(pages_data),
            "scanned_pages_count": scanned_count,
            "is_mostly_scanned": bool(scanned_count > len(pages_data) * 0.5),
            "pages": pages_data,
            "full_text": full_text
        }

    @classmethod
    def clean_page_text(cls, text: str) -> str:
        """Clean watermarks, resolve character reversal, and preserve formulas."""
        if not text:
            return ""

        # Normalize unicode NFKC
        text = unicodedata.normalize("NFKC", text)

        # Strip Telegram and overlay watermark substrings
        text = re.sub(r'(?:SearchTelegram|margeleTnihcraeS|A7M_S3H4|4H3S_M7A|t\.me/\S+|@[A-Za-z0-9_\-]+)', '', text, flags=re.IGNORECASE)

        lines = text.splitlines()
        cleaned_lines = []

        for line in lines:
            s = line.strip()
            if not s:
                continue

            # Check watermark patterns
            if any(re.search(pat, s, re.IGNORECASE) for pat in cls.WATERMARK_PATTERNS):
                continue

            # Strip lines with no letters or digits or scientific symbols
            has_letters = any(c in s for c in 'ابتثجحخدذرزسشصضطظعغفقكلمنهويabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
            has_symbols = any(c in s for c in cls.SCIENTIFIC_SYMBOLS)
            if not has_letters and not has_symbols:
                continue

            if len(s) > 10 and not any(c in s for c in 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي') and re.match(r'^[A-Za-z0-9_@\-\.]+$', s):
                continue

            cleaned_lines.append(line)

        return "\n".join(cleaned_lines)
