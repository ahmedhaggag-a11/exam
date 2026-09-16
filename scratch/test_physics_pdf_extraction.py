import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.services.pdf_parser_service import PDFParserService

def test_physics_textbook_patterns():
    print("--- Running Physics Textbook PDF Extraction Tests ---")

    physics_textbook_sample = """
    وزارة التربية والتعليم - كتاب الفيزياء للصف الثالث الثانوي
    الفصل الأول: التيار الكهربي وقانون أوم

    مسألة (١): ملف دائري مساحة مقطعه 0.02 m² يمر به تيار كهربي شدته 5A. احسب كثافة الفيض المغناطيسي عند مر كزه.
    (أ) 0.05 تسلا
    (ب) 0.10 تسلا
    (ج) 0.15 تسلا
    (د) 0.20 تسلا
    [الإجابة: ب]

    في الشكل المقابل دائرة كهربية تحتوي على مقاومتين 4 أوم و 6 أوم متصلتين على التوالي ومصدر جهده 20 فولت. احسب شدة التيار الكلي.
    أ) 1 أمبير
    ب) 2 أمبير
    ج) 4 أمبير
    د) 5 أمبير

    [[EF_IMAGE:c:/Users/hagga/.gemini/antigravity/scratch/examforge/data/uploads/extracted_images/test_circuit.png]]
    اختبر نفسك (3): استنتج العلاقة بين القوة الدافعة الكهربية وفرق الجهد بين طرفي البطارية عند فتح الدائرة.

    س/4 احسب القوة المغناطيسية المؤثرة على سلك طوله 2 متر يمر به تيار 3 أمبير موضوع عمودياً على مجال مغناطيسي كثافته 0.5 تسلا.
    (أ) 3 نيوتن
    (ب) 6 نيوتن
    (ج) 9 نيوتن
    (د) 12 نيوتن

    نموذج الإجابة:
    1 - ب
    2 - ب
    4 - أ
    """

    # Create dummy fake image for testing marker linkage
    fake_img_dir = os.path.normpath(os.path.join(base_dir, "data", "uploads", "extracted_images"))
    os.makedirs(fake_img_dir, exist_ok=True)
    fake_img_path = os.path.join(fake_img_dir, "test_circuit.png")
    with open(fake_img_path, "w") as f:
        f.write("dummy image")

    questions = PDFParserService.parse_questions_from_text(
        physics_textbook_sample,
        default_subject="الفيزياء",
        default_chapter="الفصل الأول"
    )

    print(f"Extracted {len(questions)} questions from sample Physics textbook text.")
    for idx, q in enumerate(questions, 1):
        print(f"\nQ{idx} [Type: {q['question_type']}, Difficulty: {q['difficulty']}]:")
        print(f"  Text: {q['text'][:100]}...")
        print(f"  Choices count: {len(q['choices'])}")
        if q['choices']:
            correct = [c for c in q['choices'] if c.get('is_correct')]
            print(f"  Correct choice: {[c['choice_code'] for c in correct]}")
        if q['image_paths']:
            print(f"  Images attached: {len(q['image_paths'])}")

    assert len(questions) == 4, f"Expected 4 questions, got {len(questions)}"
    
    # Q1 assertions
    q1 = questions[0]
    assert q1["question_type"] == "mcq"
    assert any(c["is_correct"] for c in q1["choices"] if c["choice_code"] == "ب")

    # Q2 assertions (un-numbered question statement)
    q2 = questions[1]
    assert q2["question_type"] == "mcq"
    assert "في الشكل المقابل" in q2["text"]
    assert len(q2["choices"]) == 4

    # Q3 assertions (image attached)
    q3 = questions[2]
    assert q3["question_type"] == "essay"
    assert len(q3["image_paths"]) == 1

    # Q4 assertions (س/4)
    q4 = questions[3]
    assert q4["question_type"] == "mcq"
    assert any(c["is_correct"] for c in q4["choices"] if c["choice_code"] == "أ")

    print("\n[SUCCESS] All Physics textbook PDF extraction tests PASSED!")

def test_safe_float_bbox():
    class DummyObj:
        def get(self, key, default=None):
            return None  # Simulate pdfplumber returning None for x0
    
    class DummyPage:
        width = 600
        height = 800
        images = [DummyObj()]
        figures = []
        curves = []
        drawings = []
    
    bboxes = PDFParserService._find_page_visual_bboxes(DummyPage())
    print(f"[PASS] _find_page_visual_bboxes handled None objects gracefully! Bboxes count: {len(bboxes)}")

if __name__ == "__main__":
    test_physics_textbook_patterns()
    test_safe_float_bbox()
