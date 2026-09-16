# Exam, Multi-Model, and Association Models
import enum
import json
from typing import List, Optional
from sqlalchemy import String, Text, Integer, Enum, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

class ExamStatus(str, enum.Enum):
    READY = "ready"
    GENERATED = "generated"
    DRAFT = "draft"

class Exam(Base, TimestampMixin):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(100), default="الفيزياء")
    grade: Mapped[str] = mapped_column(String(100), default="الصف الثالث الثانوي")
    duration: Mapped[str] = mapped_column(String(50), default="90 دقيقة")
    exam_date: Mapped[str] = mapped_column(String(50), default="2026-08-30")
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="ar")

    status: Mapped[ExamStatus] = mapped_column(Enum(ExamStatus), default=ExamStatus.READY)
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    total_marks: Mapped[int] = mapped_column(Integer, default=0)
    models_count: Mapped[int] = mapped_column(Integer, default=4)
    template_name: Mapped[str] = mapped_column(String(100), default="الكلاسيكي المعتمد")
    template_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Anti-cheat & Shuffling Rules
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=True)
    shuffle_choices: Mapped[bool] = mapped_column(Boolean, default=True)
    balance_difficulty: Mapped[bool] = mapped_column(Boolean, default=True)
    balance_chapters: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    models: Mapped[List["ExamModelData"]] = relationship(
        "ExamModelData", back_populates="exam", cascade="all, delete-orphan", lazy="joined"
    )
    exam_questions: Mapped[List["ExamQuestion"]] = relationship(
        "ExamQuestion", back_populates="exam", cascade="all, delete-orphan", lazy="joined"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "subject": self.subject,
            "grade": self.grade,
            "duration": self.duration,
            "exam_date": self.exam_date,
            "instructions": self.instructions,
            "language": self.language,
            "status": self.status.value,
            "total_questions": self.total_questions,
            "total_marks": self.total_marks,
            "models_count": self.models_count,
            "template_name": self.template_name,
            "template_id": self.template_id,
            "shuffle_questions": self.shuffle_questions,
            "shuffle_choices": self.shuffle_choices,
            "models": [m.to_dict() for m in self.models],
            "questions_count": len(self.exam_questions)
        }

class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id", ondelete="CASCADE"))
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    exam: Mapped["Exam"] = relationship("Exam", back_populates="exam_questions")
    question: Mapped["Question"] = relationship("Question", lazy="joined")

class ExamModelData(Base):
    __tablename__ = "exam_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    model_code: Mapped[str] = mapped_column(String(10))  # "A", "B", "C", "D" or "نموذج أ"
    model_name_ar: Mapped[str] = mapped_column(String(50))
    questions_order_json: Mapped[str] = mapped_column(Text, default="[]")  # list of question IDs
    choices_order_json: Mapped[str] = mapped_column(Text, default="{}")    # dict {q_id: [choice_ids]}

    exam: Mapped["Exam"] = relationship("Exam", back_populates="models")

    def to_dict(self):
        return {
            "id": self.id,
            "model_code": self.model_code,
            "model_name_ar": self.model_name_ar,
            "questions_order": json.loads(self.questions_order_json or "[]"),
            "choices_order": json.loads(self.choices_order_json or "{}")
        }
