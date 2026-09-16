import re
from typing import List, Dict, Any, Optional, Tuple

class SmartNLPParser:
    """Language-Agnostic Multi-Subject Structural NLP Parser.

    Handles French, Arabic, English, Science, and Math documents using spatial
    and syntactical paragraph analysis without relying on rigid language-specific regexes.
    """

    FRENCH_CHOICE_PATTERNS = [
        r'(?:^|\s+)[\(\[\{]?\s*([a-dA-D1-4])\s*[\)\]\}]?\s*[\.\:\–\-]\s+',
        r'^\s*([a-dA-D])\s*[\)\.\-]\s+',
    ]

    ARABIC_CHOICE_PATTERNS = [
        r'(?:^|\s+)[\(\[\{]?\s*([أبجد])\s*[\)\]\}]?\s*[\.\:\–\-]\s+',
        r'^\s*([أبجد])\s*[\)\.\-]\s+',
    ]

    TRUE_FALSE_KEYWORDS = {
        "french": ["vrai", "faux", "vrai/faux", "vrai ou faux"],
        "arabic": ["صح", "خطأ", "صواب", "خطأ", "صح/خطأ", "صواب/خطأ"],
        "english": ["true", "false", "true/false"]
    }

    FRENCH_QUESTION_MARKERS = [
        r'^\s*(?:Exercice|Question|Consigne|Complétez|Choisissez|Associez|Lisez|Répondez)\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[:\.\-–]?\s*',
        r'^\s*Q(?:uestion)?\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[:\.\-–]?\s*',
        r'^\s*(\d{1,3})\s*[\.\)\:\-–]\s+(?=[A-ZÀ-ÿ\w])',
    ]

    ARABIC_QUESTION_MARKERS = [
        r'^\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–/]\s*',
        r'^\s*س\s*(?:/\s*)?[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',
        r'^\s*(?:السؤال|سؤال|مسألة|المسألة|اختبر\s+نفسك|فكرة|تمرين|مثال|تطبيق)\s*(?:رقم)?\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',
    ]

    @classmethod
    def parse_text(
        cls,
        raw_text: str,
        subject: str = "عام",
        chapter: str = "الفصل الأول",
        source: str = "مصدر مستورد"
    ) -> List[Dict[str, Any]]:
        if not raw_text or not raw_text.strip():
            return []

        lines = raw_text.splitlines()
        questions: List[Dict[str, Any]] = []

        current_q_num: Optional[int] = None
        current_text_parts: List[str] = []
        current_choices: List[Dict[str, Any]] = []
        current_images: List[str] = []

        def flush():
            nonlocal current_q_num, current_text_parts, current_choices, current_images
            if not current_text_parts and not current_choices and not current_images:
                return
            
            full_text = " ".join(p.strip() for p in current_text_parts if p.strip()).strip()
            if not full_text and not current_choices and not current_images:
                return
            if full_text and not any(c in full_text for c in 'ابتثجحخدذرزسشصضطظعغفقكلمنهويabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'):
                return

            # Classify question type
            lowered = full_text.lower()
            q_type = "essay"
            if current_choices:
                if len(current_choices) >= 2:
                    q_type = "mcq"
            elif any(tf in lowered for tf_list in cls.TRUE_FALSE_KEYWORDS.values() for tf in tf_list):
                q_type = "true_false"
                current_choices = [
                    {"choice_code": "a", "text": "Vrai / صواب", "is_correct": False, "order_index": 0},
                    {"choice_code": "b", "text": "Faux / خطأ", "is_correct": False, "order_index": 1}
                ]

            q_num = current_q_num or (len(questions) + 1)
            q: Dict[str, Any] = {
                "question_number": q_num,
                "text": full_text or f"Exercice / سؤال رقم {q_num}",
                "question_type": q_type,
                "difficulty": cls._estimate_difficulty(full_text),
                "subject": subject,
                "chapter": chapter,
                "source": source,
                "choices": current_choices,
                "model_answer": None,
                "image_paths": list(current_images)
            }
            q = cls.normalize_question_item(q)
            questions.append(q)

            current_q_num = None
            current_text_parts = []
            current_choices = []
            current_images = []

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Skip Telegram / PDF watermark overlay noise
            if re.search(r'(?:SearchTelegram|margeleTnihcraeS|A7M_S3H4|4H3S_M7A|t\.me/|@[A-Za-z0-9_\-]+)', stripped, re.IGNORECASE):
                continue
            if len(stripped) > 10 and not any(c in stripped for c in 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي') and re.match(r'^[A-Za-z0-9_@\-\.]+$', stripped):
                continue

            # Skip common document header/title and instruction line noise
            if re.match(r'^\s*(?:Lycée|Examen|Ministry|Section|Part|الوحدة|الباب|الفصل|اختبار|امتحان|وزارة|Unité)\b.*$', stripped, re.IGNORECASE) and not re.match(r'^\s*(?:Exercice\s+\d+\s*[\.\:\-]|Question\s+\d+|س1|Q1|\d+[\.\)\:-])', stripped, re.IGNORECASE):
                continue

            if re.match(r'^\s*(?:Exercice\s+\d+\.\s*Choisissez|Choisissez\s+la\s+bonne|Complétez\s+les\s+phrases|Répondez\s+aux\s+questions|أجب\s+عن\s+الأسئلة)\b.*$', stripped, re.IGNORECASE):
                continue

            # Check image markers
            img_match = re.match(r"^\s*\[\[EF_IMAGE:(.+)\]\]\s*$", stripped)
            if img_match:
                if current_choices:
                    flush()
                current_images.append(img_match.group(1).strip())
                continue

            # Check question markers (French & Arabic & Numeric)
            q_num = cls._match_question_header(stripped)
            if q_num is not None:
                flush()
                q_num_val, rest = q_num
                current_q_num = q_num_val
                if rest:
                    current_text_parts = [rest]
                continue

            # Check choices
            extracted_choices, pre_text = cls._extract_line_choices(stripped)
            if extracted_choices:
                if current_q_num is None and not current_text_parts:
                    current_q_num = len(questions) + 1

                if pre_text:
                    if current_choices:
                        last = current_choices[-1]
                        last["text"] = (last["text"] + " " + pre_text).strip()
                    else:
                        current_text_parts.append(pre_text)

                for code, c_text in extracted_choices:
                    c_order = len(current_choices)
                    current_choices.append({
                        "choice_code": code,
                        "text": c_text,
                        "is_correct": False,
                        "order_index": c_order
                    })
                continue

            # Regular text line
            if current_choices:
                flush()
                current_q_num = len(questions) + 1
                current_text_parts = [stripped]
            else:
                if current_q_num is None and not current_text_parts:
                    current_q_num = len(questions) + 1
                current_text_parts.append(stripped)

        flush()
        return questions

    @classmethod
    def normalize_question_item(cls, q: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize extracted question item, auto-detecting symbol choices, inline letter options, and True/False types."""
        if not q or not isinstance(q, dict):
            return q

        text = (q.get("text", "") or "").replace('\xa0', ' ').strip()
        choices = q.get("choices") or []
        q_type = q.get("question_type", "essay")

        # 1. Detect True/False indicators if choices not explicitly populated
        lowered = text.lower()
        tf_indicators = ["vrai/faux", "vrai ou faux", "répondez par vrai", "صح أم خطأ", "صح/خطأ", "صواب/خطأ", "true/false", "true or false"]
        if any(ind in lowered for ind in tf_indicators):
            q["question_type"] = "true_false"
            if not choices:
                is_fr = any(w in lowered for w in ["vrai", "faux", "répondez"])
                if is_fr:
                    q["choices"] = [
                        {"choice_code": "a", "text": "Vrai", "is_correct": False, "order_index": 0},
                        {"choice_code": "b", "text": "Faux", "is_correct": False, "order_index": 1}
                    ]
                else:
                    q["choices"] = [
                        {"choice_code": "أ", "text": "صواب (True)", "is_correct": False, "order_index": 0},
                        {"choice_code": "ب", "text": "خطأ (False)", "is_correct": False, "order_index": 1}
                    ]
            return q

        # 2. Extract choices from Inline Choice Symbols (☐, ☑, ☒, ⚪, ◯, 🔘, ⏺, ▫, ▪, ◆, ◇, ●, ○, •, [ ], ( ))
        symbol_pat = r'(?:[☐☑☒⚪◯🔘⏺▫▪◆◇●○•\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF]|\[\s*\]|\(\s*\))'
        if re.search(symbol_pat, text):
            parts = re.split(symbol_pat, text)
            parts = [p.strip() for p in parts if p.strip()]
            if len(parts) >= 2:
                stem = parts[0]
                extracted_choices = []
                codes = ["a", "b", "c", "d", "e", "f"] if any(c in text for c in 'abcdefghijklmnopqrstuvwxyz') else ["أ", "ب", "ج", "د", "هـ", "و"]
                for idx, opt in enumerate(parts[1:]):
                    code = codes[idx] if idx < len(codes) else str(idx + 1)
                    extracted_choices.append({
                        "choice_code": code,
                        "text": opt,
                        "is_correct": False,
                        "order_index": idx
                    })
                q["text"] = stem
                q["choices"] = extracted_choices
                q["question_type"] = "mcq"
                q["needs_review"] = False
                return q

        # 3. Extract choices from Inline Code Markers (e.g. a) option1 b) option2 or A) ... B) ...)
        inline_pat = r'(?:^|\s+)(?:[\(\[\{]?\s*([a-dA-Dأبجد1-4])\s*[\)\]\}]?\s*[\.\:\–\-]\s+|\(([a-dA-Dأبجد1-4])\)\s*)'
        matches = list(re.finditer(inline_pat, text))
        if len(matches) >= 2:
            stem = text[:matches[0].start()].strip()
            extracted_choices = []
            for i in range(len(matches)):
                start_pos = matches[i].end()
                end_pos = matches[i+1].start() if i + 1 < len(matches) else len(text)
                opt_text = text[start_pos:end_pos].strip()
                code = matches[i].group(1) or matches[i].group(2) or str(i + 1)
                extracted_choices.append({
                    "choice_code": code,
                    "text": opt_text,
                    "is_correct": False,
                    "order_index": i
                })
            if stem and len(extracted_choices) >= 2:
                q["text"] = stem
                q["choices"] = extracted_choices
                q["question_type"] = "mcq"
                q["needs_review"] = False
                return q

        # 4. Enforce MCQ if choices array is populated
        if len(q.get("choices", [])) >= 2:
            q["question_type"] = "mcq"
        elif q_type == "mcq" and len(q.get("choices", [])) < 2:
            q["needs_review"] = True

        return q

    @classmethod
    def _match_question_header(cls, line: str) -> Optional[Tuple[int, str]]:
        all_markers = cls.FRENCH_QUESTION_MARKERS + cls.ARABIC_QUESTION_MARKERS
        for pat in all_markers:
            m = re.match(pat, line, re.IGNORECASE)
            if m:
                try:
                    num = int(m.group(1))
                    rest = line[m.end():].strip()
                    return num, rest
                except (ValueError, IndexError):
                    pass
        return None

    @classmethod
    def _extract_line_choices(cls, line: str) -> Tuple[List[Tuple[str, str]], str]:
        all_codes = ["أ", "ب", "ج", "د", "A", "B", "C", "D", "a", "b", "c", "d", "1", "2", "3", "4"]
        codes_pattern = "|".join(re.escape(c) for c in all_codes)
        pattern = r'(?:^|\s+)[\(\[\{]?\s*(' + codes_pattern + r')\s*[\)\]\}]?\s*[\.\)\:\-–]\s+'

        parts = re.split(pattern, line)
        if len(parts) <= 1:
            return [], line

        pre_text = parts[0].strip()
        choices = []
        for i in range(1, len(parts), 2):
            code = parts[i]
            c_text = parts[i + 1].strip()
            choices.append((code, c_text))

        return choices, pre_text

    @classmethod
    def _estimate_difficulty(cls, text: str) -> str:
        lowered = text.lower()
        hard_terms = ["déduire", "démontrer", "justifier", "analyser", "احسب", "استنتج", "اثبت", "برهن", "prove", "derive"]
        easy_terms = ["souligner", "cocher", "اذكر", "عرّف", "صح", "خطأ", "vrai", "faux", "find", "define"]
        if any(w in lowered for w in hard_terms):
            return "hard"
        if any(w in lowered for w in easy_terms):
            return "easy"
        return "medium"
