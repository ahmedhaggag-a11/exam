import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')

from app.ui.components import PaperPreviewWidget
from app.services import TemplateService
from app.database.seed_data import seed_initial_data
print('All imports passed!')

from app.database.connection import init_db
init_db()
tpls = TemplateService.get_all_templates()
print(f'Templates loaded: {len(tpls)}')
for t in tpls:
    tpl_line = "  - ID=%s layout=%-15s accent=%s  name=%s" % (
        str(t['id']).rjust(2),
        t['layout_type'],
        t['accent_color'],
        t['name_ar']
    )
    print(tpl_line)
print("\nDONE")
