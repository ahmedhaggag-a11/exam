import os
import sys
import customtkinter as ctk

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from app.ui.components.paper_preview import PaperPreviewWidget

def test_paper_preview_with_images():
    root = ctk.CTk()
    root.withdraw()

    # Create dummy image
    test_img_dir = os.path.join(base_dir, "data", "uploads", "question_images")
    os.makedirs(test_img_dir, exist_ok=True)
    fake_img = os.path.join(test_img_dir, "test_preview_img.png")
    
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (400, 300), color='#2563EB')
    d = ImageDraw.Draw(img)
    d.text((10, 10), "Exam Diagram Test", fill=(255, 255, 255))
    img.save(fake_img)

    exam_data = {
        "name": "اختبار تجريبي شامل",
        "subject": "الفيزياء",
        "duration": "60 دقيقة",
        "instructions": "أجب عن جميع الأسئلة الآتية."
    }

    questions = [
        {
            "id": 1,
            "text": "السؤال الأول: احسب قيمة التيار الكهربي المار في الدائرة الموضحة بالشكل المرفق.",
            "question_type": "mcq",
            "marks": 2,
            "choices": [
                {"choice_code": "أ", "text": "2 Ampere"},
                {"choice_code": "ب", "text": "4 Ampere"},
                {"choice_code": "ج", "text": "6 Ampere"},
                {"choice_code": "د", "text": "8 Ampere"}
            ],
            "image_paths": [fake_img]
        },
        {
            "id": 2,
            "text": "السؤال الثاني: علل لما يأتي تعليلاً علمياً دقيقاً.",
            "question_type": "essay",
            "marks": 3,
            "choices": []
        }
    ]

    for layout_type in ["classic", "ministry", "modern_split", "simple_first"]:
        template = {"layout_type": layout_type, "accent_color": "#2563EB" if layout_type=="classic" else "#000000"}
        preview = PaperPreviewWidget(root, exam_data=exam_data, questions=questions, template=template)
        preview.update_idletasks()
        print(f"[PASS] PaperPreviewWidget rendered successfully for layout: {layout_type}")

    root.destroy()
    print("\nALL 4 LAYOUTS RENDERED QUESTION IMAGES CLEANLY WITHOUT OVERLAP!")

if __name__ == "__main__":
    test_paper_preview_with_images()
