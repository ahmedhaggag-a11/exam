# Exam Template Model
from sqlalchemy import String, Text, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class ExamTemplate(Base, TimestampMixin):
    __tablename__ = "exam_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name_ar: Mapped[str] = mapped_column(String(100), nullable=False)
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    description_ar: Mapped[str] = mapped_column(Text, nullable=False)
    description_en: Mapped[str] = mapped_column(Text, nullable=False)
    layout_type: Mapped[str] = mapped_column(String(50), default="classic")
    badge: Mapped[str] = mapped_column(String(50), default="معتمد")
    accent_color: Mapped[str] = mapped_column(String(20), default="#2563EB")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name_ar": self.name_ar,
            "name_en": self.name_en,
            "description_ar": self.description_ar,
            "description_en": self.description_en,
            "layout_type": self.layout_type,
            "badge": self.badge,
            "accent_color": self.accent_color,
            "is_default": self.is_default,
            "is_locked": self.is_locked
        }
