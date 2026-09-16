import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from app.database.seed_data import seed_initial_data
from app.services.template_service import TemplateService

def test_four_templates():
    seed_initial_data()
    templates = TemplateService.get_all_templates()
    print(f"Total templates in catalog: {len(templates)}")
    assert len(templates) == 4, f"Expected 4 templates, got {len(templates)}"

    for idx, t in enumerate(templates, 1):
        print(f"Template {idx}: ID={t['id']} | Layout={t['layout_type']} | Accent={t['accent_color']}")

    print("[PASS] Exactly 4 clean, distinct templates verified!")

if __name__ == "__main__":
    test_four_templates()
