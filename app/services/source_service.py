import os
import shutil
from typing import List, Dict, Any, Optional, Tuple
from app.database.connection import get_session_factory
from app.models import EducationalSource, SourceType, SourceStatus
from app.services.pdf_parser_service import PDFParserService


class SourceService:
    STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "data", "uploads")

    @classmethod
    def _ensure_storage_dir(cls):
        os.makedirs(cls.STORAGE_DIR, exist_ok=True)

    @classmethod
    def get_all_sources(cls) -> List[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            sources = session.query(EducationalSource).order_by(EducationalSource.id.asc()).all()
            return [s.to_dict() for s in sources]
        finally:
            session.close()

    @classmethod
    def get_sources_count(cls) -> int:
        session = get_session_factory()()
        try:
            return session.query(EducationalSource).count()
        finally:
            session.close()

    @classmethod
    def get_source_by_id(cls, source_id: int) -> Optional[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            s = session.query(EducationalSource).filter(EducationalSource.id == source_id).first()
            return s.to_dict(include_extracted=True) if s else None
        finally:
            session.close()

    @classmethod
    def create_source(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        session = get_session_factory()()
        try:
            src = EducationalSource(
                name_ar=data.get("name_ar", "مصدر جديد"),
                name_en=data.get("name_en", data.get("name_ar", "New Source")),
                subject=data.get("subject", "الفيزياء"),
                term=data.get("term"),
                branch=data.get("branch"),
                chapter=data.get("chapter"),
                lesson=data.get("lesson"),
                source_type=SourceType(data.get("source_type", SourceType.TEXTBOOK.value)),
                chapter_count=int(data.get("chapter_count", 0)),
                question_count=int(data.get("question_count", 0)),
                pages_count=int(data.get("pages_count", 0)),
                status=SourceStatus(data.get("status", SourceStatus.CERTIFIED.value)),
                status_ar=data.get("status_ar", "معتمد رسمياً"),
                status_en=data.get("status_en", "Certified"),
                is_locked=bool(data.get("is_locked", False)),
                file_path=data.get("file_path"),
                file_name=data.get("file_name"),
                file_size_kb=data.get("file_size_kb"),
                content_extracted=bool(data.get("content_extracted", False)),
                extracted_text=data.get("extracted_text"),
                parent_source_id=data.get("parent_source_id"),
                author_name=data.get("author_name"),
                grade_level=data.get("grade_level"),
                publisher=data.get("publisher"),
                publication_year=data.get("publication_year"),
                description_ar=data.get("description_ar"),
                chapters_json=data.get("chapters_json"),
            )
            session.add(src)
            session.commit()
            return src.to_dict()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def update_source(cls, source_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            src = session.query(EducationalSource).filter(EducationalSource.id == source_id).first()
            if not src:
                return None

            for field in [
                "name_ar", "name_en", "subject", "chapter_count", "question_count",
                "pages_count", "status_ar", "status_en", "is_locked", "file_path",
                "file_name", "file_size_kb", "content_extracted", "extracted_text",
                "parent_source_id", "author_name", "grade_level", "publisher",
                "publication_year", "description_ar", "chapters_json", "term",
                "branch", "chapter", "lesson"
            ]:
                if field in data:
                    setattr(src, field, data[field])

            if "source_type" in data:
                src.source_type = SourceType(data["source_type"])
            if "status" in data:
                src.status = SourceStatus(data["status"])

            session.commit()
            return src.to_dict()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def delete_source(cls, source_id: int) -> bool:
        session = get_session_factory()()
        try:
            src = session.query(EducationalSource).filter(EducationalSource.id == source_id).first()
            if not src:
                return False
            if src.file_path and os.path.exists(src.file_path):
                try:
                    os.remove(src.file_path)
                except Exception:
                    pass
            session.delete(src)
            session.commit()
            return True
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def _store_uploaded_file(cls, src_file_path: str, original_name: str) -> Tuple[str, int]:
        cls._ensure_storage_dir()
        import uuid
        ext = os.path.splitext(original_name)[1] or ".pdf"
        safe_name = f"{uuid.uuid4().hex}{ext}"
        dest_path = os.path.join(cls.STORAGE_DIR, safe_name)
        shutil.copy2(src_file_path, dest_path)
        size_kb = int(os.path.getsize(dest_path) / 1024)
        return dest_path, size_kb

    @classmethod
    def upload_pdf_and_extract(
        cls,
        pdf_file_path: str,
        original_name: str,
        name_ar: Optional[str] = None,
        subject: str = "الفيزياء",
        default_chapter: str = "الفصل الأول",
        author_name: Optional[str] = None,
        grade_level: Optional[str] = None,
        term: Optional[str] = None,
        branch: Optional[str] = None,
        lesson: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], str, List[Dict[str, Any]]]:
        stored_path, size_kb = cls._store_uploaded_file(pdf_file_path, original_name)

        try:
            res = PDFParserService.parse_pdf_to_questions(
                stored_path,
                default_chapter=default_chapter,
                default_source=name_ar or os.path.splitext(original_name)[0],
                default_subject=subject,
                grade_level=grade_level,
                term=term,
                branch=branch,
                lesson=lesson
            )
            if len(res) == 3:
                extracted_text, questions, _meta = res
            else:
                extracted_text, questions = res[0], res[1]
        except Exception as err:
            import logging
            logging.error(f"Error extracting PDF '{original_name}': {err}", exc_info=True)
            extracted_text, questions = "", []

        base_name = os.path.splitext(original_name)[0]
        data = {
            "name_ar": name_ar or f"ملف PDF: {base_name}",
            "name_en": f"PDF: {base_name}",
            "subject": subject,
            "grade_level": grade_level,
            "term": term,
            "branch": branch,
            "chapter": default_chapter,
            "lesson": lesson,
            "source_type": SourceType.PDF_UPLOAD.value,
            "chapter_count": 1,
            "question_count": len(questions),
            "pages_count": 0,
            "status": SourceStatus.PENDING.value,
            "status_ar": "قيد المعالجة",
            "status_en": "Processing",
            "is_locked": False,
            "file_path": stored_path,
            "file_name": original_name,
            "file_size_kb": size_kb,
            "content_extracted": bool(extracted_text),
            "extracted_text": extracted_text[:20000] if extracted_text else None,
            "author_name": author_name,
            "description_ar": f"ملف PDF تم استيراده من {original_name}. عدد الأسئلة المستخرجة: {len(questions)}",
        }
        src = cls.create_source(data)

        if questions and src:
            cls.update_source(src["id"], {
                "status": SourceStatus.CERTIFIED.value,
                "status_ar": "معتمد رسمياً",
                "status_en": "Certified",
            })

        return src, extracted_text, questions
