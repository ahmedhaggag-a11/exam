# Template Service - Read-only Template Catalog Provider
from typing import List, Dict, Any, Optional
from app.database.connection import get_session_factory
from app.models import ExamTemplate

class TemplateService:
    @staticmethod
    def _presentation_template(template: ExamTemplate) -> Dict[str, Any]:
        """Format template properties cleanly for UI and print rendering."""
        data = template.to_dict()
        layout = data.get("layout_type")
        if layout == "classic":
            data["accent_color"] = "#2563EB"
        elif layout in ("ministry", "simple_first", "simple_last", "simple"):
            data["accent_color"] = "#000000"
        elif layout == "modern_split":
            data["accent_color"] = "#334155"
        return data

    @classmethod
    def get_all_templates(cls) -> List[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            tpls = session.query(ExamTemplate).order_by(ExamTemplate.id.asc()).all()
            return [cls._presentation_template(t) for t in tpls]
        finally:
            session.close()

    @classmethod
    def get_default_template(cls) -> Optional[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            tpl = session.query(ExamTemplate).filter(ExamTemplate.is_default == True).first()
            if not tpl:
                tpl = session.query(ExamTemplate).first()
            return cls._presentation_template(tpl) if tpl else None
        finally:
            session.close()

    @classmethod
    def get_template_by_id(cls, template_id: int) -> Optional[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            tpl = session.query(ExamTemplate).filter(ExamTemplate.id == template_id).first()
            return cls._presentation_template(tpl) if tpl else None
        finally:
            session.close()

    @classmethod
    def set_default_template(cls, template_id: int) -> bool:
        session = get_session_factory()()
        try:
            selected = session.query(ExamTemplate).filter(ExamTemplate.id == template_id).first()
            if not selected:
                return False

            session.query(ExamTemplate).update({ExamTemplate.is_default: False})
            selected.is_default = True
            session.commit()
            return True
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
