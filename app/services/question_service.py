# Question Service - Business Logic & Smart Selection Engine
import json
import re
from typing import List, Dict, Any, Optional
from sqlalchemy import or_
from app.database.connection import get_session_factory
from app.models import Question, QuestionChoice, QuestionType, DifficultyLevel

class QuestionService:
    @classmethod
    def check_duplicate(cls, text: str, threshold: float = 0.85) -> Optional[Dict[str, Any]]:
        if not text or len(text.strip()) < 5:
            return None
        session = get_session_factory()()
        try:
            from difflib import SequenceMatcher
            norm_target = re.sub(r'[^\w\s]', '', text).strip().lower()
            questions = session.query(Question).all()
            for q in questions:
                norm_q = re.sub(r'[^\w\s]', '', q.text).strip().lower()
                ratio = SequenceMatcher(None, norm_target, norm_q).ratio()
                if ratio >= threshold:
                    return q.to_dict()
            return None
        finally:
            session.close()
    @classmethod
    def get_questions(
        cls,
        search_query: Optional[str] = None,
        subject: Optional[str] = None,
        chapter: Optional[str] = None,
        question_type: Optional[str] = None,
        difficulty: Optional[str] = None,
        source: Optional[str] = None,
        term: Optional[str] = None,
        academic_year: Optional[str] = None,
        limit: int = 200
    ) -> List[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            query = session.query(Question)
            
            if search_query and search_query.strip():
                term_search = f"%{search_query.strip()}%"
                query = query.filter(
                    or_(
                        Question.text.ilike(term_search),
                        Question.tags.ilike(term_search),
                        Question.chapter.ilike(term_search)
                    )
                )
            if subject and subject != "all":
                query = query.filter(Question.subject == subject)
            if chapter and chapter != "all":
                query = query.filter(Question.chapter == chapter)
            if question_type and question_type != "all":
                query = query.filter(Question.question_type == question_type)
            if difficulty and difficulty != "all":
                query = query.filter(Question.difficulty == difficulty)
            if source and source != "all":
                query = query.filter(Question.source == source)
            if term and term != "all":
                query = query.filter(Question.term == term)
            if academic_year and academic_year != "all":
                query = query.filter(Question.academic_year == academic_year)

            questions = query.order_by(Question.id.desc()).limit(limit).all()
            return [q.to_dict() for q in questions]
        finally:
            session.close()

    @classmethod
    def get_question_by_id(cls, question_id: int) -> Optional[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            q = session.query(Question).filter(Question.id == question_id).first()
            return q.to_dict() if q else None
        finally:
            session.close()

    @classmethod
    def create_question(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        session = get_session_factory()()
        try:
            q_type = QuestionType(data.get("question_type", "mcq"))
            diff = DifficultyLevel(data.get("difficulty", "medium"))
            
            tags_str = ",".join(data["tags"]) if isinstance(data.get("tags"), list) else data.get("tags", "")

            q = Question(
                text=data["text"],
                question_type=q_type,
                difficulty=diff,
                subject=data.get("subject", "الفيزياء"),
                chapter=data.get("chapter", "الفصل الأول"),
                grade_level=data.get("grade_level"),
                branch=data.get("branch"),
                lesson=data.get("lesson"),
                source=data.get("source", "مذكرات وسلسلة الأستاذ أحمد فؤاد الشاملة"),
                tags=tags_str,
                marks=int(data.get("marks", 2)),
                model_answer=data.get("model_answer"),
                image_paths_json=json.dumps(data.get("image_paths", []), ensure_ascii=False),
                term=data.get("term"),
                academic_year=data.get("academic_year")
            )
            session.add(q)
            session.flush()

            if q_type == QuestionType.MCQ and "choices" in data:
                for idx, c in enumerate(data["choices"]):
                    choice = QuestionChoice(
                        question_id=q.id,
                        choice_code=c.get("choice_code", ["أ", "ب", "ج", "د"][idx % 4]),
                        text=c.get("text", ""),
                        is_correct=bool(c.get("is_correct", False)),
                        order_index=idx
                    )
                    session.add(choice)

            elif q_type == QuestionType.TRUE_FALSE:
                correct_is_true = data.get("correct_answer") == "true"
                session.add(QuestionChoice(question_id=q.id, choice_code="أ", text="صواب (True)", is_correct=correct_is_true, order_index=0))
                session.add(QuestionChoice(question_id=q.id, choice_code="ب", text="خطأ (False)", is_correct=not correct_is_true, order_index=1))

            session.commit()
            return q.to_dict()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def update_question(cls, question_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            q = session.query(Question).filter(Question.id == question_id).first()
            if not q:
                return None

            if "text" in data:
                q.text = data["text"]
            if "question_type" in data:
                q.question_type = QuestionType(data["question_type"])
            if "difficulty" in data:
                q.difficulty = DifficultyLevel(data["difficulty"])
            if "subject" in data:
                q.subject = data["subject"]
            if "chapter" in data:
                q.chapter = data["chapter"]
            if "grade_level" in data:
                q.grade_level = data["grade_level"]
            if "branch" in data:
                q.branch = data["branch"]
            if "lesson" in data:
                q.lesson = data["lesson"]
            if "source" in data:
                q.source = data["source"]
            if "tags" in data:
                q.tags = ",".join(data["tags"]) if isinstance(data["tags"], list) else data["tags"]
            if "marks" in data:
                q.marks = int(data["marks"])
            if "model_answer" in data:
                q.model_answer = data["model_answer"]
            if "image_paths" in data:
                q.image_paths_json = json.dumps(data["image_paths"] or [], ensure_ascii=False)
            if "term" in data:
                q.term = data["term"]
            if "academic_year" in data:
                q.academic_year = data["academic_year"]

            if "choices" in data and q.question_type == QuestionType.MCQ:
                # Clear existing choices
                session.query(QuestionChoice).filter(QuestionChoice.question_id == q.id).delete()
                for idx, c in enumerate(data["choices"]):
                    choice = QuestionChoice(
                        question_id=q.id,
                        choice_code=c.get("choice_code", ["أ", "ب", "ج", "د"][idx % 4]),
                        text=c.get("text", ""),
                        is_correct=bool(c.get("is_correct", False)),
                        order_index=idx
                    )
                    session.add(choice)

            session.commit()
            return q.to_dict()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def delete_question(cls, question_id: int) -> bool:
        session = get_session_factory()()
        try:
            q = session.query(Question).filter(Question.id == question_id).first()
            if q:
                session.delete(q)
                session.commit()
                return True
            return False
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def duplicate_question(cls, question_id: int) -> Optional[Dict[str, Any]]:
        orig = cls.get_question_by_id(question_id)
        if not orig:
            return None
        orig_copy = orig.copy()
        orig_copy["text"] = f"[نسخة] {orig_copy['text']}"
        orig_copy.pop("id", None)
        return cls.create_question(orig_copy)

    @classmethod
    def create_questions_bulk(cls, questions_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        session = get_session_factory()()
        created_ids: List[int] = []
        failed: List[Dict[str, Any]] = []
        try:
            for idx, data in enumerate(questions_data):
                try:
                    q_type = QuestionType(data.get("question_type", "mcq"))
                    diff = DifficultyLevel(data.get("difficulty", "medium"))
                    tags_raw = data.get("tags", "")
                    if isinstance(tags_raw, list):
                        tags_str = ",".join(tags_raw)
                    else:
                        tags_str = tags_raw or ""

                    q = Question(
                        text=data.get("text", "").strip(),
                        question_type=q_type,
                        difficulty=diff,
                        subject=data.get("subject", "الفيزياء"),
                        chapter=data.get("chapter", "الفصل الأول"),
                        grade_level=data.get("grade_level"),
                        branch=data.get("branch"),
                        lesson=data.get("lesson"),
                        source=data.get("source", "ملف PDF مستورد"),
                        tags=tags_str,
                        marks=int(data.get("marks", 2)),
                        model_answer=data.get("model_answer"),
                        image_paths_json=json.dumps(data.get("image_paths", []), ensure_ascii=False),
                        term=data.get("term"),
                        academic_year=data.get("academic_year")
                    )
                    if not q.text:
                        failed.append({"index": idx, "error": "نص السؤال فارغ", "data": data})
                        continue
                    session.add(q)
                    session.flush()

                    if q_type == QuestionType.MCQ:
                        choices = data.get("choices", [])
                        if not choices:
                            for ci, cc in enumerate(["أ", "ب", "ج", "د"]):
                                session.add(QuestionChoice(
                                    question_id=q.id,
                                    choice_code=cc,
                                    text=f"خيار ({cc})",
                                    is_correct=(ci == 0),
                                    order_index=ci
                                ))
                        else:
                            for ci, c in enumerate(choices):
                                choice = QuestionChoice(
                                    question_id=q.id,
                                    choice_code=c.get("choice_code", ["أ", "ب", "ج", "د"][ci % 4]),
                                    text=c.get("text", f"خيار {ci+1}") or f"خيار {ci+1}",
                                    is_correct=bool(c.get("is_correct", False)),
                                    order_index=ci
                                )
                                session.add(choice)

                    elif q_type == QuestionType.TRUE_FALSE:
                        correct_is_true = str(data.get("correct_answer", "")).lower() == "true"
                        session.add(QuestionChoice(question_id=q.id, choice_code="أ", text="صواب (True)", is_correct=correct_is_true, order_index=0))
                        session.add(QuestionChoice(question_id=q.id, choice_code="ب", text="خطأ (False)", is_correct=not correct_is_true, order_index=1))

                    created_ids.append(q.id)
                except Exception as e:
                    failed.append({"index": idx, "error": str(e), "data": data})

            session.commit()
            return {"created_count": len(created_ids), "failed_count": len(failed), "failed": failed, "created_ids": created_ids}
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def get_distinct_chapters(cls) -> List[str]:
        session = get_session_factory()()
        try:
            rows = session.query(Question.chapter).distinct().all()
            return [r[0] for r in rows if r[0]]
        finally:
            session.close()

    @classmethod
    def get_distinct_sources(cls) -> List[str]:
        session = get_session_factory()()
        try:
            rows = session.query(Question.source).distinct().all()
            return [r[0] for r in rows if r[0]]
        finally:
            session.close()

    @classmethod
    def get_questions_stats(cls) -> Dict[str, Any]:
        session = get_session_factory()()
        try:
            total = session.query(Question).count()
            easy = session.query(Question).filter(Question.difficulty == DifficultyLevel.EASY).count()
            med = session.query(Question).filter(Question.difficulty == DifficultyLevel.MEDIUM).count()
            hard = session.query(Question).filter(Question.difficulty == DifficultyLevel.HARD).count()

            mcq = session.query(Question).filter(Question.question_type == QuestionType.MCQ).count()
            essay = session.query(Question).filter(Question.question_type == QuestionType.ESSAY).count()
            tf = session.query(Question).filter(Question.question_type == QuestionType.TRUE_FALSE).count()

            chapters_count = {}
            for ch in cls.get_distinct_chapters():
                chapters_count[ch] = session.query(Question).filter(Question.chapter == ch).count()

            return {
                "total": total,
                "difficulty": {"easy": easy, "medium": med, "hard": hard},
                "types": {"mcq": mcq, "essay": essay, "true_false": tf},
                "chapters": chapters_count
            }
        finally:
            session.close()

    @classmethod
    def auto_select_questions(
        cls,
        target_count: int,
        type_quotas: Dict[str, int],
        diff_quotas: Dict[str, int],
        selected_chapters: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Smart question selection engine that satisfies type quotas, difficulty distribution,
        and chapter constraints.
        """
        session = get_session_factory()()
        try:
            query = session.query(Question)
            if selected_chapters:
                query = query.filter(Question.chapter.in_(selected_chapters))
            
            pool = query.all()
            if not pool:
                return []

            selected = []
            selected_ids = set()

            # Group pool by type and difficulty
            pool_by_type = {}
            for q in pool:
                pool_by_type.setdefault(q.question_type.value, []).append(q)

            # First pass: try to satisfy type quotas exactly
            for q_type, t_count in type_quotas.items():
                if t_count <= 0:
                    continue
                type_candidates = [q for q in pool if q.question_type.value == q_type and q.id not in selected_ids]
                random.shuffle(type_candidates)
                
                # Pick exactly t_count if available
                available = min(t_count, len(type_candidates))
                picked = type_candidates[:available]
                for p in picked:
                    selected.append(p)
                    selected_ids.add(p.id)

            # Second pass: if we haven't reached target_count, fill from remaining regardless of type
            if len(selected) < target_count:
                remaining = [q for q in pool if q.id not in selected_ids]
                random.shuffle(remaining)
                needed = target_count - len(selected)
                selected.extend(remaining[:needed])

            # Third pass: if we still don't have enough, expand pool beyond chapter constraints
            if len(selected) < target_count:
                expanded_query = session.query(Question)
                expanded_pool = expanded_query.all()
                expanded_remaining = [q for q in expanded_pool if q.id not in selected_ids]
                random.shuffle(expanded_remaining)
                additional_needed = target_count - len(selected)
                selected.extend(expanded_remaining[:additional_needed])

            return [q.to_dict() for q in selected[:target_count]]
        finally:
            session.close()
