# Exam Service - Multi-Model Shuffling & Exam Lifecycle Management
import json
import re
import random
from typing import List, Dict, Any, Optional
from sqlalchemy import or_
from app.database.connection import get_session_factory
from app.models import Exam, ExamModelData, ExamQuestion, ExamStatus, Question


def detect_language_auto(text_samples: List[str]) -> str:
    """Auto-detect if text is Arabic (RTL) or English (LTR) based on character analysis"""
    if not text_samples:
        return "ar"
    combined = " ".join(str(t) for t in text_samples if t)
    if not combined.strip():
        return "ar"
    ar_chars = len(re.findall(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', combined))
    en_chars = len(re.findall(r'[a-zA-Z]', combined))
    if ar_chars > en_chars:
        return "ar"
    if en_chars > ar_chars:
        return "en"
    return "ar"

class ExamService:
    @classmethod
    def get_exams(
        cls,
        search_query: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            query = session.query(Exam)
            if search_query and search_query.strip():
                term = f"%{search_query.strip()}%"
                query = query.filter(or_(Exam.name.ilike(term), Exam.subject.ilike(term)))
            if status_filter and status_filter != "all":
                query = query.filter(Exam.status == status_filter)

            exams = query.order_by(Exam.id.desc()).limit(limit).all()
            return [e.to_dict() for e in exams]
        finally:
            session.close()

    @classmethod
    def get_exam_by_id(cls, exam_id: int) -> Optional[Dict[str, Any]]:
        session = get_session_factory()()
        try:
            exam = session.query(Exam).filter(Exam.id == exam_id).first()
            if not exam:
                return None
            
            data = exam.to_dict()
            # Fetch ordered questions
            eq_list = session.query(ExamQuestion).filter(ExamQuestion.exam_id == exam.id).order_by(ExamQuestion.order_index).all()
            questions = []
            for eq in eq_list:
                if eq.question:
                    q_dict = eq.question.to_dict()
                    q_dict["exam_order_index"] = eq.order_index
                    questions.append(q_dict)
            
            data["questions"] = questions
            return data
        finally:
            session.close()

    @classmethod
    def create_exam_with_models(
        cls,
        exam_data: Dict[str, Any],
        question_ids: List[int],
        models_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        session = get_session_factory()()
        try:
            cfg = models_config or {}
            models_count = int(cfg.get("models_count", 4))
            shuffle_q = bool(cfg.get("shuffle_questions", True))
            shuffle_c = bool(cfg.get("shuffle_choices", True))
            balance_d = bool(cfg.get("balance_difficulty", True))
            balance_ch = bool(cfg.get("balance_chapters", True))

            # Calculate total marks from selected questions
            questions = session.query(Question).filter(Question.id.in_(question_ids)).all()
            total_marks = sum(q.marks for q in questions) if questions else len(question_ids) * 2

            # Resolve language: explicit > auto-detect from content
            explicit_lang = exam_data.get("language")
            if explicit_lang in ("ar", "en"):
                exam_lang = explicit_lang
            else:
                samples = [
                    exam_data.get("name", ""),
                    exam_data.get("subject", ""),
                    exam_data.get("instructions", ""),
                ] + [q.text for q in questions]
                exam_lang = detect_language_auto(samples)

            # Resolve template: prefer template_id, fallback to template_name lookup
            tpl_id = exam_data.get("template_id")
            tpl_name = exam_data.get("template_name", "الكلاسيكي المعتمد (Standard Ministry)")
            try:
                from app.models import ExamTemplate
                if tpl_id:
                    tpl_row = session.query(ExamTemplate).filter(ExamTemplate.id == int(tpl_id)).first()
                    if tpl_row:
                        tpl_name = tpl_row.name_ar
                if not tpl_id and tpl_name:
                    tpl_row = session.query(ExamTemplate).filter(ExamTemplate.name_ar == tpl_name).first()
                    if tpl_row:
                        tpl_id = tpl_row.id
            except Exception:
                pass

            exam = Exam(
                name=exam_data.get("name", "اختبار فيزياء مخصص"),
                subject=exam_data.get("subject", "الفيزياء"),
                grade=exam_data.get("grade", "الصف الثالث الثانوي"),
                duration=exam_data.get("duration", "90 دقيقة"),
                exam_date=exam_data.get("exam_date", "2026-08-30"),
                instructions=exam_data.get("instructions", ""),
                language=exam_lang,
                status=ExamStatus.READY,
                total_questions=len(question_ids),
                total_marks=total_marks,
                models_count=models_count,
                template_name=tpl_name,
                template_id=tpl_id,
                shuffle_questions=shuffle_q,
                shuffle_choices=shuffle_c,
                balance_difficulty=balance_d,
                balance_chapters=balance_ch
            )
            session.add(exam)
            session.flush()

            # Add question associations
            for idx, q_id in enumerate(question_ids):
                eq = ExamQuestion(exam_id=exam.id, question_id=q_id, order_index=idx)
                session.add(eq)

            # Generate multiple models (A, B, C, D / نموذج أ، ب، ج، د)
            model_defs = [
                ("A", "النموذج (أ) - Model A"),
                ("B", "النموذج (ب) - Model B"),
                ("C", "النموذج (ج) - Model C"),
                ("D", "النموذج (د) - Model D"),
            ]

            for m_idx in range(min(models_count, len(model_defs))):
                code, name_ar = model_defs[m_idx]
                
                # Question ordering
                if m_idx == 0 or not shuffle_q:
                    ordered_ids = list(question_ids)
                else:
                    # Deterministic or controlled shuffle
                    ordered_ids = list(question_ids)
                    random.seed(exam.id * 100 + m_idx)
                    random.shuffle(ordered_ids)

                # Choice ordering dict {q_id: [choice_indices]}
                choices_map = {}
                if shuffle_c:
                    for q in questions:
                        if q.choices:
                            c_indices = list(range(len(q.choices)))
                            random.seed(exam.id * 50 + m_idx + q.id)
                            random.shuffle(c_indices)
                            choices_map[str(q.id)] = c_indices

                model = ExamModelData(
                    exam_id=exam.id,
                    model_code=code,
                    model_name_ar=name_ar,
                    questions_order_json=json.dumps(ordered_ids),
                    choices_order_json=json.dumps(choices_map)
                )
                session.add(model)

            session.commit()
            return exam.to_dict()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def save_draft(
        cls,
        exam_data: Dict[str, Any],
        question_ids: List[int],
        models_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        session = get_session_factory()()
        try:
            cfg = models_config or {}
            questions = session.query(Question).filter(Question.id.in_(question_ids)).all()
            total_marks = sum(q.marks for q in questions) if questions else len(question_ids) * 2

            # Resolve language
            explicit_lang = exam_data.get("language")
            if explicit_lang in ("ar", "en"):
                exam_lang = explicit_lang
            else:
                samples = [
                    exam_data.get("name", ""),
                    exam_data.get("subject", ""),
                    exam_data.get("instructions", ""),
                ] + [q.text for q in questions]
                exam_lang = detect_language_auto(samples)

            # Resolve template
            tpl_id = exam_data.get("template_id")
            tpl_name = exam_data.get("template_name", "الكلاسيكي المعتمد (Standard Ministry)")
            try:
                from app.models import ExamTemplate
                if tpl_id:
                    tpl_row = session.query(ExamTemplate).filter(ExamTemplate.id == int(tpl_id)).first()
                    if tpl_row:
                        tpl_name = tpl_row.name_ar
                if not tpl_id and tpl_name:
                    tpl_row = session.query(ExamTemplate).filter(ExamTemplate.name_ar == tpl_name).first()
                    if tpl_row:
                        tpl_id = tpl_row.id
            except Exception:
                pass

            draft = Exam(
                name=exam_data.get("name", "مسودة اختبار فيزياء"),
                subject=exam_data.get("subject", "الفيزياء"),
                grade=exam_data.get("grade", "الصف الثالث الثانوي"),
                duration=exam_data.get("duration", "90 دقيقة"),
                exam_date=exam_data.get("exam_date", "2026-08-30"),
                instructions=exam_data.get("instructions", ""),
                language=exam_lang,
                status=ExamStatus.DRAFT,
                total_questions=len(question_ids) if question_ids else 0,
                total_marks=total_marks,
                models_count=int(cfg.get("models_count", 4)),
                template_name=tpl_name,
                template_id=tpl_id,
                shuffle_questions=bool(cfg.get("shuffle_questions", True)),
                shuffle_choices=bool(cfg.get("shuffle_choices", True)),
                balance_difficulty=bool(cfg.get("balance_difficulty", True)),
                balance_chapters=bool(cfg.get("balance_chapters", True))
            )
            session.add(draft)
            session.flush()

            # Only add question associations if we have question IDs
            if question_ids:
                for idx, question_id in enumerate(question_ids):
                    session.add(ExamQuestion(exam_id=draft.id, question_id=question_id, order_index=idx))

            session.commit()
            return draft.to_dict()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def delete_exam(cls, exam_id: int) -> bool:
        session = get_session_factory()()
        try:
            exam = session.query(Exam).filter(Exam.id == exam_id).first()
            if exam:
                session.delete(exam)
                session.commit()
                return True
            return False
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def duplicate_exam(cls, exam_id: int) -> Optional[Dict[str, Any]]:
        orig = cls.get_exam_by_id(exam_id)
        if not orig:
            return None
        orig_copy = orig.copy()
        orig_copy["name"] = f"[نسخة] {orig_copy['name']}"
        q_ids = [q["id"] for q in orig.get("questions", [])]
        return cls.create_exam_with_models(
            orig_copy,
            q_ids,
            {
                "models_count": orig.get("models_count", 4),
                "shuffle_questions": orig.get("shuffle_questions", True),
                "shuffle_choices": orig.get("shuffle_choices", True)
            }
        )

    @classmethod
    def get_exam_stats(cls) -> Dict[str, Any]:
        session = get_session_factory()()
        try:
            total_exams = session.query(Exam).count()
            total_models = session.query(ExamModelData).count()
            recent_exams = session.query(Exam).order_by(Exam.id.desc()).limit(5).all()

            return {
                "total_exams": total_exams,
                "total_models": total_models,
                "recent": [e.to_dict() for e in recent_exams]
            }
        finally:
            session.close()

    @classmethod
    def preview_models(cls, question_ids: List[int], models_count: int = 4, shuffle_q: bool = True) -> List[Dict[str, Any]]:
        """Generate in-memory preview of how models will be structured"""
        session = get_session_factory()()
        try:
            questions = session.query(Question).filter(Question.id.in_(question_ids)).all()
            q_map = {q.id: q.text[:45] + "..." if len(q.text) > 45 else q.text for q in questions}

            model_labels = ["النموذج (أ)", "النموذج (ب)", "النموذج (ج)", "النموذج (د)"]
            previews = []

            for i in range(min(models_count, 4)):
                if i == 0 or not shuffle_q:
                    m_order = list(question_ids)
                else:
                    m_order = list(question_ids)
                    random.seed(99 + i)
                    random.shuffle(m_order)

                previews.append({
                    "model_code": chr(65 + i),
                    "model_name": model_labels[i],
                    "question_count": len(m_order),
                    "sample_sequence": [q_map.get(qid, f"سؤال #{qid}") for qid in m_order[:4]]
                })
            return previews
        finally:
            session.close()

    @classmethod
    def get_model_question_order(
        cls,
        exam_id: Optional[int] = None,
        question_ids: Optional[List[int]] = None,
        models_count: int = 4,
        shuffle_q: bool = True,
        shuffle_c: bool = True
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Return {A:[q_dicts,...], B:[...], ...} — either reloaded from DB by exam_id
        or regenerated deterministically from question_ids (matches create_exam_with_models)."""
        import json as _json
        from app.database.connection import get_session_factory as _gsf
        from app.models import Exam as _Exam, ExamQuestion as _EQ, ExamModelData as _EMD

        result: Dict[str, List[Dict[str, Any]]] = {}
        sess = _gsf()()
        try:
            per_model_orders: Dict[str, List[int]] = {}
            if exam_id:
                exam_row = sess.query(_Exam).filter(_Exam.id == exam_id).first()
                if exam_row:
                    md_rows = sess.query(_EMD).filter(_EMD.exam_id == exam_id).order_by(_EMD.id.asc()).all()
                    for md in md_rows:
                        try:
                            order_ids = _json.loads(md.questions_order_json or "[]")
                        except Exception:
                            order_ids = []
                        per_model_orders[md.model_code] = [int(x) for x in order_ids]
            if not per_model_orders and question_ids:
                labels = ["A", "B", "C", "D"]
                for i in range(min(models_count, 4)):
                    code = labels[i]
                    if i == 0 or not shuffle_q:
                        order_ids = list(question_ids)
                    else:
                        order_ids = list(question_ids)
                        random.seed(int(exam_id or 1) * 100 + i)
                        random.shuffle(order_ids)
                    per_model_orders[code] = order_ids

            ids_set = set()
            for orders in per_model_orders.values():
                ids_set.update(orders)
            if question_ids:
                ids_set.update(question_ids)

            if ids_set:
                q_rows = sess.query(Question).filter(Question.id.in_(list(ids_set))).all()
            else:
                q_rows = []
            q_by_id = {q.id: q for q in q_rows}

            for code, order_ids in per_model_orders.items():
                out: List[Dict[str, Any]] = []
                for qid in order_ids:
                    q = q_by_id.get(qid)
                    if q:
                        out.append(q.to_dict())
                result[code] = out
            return result
        finally:
            sess.close()

    @classmethod
    def get_model_answer_keys(cls, exam_id: int) -> Dict[str, List[Dict[str, Any]]]:
        """Build answer keys using each saved model's question and choice order."""
        import json as _json
        session = get_session_factory()()
        try:
            models = session.query(ExamModelData).filter(
                ExamModelData.exam_id == exam_id
            ).order_by(ExamModelData.id.asc()).all()
            exam_questions = session.query(ExamQuestion).filter(
                ExamQuestion.exam_id == exam_id
            ).all()
            questions = {eq.question_id: eq.question for eq in exam_questions if eq.question}
            answer_keys: Dict[str, List[Dict[str, Any]]] = {}

            for model in models:
                try:
                    question_order = [int(qid) for qid in _json.loads(model.questions_order_json or "[]")]
                except Exception:
                    question_order = []
                try:
                    choices_order = _json.loads(model.choices_order_json or "{}")
                except Exception:
                    choices_order = {}

                model_answers = []
                for number, question_id in enumerate(question_order, start=1):
                    question = questions.get(question_id)
                    if not question:
                        continue
                    item: Dict[str, Any] = {
                        "number": number,
                        "question_type": question.question_type.value,
                        "answer": "",
                        "answer_text": "",
                        "model_answer": question.model_answer or "",
                    }
                    if question.question_type.value == "mcq":
                        original_choices = list(question.choices or [])
                        order = choices_order.get(str(question_id), list(range(len(original_choices))))
                        ordered_choices = [original_choices[i] for i in order if i < len(original_choices)]
                        correct = next((choice for choice in original_choices if choice.is_correct), None)
                        if correct:
                            item["answer_text"] = correct.text
                            correct_pos = next((pos for pos, c in enumerate(ordered_choices) if c.id == correct.id), -1)
                            if correct_pos != -1:
                                arabic_codes = ["أ", "ب", "ج", "د", "هـ"]
                                item["answer"] = arabic_codes[correct_pos] if correct_pos < len(arabic_codes) else str(correct_pos + 1)
                            else:
                                item["answer"] = correct.choice_code
                    elif question.question_type.value == "true_false":
                        correct = next((choice for choice in question.choices or [] if choice.is_correct), None)
                        item["answer"] = correct.choice_code if correct else ""
                        item["answer_text"] = correct.text if correct else ""
                    model_answers.append(item)
                answer_keys[model.model_code] = model_answers
            return answer_keys
        finally:
            session.close()
