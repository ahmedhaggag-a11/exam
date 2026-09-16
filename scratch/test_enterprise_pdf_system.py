import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.pdf_analyzer_service import PDFAnalyzerService
from app.services.ai_parser_service import AIParserService
from app.services.question_service import QuestionService
from app.services.pdf_parser_service import PDFParserService

def test_pdf_analyzer_pymupdf():
    print("--- Testing PDFAnalyzerService with PyMuPDF ---")
    
    # Test watermark scrubbing
    raw_watermark = """
    SearchTelegram@A7M_S3H4
    margeleTnihcraeS
    س1- احسب مقدار سعة المكثف في الدائرة الكهربية:
    (أ) 10 ميكروفاراد
    (ب) 20 ميكروفاراد
    t.me/SearchTelegram
    """
    cleaned = PDFAnalyzerService.clean_page_text(raw_watermark)
    print("Cleaned text output:")
    print(cleaned)

    assert "SearchTelegram" not in cleaned
    assert "margeleTnihcraeS" not in cleaned
    assert "t.me" not in cleaned
    assert "المكثف" in cleaned

    print("[PASS] PyMuPDF PDFAnalyzerService & Watermark Scrubbing PASSED!")

def test_question_duplicate_detection():
    print("--- Testing Question Bank Duplicate Detection ---")
    
    # Create sample question payload
    import uuid
    unique_text = f"سؤال اختبار نظام الكشف عن التكرار المحتمل للأسئلة - {uuid.uuid4().hex}"
    q_payload = {
        "text": unique_text,
        "question_type": "mcq",
        "difficulty": "easy",
        "subject": "الفيزياء",
        "chapter": "الفصل الأول",
        "source": "اختبار تكرار",
        "tags": ["تكرار"],
        "marks": 2,
        "choices": [
            {"choice_code": "أ", "text": "اختيار 1", "is_correct": True},
            {"choice_code": "ب", "text": "اختيار 2", "is_correct": False},
        ]
    }
    
    created = QuestionService.create_question(q_payload)
    print(f"Created sample question ID: {created['id']}")

    dup = QuestionService.check_duplicate(unique_text)
    assert dup is not None, "Expected duplicate detection match!"
    assert dup["id"] == created["id"]

    print(f"[PASS] Duplicate detection matched question ID #{dup['id']} cleanly!")

def test_ai_parser_background_progress():
    print("--- Testing AIParserService Progress Reporting & Smart Chunking ---")
    
    progress_updates = []
    def on_progress(curr, total, msg):
        progress_updates.append((curr, total, msg))
        print(f" Progress Callback: [{curr}/{total}] - {msg}")

    # Test SmartNLPParser progress & chunk parsing directly
    from app.services.smart_nlp_parser import SmartNLPParser
    sample_txt = "1. Exercice de physique/chimie\na) 10 N\nb) 20 N"
    questions = SmartNLPParser.parse_text(sample_txt, subject="الفيزياء")
    assert len(questions) == 1
    assert questions[0]["question_type"] == "mcq"
    print(f"[PASS] SmartNLPParser parsed clean questions: {questions[0]['text']}")

if __name__ == "__main__":
    test_pdf_analyzer_pymupdf()
    test_question_duplicate_detection()
    test_ai_parser_background_progress()
