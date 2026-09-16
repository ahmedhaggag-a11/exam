import os
import json
import sys

# Add project root to sys.path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from app.services.pdf_parser_service import PDFParserService
from app.services.question_service import QuestionService

def test_digit_conversion():
    text = "س١- ما هو المقدار الفيزيائي؟ 1. أ 2. ب"
    res = PDFParserService._convert_eastern_arabic_digits(text)
    assert "س1-" in res
    print("[PASS] Eastern Arabic digit conversion works!")

def test_arabic_pdf_extraction_with_eastern_digits_and_answers():
    sample_text = """
    وزارة التربية والتعليم - امتحان مادة الكيمياء
    الوحدة الأولى: البناء الذري

    س١- ما هو العدد الذري لعنصر الصوديوم؟
    (أ) 11
    (ب) 12
    (ج) 23
    (د) 24
    [الإجابة: أ]

    س٢- تفسير ظاهرة الأطياف الخطية للذرات.

    نموذج الإجابة:
    س1 - أ
    س2 - essay
    """
    questions = PDFParserService.parse_questions_from_text(
        sample_text,
        default_subject="الكيمياء",
        default_chapter="الوحدة الأولى"
    )
    print(f"Extracted {len(questions)} questions from Arabic text.")
    assert len(questions) == 2, f"Expected 2 questions, got {len(questions)}"
    q1 = questions[0]
    assert q1["question_type"] == "mcq"
    correct_choices = [c for c in q1["choices"] if c.get("is_correct")]
    assert len(correct_choices) == 1 and correct_choices[0]["choice_code"] == "أ"
    print("[PASS] Multi-subject Arabic PDF parsing & answer key extraction successful!")

def test_english_pdf_extraction():
    sample_text = """
    Ministry of Education - Physics Exam
    Section 1: Electromagnetism

    Q1. What is the SI unit of electric current?
    A) Volt
    B) Ampere
    C) Ohm
    D) Watt
    Answer: B

    Problem 2. State Faraday's law of electromagnetic induction.
    """
    questions = PDFParserService.parse_questions_from_text(
        sample_text,
        default_subject="Physics",
        default_chapter="Electromagnetism"
    )
    print(f"Extracted {len(questions)} questions from English text.")
    assert len(questions) == 2, f"Expected 2 questions, got {len(questions)}"
    q1 = questions[0]
    assert q1["question_type"] == "mcq"
    correct = [c for c in q1["choices"] if c.get("is_correct")]
    assert len(correct) == 1 and correct[0]["choice_code"] == "B"
    print("[PASS] Multi-subject English PDF parsing successful!")

def test_manual_question_creation_with_image():
    # Simulate saving a question created manually with an image
    test_img_dir = os.path.join(base_dir, "data", "uploads", "question_images")
    os.makedirs(test_img_dir, exist_ok=True)
    fake_img = os.path.join(test_img_dir, "test_manual_img.png")
    with open(fake_img, "w") as f:
        f.write("fake image content")

    payload = {
        "text": "سؤال تجريبي يختبر الصورة المرفقة يدويًا",
        "question_type": "mcq",
        "difficulty": "medium",
        "subject": "الفيزياء",
        "chapter": "الفصل الأول",
        "source": "تجربة يدوي",
        "tags": ["صورة", "تجربة"],
        "marks": 2,
        "choices": [
            {"choice_code": "أ", "text": "اختيار 1", "is_correct": True},
            {"choice_code": "ب", "text": "اختيار 2", "is_correct": False},
        ],
        "image_paths": [fake_img]
    }

    created = QuestionService.create_question(payload)
    assert created["id"] is not None
    fetched = QuestionService.get_question_by_id(created["id"])
    assert len(fetched.get("image_paths", [])) == 1
    assert fetched["image_paths"][0] == fake_img
    print(f"[PASS] Manual question creation with attached image verified! Question ID: {created['id']}")

if __name__ == "__main__":
    test_digit_conversion()
    test_arabic_pdf_extraction_with_eastern_digits_and_answers()
    test_english_pdf_extraction()
    test_manual_question_creation_with_image()
    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
