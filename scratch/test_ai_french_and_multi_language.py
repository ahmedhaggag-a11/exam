import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.ai_parser_service import AIParserService
from app.services.smart_nlp_parser import SmartNLPParser

def test_french_textbook_extraction():
    print("--- Testing French Textbook Question Extraction ---")

    french_sample = """
    Lycée Al-Ahram - Examen de la langue française
    Unité 1: Ma famille et mes amis

    Exercice 1. Choisissez la bonne réponse:
    1. Paul va au club pour ____ du sport.
    a) faire
    b) jouer
    c) lire
    d) regarder

    Exercice 2. Répondez par Vrai ou Faux:
    Mona habite à Le Caire avec sa famille.

    Exercice 3. Complétez les phrases suivantes avec la forme correcte du verbe.
    """

    questions = SmartNLPParser.parse_text(
        french_sample,
        subject="اللغة الفرنسية",
        chapter="Unité 1"
    )

    print(f"Extracted {len(questions)} French questions cleanly.")
    for q in questions:
        print(f"  [Q{q['question_number']} - {q['question_type']}]: {q['text'][:80]}...")
        if q['choices']:
            print(f"    Choices count: {len(q['choices'])}")

    assert len(questions) >= 2, f"Expected at least 2 French questions, got {len(questions)}"
    
    # Q1 assertions (QCM)
    q1 = questions[0]
    assert q1["question_type"] == "mcq"
    assert len(q1["choices"]) == 4

    print("[PASS] French textbook exercise extraction PASSED!")

def test_ai_clean_json():
    print("--- Testing AI Clean JSON Helper ---")
    raw_llm_output = """```json
    [
      {
        "question_number": 1,
        "text": "Où vas-tu le week-end?",
        "question_type": "essay",
        "difficulty": "easy",
        "choices": []
      }
    ]
    ```"""
    cleaned = AIParserService._clean_json_response(raw_llm_output)
    import json
    parsed = json.loads(cleaned)
    assert isinstance(parsed, list) and parsed[0]["text"] == "Où vas-tu le week-end?"
    print("[PASS] AI Clean JSON Helper PASSED!")

if __name__ == "__main__":
    test_french_textbook_extraction()
    test_ai_clean_json()
