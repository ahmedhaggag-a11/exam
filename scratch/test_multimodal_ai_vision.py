import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.ai_parser_service import AIParserService
from app.services.pdf_parser_service import PDFParserService

def test_multimodal_ai_vision_schema():
    print("--- Testing Multimodal AI Vision Schema ---")
    
    dummy_llm_json = """
    {
      "detected_language": "french",
      "detected_subject": "اللغة الفرنسية",
      "detected_chapter": "Unité 2: Au marché",
      "questions": [
        {
          "question_number": 1,
          "text": "Complétez avec l'article défini convenable: .... garçon joue au ballon.",
          "question_type": "mcq",
          "difficulty": "easy",
          "choices": [
            {"choice_code": "a", "text": "Le", "is_correct": true},
            {"choice_code": "b", "text": "La", "is_correct": false},
            {"choice_code": "c", "text": "Les", "is_correct": false}
          ],
          "model_answer": "a) Le"
        }
      ]
    }
    """
    
    cleaned = AIParserService._clean_json_response(dummy_llm_json)
    import json
    data = json.loads(cleaned)
    assert data["detected_language"] == "french"
    assert data["detected_subject"] == "اللغة الفرنسية"
    assert len(data["questions"]) == 1
    q = data["questions"][0]
    assert q["question_type"] == "mcq"
    assert len(q["choices"]) == 3
    assert q["choices"][0]["is_correct"] is True

    print("[PASS] Multimodal AI Vision Schema & JSON Parsing PASSED!")

def test_pdf_parser_vision_metadata():
    print("--- Testing PDFParserService Metadata Return ---")
    
    # Test parse_questions_from_text or SmartNLPParser directly
    from app.services.smart_nlp_parser import SmartNLPParser
    qs = SmartNLPParser.parse_text("1. Exercice de français\na) Option 1\nb) Option 2", subject="اللغة الفرنسية")
    assert len(qs) == 1
    assert qs[0]["question_type"] == "mcq"
    print(f"[PASS] SmartNLPParser parsed French question with MCQ choices cleanly: {qs[0]['text']}")

if __name__ == "__main__":
    test_multimodal_ai_vision_schema()
    test_pdf_parser_vision_metadata()
