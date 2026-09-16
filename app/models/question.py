# Question and Choice Models
import enum
import json
from typing import List, Optional
from sqlalchemy import String, Text, Integer, Enum, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

class QuestionType(str, enum.Enum):
    MCQ = "mcq"              # اختيار من متعدد
    ESSAY = "essay"          # مقالي
    TRUE_FALSE = "true_false"# صح أو خطأ

class DifficultyLevel(str, enum.Enum):
    EASY = "easy"            # سهل
    MEDIUM = "medium"        # متوسط
    HARD = "hard"            # صعب

class Question(Base, TimestampMixin):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), default=QuestionType.MCQ)
    difficulty: Mapped[DifficultyLevel] = mapped_column(Enum(DifficultyLevel), default=DifficultyLevel.MEDIUM)
    
    subject: Mapped[str] = mapped_column(String(100), default="الفيزياء")
    chapter: Mapped[str] = mapped_column(String(150), nullable=False)
    grade_level: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    branch: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lesson: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    source: Mapped[str] = mapped_column(String(150), default="كتاب الوزارة المعتمد")
    tags: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    term: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # الفصل الدراسي
    academic_year: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # السنة الدراسية
    
    # Marks / Weight
    marks: Mapped[int] = mapped_column(Integer, default=2)
    
    # Model answer for Essay or True/False explanation
    model_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_paths_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    choices: Mapped[List["QuestionChoice"]] = relationship(
        "QuestionChoice", back_populates="question", cascade="all, delete-orphan", lazy="joined"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "question_type": self.question_type.value,
            "difficulty": self.difficulty.value,
            "subject": self.subject,
            "chapter": self.chapter,
            "grade_level": self.grade_level,
            "branch": self.branch,
            "lesson": self.lesson,
            "source": self.source,
            "tags": self.tags.split(",") if self.tags else [],
            "marks": self.marks,
            "model_answer": self.model_answer,
            "image_paths": json.loads(self.image_paths_json or "[]"),
            "term": self.term,
            "academic_year": self.academic_year,
            "choices": [c.to_dict() for c in self.choices]
        }

class QuestionChoice(Base):
    __tablename__ = "question_choices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id", ondelete="CASCADE"))
    choice_code: Mapped[str] = mapped_column(String(5))  # "A", "B", "C", "D" or "أ", "ب", "ج", "د"
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    question: Mapped["Question"] = relationship("Question", back_populates="choices")

    def to_dict(self):
        return {
            "id": self.id,
            "choice_code": self.choice_code,
            "text": self.text,
            "is_correct": self.is_correct,
            "order_index": self.order_index
        }
