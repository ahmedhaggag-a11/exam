# Educational Source Model - Full CRUD + Relationships + PDF Support
import enum
from typing import List, Optional
from sqlalchemy import String, Integer, DateTime, Boolean, Text, ForeignKey, Enum as SAEnum, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.models.base import Base, TimestampMixin

class SourceType(str, enum.Enum):
    TEXTBOOK = "textbook"
    NOTES = "notes"
    EXAM_BANK = "exam_bank"
    PAST_EXAM = "past_exam"
    PDF_UPLOAD = "pdf_upload"
    CHAPTER_SUMMARY = "chapter_summary"
    EXTERNAL = "external"

class SourceStatus(str, enum.Enum):
    CERTIFIED = "certified"
    EXCLUSIVE = "exclusive"
    PENDING = "pending"
    DRAFT = "draft"

class EducationalSource(Base, TimestampMixin):
    __tablename__ = "educational_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name_ar: Mapped[str] = mapped_column(String(200), nullable=False)
    name_en: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(100), default="الفيزياء")
    term: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    branch: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    chapter: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    lesson: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    source_type: Mapped[SourceType] = mapped_column(SAEnum(SourceType), default=SourceType.TEXTBOOK)

    # Content stats
    chapter_count: Mapped[int] = mapped_column(Integer, default=0)
    question_count: Mapped[int] = mapped_column(Integer, default=0)
    pages_count: Mapped[int] = mapped_column(Integer, default=0)

    # Status
    status: Mapped[SourceStatus] = mapped_column(SAEnum(SourceStatus), default=SourceStatus.CERTIFIED)
    # Legacy compatibility status texts
    status_ar: Mapped[str] = mapped_column(String(50), default="معتمد رسمياً")
    status_en: Mapped[str] = mapped_column(String(50), default="Certified")

    # Editing permissions
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)  # Changed: allow teacher sources to edit

    # FILE / PDF Support
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    file_size_kb: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    content_extracted: Mapped[bool] = mapped_column(Boolean, default=False)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # PARENT / CHILD RELATIONSHIP - Source hierarchy (e.g. Book -> Chapter -> Summary)
    parent_source_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("educational_sources.id", ondelete="SET NULL"), nullable=True)

    # Source metadata
    author_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    grade_level: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    publisher: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    publication_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description_ar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chapters_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of chapter names

    # Relationships (SQLAlchemy)
    parent_source: Mapped[Optional["EducationalSource"]] = relationship(
        "EducationalSource",
        remote_side=[id],
        back_populates="child_sources",
        foreign_keys=[parent_source_id]
    )
    child_sources: Mapped[List["EducationalSource"]] = relationship(
        "EducationalSource",
        back_populates="parent_source",
        foreign_keys=[parent_source_id],
        cascade="all, delete-orphan"
    )

    def to_dict(self, include_children=False, include_extracted=False):
        d = {
            "id": self.id,
            "name_ar": self.name_ar,
            "name_en": self.name_en,
            "subject": self.subject,
            "term": self.term,
            "branch": self.branch,
            "chapter": self.chapter,
            "lesson": self.lesson,
            "source_type": self.source_type.value if isinstance(self.source_type, SourceType) else self.source_type,
            "chapter_count": self.chapter_count,
            "question_count": self.question_count,
            "pages_count": self.pages_count,
            "status": self.status.value if isinstance(self.status, SourceStatus) else self.status,
            "status_ar": self.status_ar,
            "status_en": self.status_en,
            "is_locked": self.is_locked,
            "parent_source_id": self.parent_source_id,
            "parent_name_ar": self.parent_source.name_ar if self.parent_source else None,
            "children_count": len(self.child_sources) if self.child_sources else 0,
            "author_name": self.author_name,
            "grade_level": self.grade_level,
            "publisher": self.publisher,
            "publication_year": self.publication_year,
            "description_ar": self.description_ar,
            "file_name": self.file_name,
            "file_path": self.file_path,
            "file_size_kb": self.file_size_kb,
            "content_extracted": self.content_extracted,
            "last_updated": self.updated_at.strftime("%Y-%m-%d") if self.updated_at else "2026-08-24",
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else "",
        }
        if include_children:
            d["children"] = [ch.to_dict() for ch in self.child_sources or []]
        if include_extracted:
            d["extracted_text"] = self.extracted_text
        return d

    # Helper to set status with both enums and text
    def set_status(self, status: SourceStatus, ar_text: str, en_text: str):
        self.status = status
        self.status_ar = ar_text
        self.status_en = en_text

    def get_chapters_list(self):
        import json
        if not self.chapters_json:
            return []
        try:
            return json.loads(self.chapters_json)
        except Exception:
            return []
