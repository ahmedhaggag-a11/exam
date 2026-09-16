import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.pdf_parser_service import PDFParserService
from app.services.smart_nlp_parser import SmartNLPParser

def test_watermark_removal():
    print("--- Testing PDF Telegram Watermark Overlay Removal ---")
    watermark_sample = """
    4H3S_M7A@margeleTnihcraeS4H3S_M7A@margeleTnihcraeS4_M7A@margeleTnihcraeS
    س1- في الشكل المقابل احسب قيمة المقاومة المكافئة للدائرة الكهربية:
    (أ) 10 أوم
    (ب) 20 أوم
    4H3S_M7A@margeleTnihcraeS
    t.me/SearchTelegram
    (ج) 30 أوم
    (د) 40 أوم
    """

    cleaned = PDFParserService.fix_arabic_pdf_text(watermark_sample)
    print("Cleaned text output:")
    print(cleaned)

    assert "margeleTnihcraeS" not in cleaned
    assert "4H3S_M7A" not in cleaned
    assert "t.me" not in cleaned

    questions = SmartNLPParser.parse_text(cleaned, subject="الفيزياء")
    print(f"Extracted {len(questions)} clean questions (watermarks stripped!).")
    assert len(questions) == 1
    assert questions[0]["question_type"] == "mcq"
    assert len(questions[0]["choices"]) == 4

    print("[SUCCESS] Telegram Watermark Overlay Stripping Verified Successfully!")

if __name__ == "__main__":
    test_watermark_removal()
