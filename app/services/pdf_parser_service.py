import re
import os
import uuid
import unicodedata
from typing import List, Dict, Any, Optional, Tuple

try:
    from bidi.algorithm import get_display
    HAS_BIDI = True
except ImportError:
    HAS_BIDI = False


try:
    import PyPDF2
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False


class PDFParserService:
    ARABIC_CHOICE_CODES = ["أ", "ب", "ج", "د", "هـ", "و"]
    ENGLISH_CHOICE_CODES = ["A", "B", "C", "D", "E", "F"]

    QUESTION_NUMBER_PATTERNS = [
        r'^\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–/]\s*',  # 1. or 1) or (1) or 1- or 1/
        r'^\s*س\s*(?:/\s*)?[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',  # س1 or س 1: or س(1) or س/1
        r'^\s*(?:السؤال|سؤال)\s*(?:رقم)?\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',  # سؤال 1 or السؤال (1) or سؤال رقم 1
        r'^\s*مسألة\s*(?:رقم)?\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',  # مسألة (1) or مسألة 1: or مسألة رقم 1
        r'^\s*المسألة\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',  # المسألة (1)
        r'^\s*اختبر\s+نفسك\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',  # اختبر نفسك (1)
        r'^\s*Q(?:uestion)?\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',  # Q1 or Question 1
        r'^\s*(?:Ex(?:ercise)?|Problem|مثال|تمرين|فكرة|تدريب|تطبيق)\s*[\(\[\{]?\s*(\d{1,3})\s*[\)\]\}]?\s*[\.\):\-–]?\s*',  # Ex 1 or Problem 1
    ]

    TRUE_FALSE_PATTERNS = [
        r'(صح|خطأ|True|False|صواب)',
        r'\(\s*(ص|خ)\s*\)',
    ]

    SECTION_HEADER_PATTERNS = [
        r'^\s*(?:أولاً|ثانياً|ثالثاً|رابعاً|خامساً|قسم|Section|Part|الوحدة|الباب|الفصل|الدرس)\s*[:：\-–]?\s*(?:الأسئلة|الفيزياء|الكيمياء|الأحياء|الرياضيات|التاريخ|الجغرافيا|الفلسفة|علم النفس|الجيولوجيا|اللغة العربية|اللغة الإنجليزية|الموضوعية|المقالية|اختيار|أجب|الأول|الثاني|الثالث|الرابع|الخامس|السادس)?.*$',
        r'^\s*(?:تعليمات|ملاحظات هامة|تنبيه|إرشادات|Instructions|Notice|General Instructions)\s*[:：\-–]?\s*.*$',
        r'^\s*أجب عن (?:جميع )?الأسئلة (?:الآتية|التالية)\b.*$',
        r'^\s*(?:وزارة التربية والتعليم|الجمهورية|الصف الثالث الثانوي|إدارة التقييم|المركز القومي|Ministry of Education|اختبار مادة|امتحان مادة|ExamForge)\b.*$',
        r'^\s*(?:صفحة|الصفحة|Page)\s*[\(\[\{]?\s*\d+\s*(?:من|of)?\s*\d*.*$',
    ]

    @classmethod
    def _convert_eastern_arabic_digits(cls, text: str) -> str:
        if not text:
            return text
        trans = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
        return text.translate(trans)

    @classmethod
    def _is_header_or_noise_line(cls, line: str) -> Tuple[bool, Optional[str]]:
        stripped = line.strip()
        if not stripped:
            return False, None
        
        # Check if line indicates chapter title (e.g. الفصل الأول: التيار الكهربي)
        ch_match = re.search(r'(الفصل\s+الأول|الفصل\s+الثاني|الفصل\s+الثالث|الفصل\s+الرابع|الفصل\s+الخامس|الباب\s+\d+)', stripped)
        ch_found = ch_match.group(1) if ch_match else None

        for pat in cls.SECTION_HEADER_PATTERNS:
            if re.match(pat, stripped, re.IGNORECASE):
                return True, ch_found

        return False, ch_found

    WORD_FIXES = {
        'الصفل': 'الفصل',
        'اخطبار': 'اختبار',
        'موأ': 'أوم',
        'لللضف': 'بمقدار',
        'لللصف': 'بمقدار',
        'ترداد': 'تزداد',
        'مقاوته': 'مقاومته',
    }

    @classmethod
    def _reverse_token(cls, tok: str) -> str:
        trans = str.maketrans('()[]{}<>', ')(][}{><')
        if re.search(r'[\u0600-\u06FF]', tok) or any(c in tok for c in '()[]{}<>'):
            return tok[::-1].translate(trans)
        return tok

    WATERMARK_PATTERNS = [
        r'(?:https?://)?(?:t|telegram)\.me/\S+',
        r'@[A-Za-z0-9_\-]+',
        r'\b(?:SearchTelegram|margeleTnihcraeS|A7M_S3H4|4H3S_M7A)\b',
        r'^\s*[A-Za-z0-9_@\-\.]{12,}\s*$',
    ]

    @classmethod
    def clean_watermarks(cls, text: str) -> str:
        if not text:
            return text
        text = re.sub(r'(?:SearchTelegram|margeleTnihcraeS|A7M_S3H4|4H3S_M7A|t\.me/\S+|@[A-Za-z0-9_\-]+)', '', text, flags=re.IGNORECASE)
        lines = text.splitlines()
        cleaned_lines = []
        for line in lines:
            s = line.strip()
            if not s:
                continue
            if any(re.search(pat, s, re.IGNORECASE) for pat in cls.WATERMARK_PATTERNS):
                continue
            # Strip lines with no letters or digits (e.g. solitary '@', '#', '_')
            if not any(c in s for c in 'ابتثجحخدذرزسشصضطظعغفقكلمنهويabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'):
                continue
            if len(s) > 10 and not any(c in s for c in 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي') and re.match(r'^[A-Za-z0-9_@\-\.]+$', s):
                continue
            cleaned_lines.append(line)
        return '\n'.join(cleaned_lines)

    @classmethod
    def fix_arabic_pdf_text(cls, text: str) -> str:
        """Clean and normalize extracted PDF text, resolving watermark overlays, character reversal, and line word-order reversal."""
        if not text:
            return text
        text = cls.clean_watermarks(text)
        text = unicodedata.normalize('NFKC', text)

        lines = text.split('\n')
        fixed_lines = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                fixed_lines.append(line)
                continue

            tokens = stripped.split()
            ar_tokens = [t for t in tokens if re.search(r'[\u0600-\u06FF]', t)]
            
            char_rev_count = sum(1 for t in ar_tokens if t.endswith(('لا', 'لاب', 'لاو', 'لاف', 'لاك')) or t.startswith(('ة', 'ةـ')) or t in ('لقت', 'دادرت', 'فعاضتت', 'فصللل', 'فضللل', 'لوأال', 'يبرهكلا', 'فوشريك', 'لوألا'))
            norm_count = sum(1 for t in ar_tokens if t.startswith(('ال', 'بال', 'وال', 'فال', 'كال')) or t.endswith(('ة', 'ات', 'ين', 'ون')))

            if char_rev_count > norm_count and char_rev_count >= 1:
                new_tokens = [cls._reverse_token(t) for t in reversed(tokens)]
                line = ' '.join(new_tokens)
            else:
                q_num_in_middle = bool(re.search(r'(?:س\s*\d|\d+\s*[\.\):]|Q\d)', stripped) and not re.match(r'^\s*(?:س\s*\d|\d+\s*[\.\):]|Q\d)', stripped))
                starts_with_colon = bool(re.match(r'^\s*[:：\-–]', stripped))
                if q_num_in_middle or starts_with_colon:
                    trans = str.maketrans('()[]{}<>', ')(][}{><')
                    new_tokens = []
                    for t in reversed(tokens):
                        if any(c in t for c in '()[]{}<>'):
                            new_tokens.append(t.translate(trans))
                        else:
                            new_tokens.append(t)
                    line = ' '.join(new_tokens)
                    qm = re.search(r'(\bس\s*\d{1,3}[\.\):]?|\b\d{1,3}\s*[\.\):])', line)
                    if qm and not line.startswith(qm.group(1)):
                        prefix = qm.group(1).strip()
                        line = prefix + ' ' + line.replace(prefix, '').strip()

            for wrong, right in cls.WORD_FIXES.items():
                line = line.replace(wrong, right)

            fixed_lines.append(line)

        return '\n'.join(fixed_lines)

    @classmethod
    def extract_text_from_pdf(cls, file_path: str) -> str:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")

        text_parts = []

        if HAS_PDFPLUMBER:
            try:
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text() or ""
                        text_parts.append(cls.fix_arabic_pdf_text(page_text))
                return "\n".join(text_parts)
            except Exception:
                pass

        if HAS_PYPDF:
            try:
                with open(file_path, "rb") as f:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        page_text = page.extract_text() or ""
                        text_parts.append(cls.fix_arabic_pdf_text(page_text))
                return "\n".join(text_parts)
            except Exception:
                pass

        raise RuntimeError(
            "لا يمكن قراءة ملف PDF. يرجى تثبيت PyPDF2 أو pdfplumber:\n"
            "pip install PyPDF2 pdfplumber"
        )

    @classmethod
    def _safe_float(cls, val, default: float = 0.0) -> float:
        if val is None:
            return default
        try:
            return float(val)
        except (ValueError, TypeError):
            return default

    @classmethod
    def _find_page_visual_bboxes(cls, page) -> List[Tuple[float, float, float, float]]:
        """Collect bounding boxes for both raster images AND vector graphs/diagrams."""
        bboxes = []
        pw = cls._safe_float(getattr(page, "width", 600), 600.0)
        ph = cls._safe_float(getattr(page, "height", 800), 800.0)

        # 1. Raster images
        for img in getattr(page, "images", []) or []:
            x0 = cls._safe_float(img.get("x0"), 0.0)
            top = cls._safe_float(img.get("top"), 0.0)
            x1 = cls._safe_float(img.get("x1"), pw)
            bottom = cls._safe_float(img.get("bottom"), ph)
            w, h = x1 - x0, bottom - top
            # Ignore full-page background graphics
            if w >= pw * 0.92 and h >= ph * 0.92:
                continue
            if w >= 15 and h >= 15:
                bboxes.append((x0, top, x1, bottom))

        # 2. Vector figures & drawings
        for fig in getattr(page, "figures", []) or []:
            x0 = cls._safe_float(fig.get("x0"), 0.0)
            top = cls._safe_float(fig.get("top"), 0.0)
            x1 = cls._safe_float(fig.get("x1"), pw)
            bottom = cls._safe_float(fig.get("bottom"), ph)
            w, h = x1 - x0, bottom - top
            if w >= pw * 0.92 and h >= ph * 0.92:
                continue
            if w >= 20 and h >= 20:
                bboxes.append((x0, top, x1, bottom))

        # 3. Vector paths / curves / rects (physics graphs, circuits, geometric figures)
        vector_objs = (getattr(page, "curves", []) or []) + (getattr(page, "drawings", []) or [])
        for v in vector_objs:
            vx0 = cls._safe_float(v.get("x0"), 0.0)
            vtop = cls._safe_float(v.get("top"), 0.0)
            vx1 = cls._safe_float(v.get("x1"), 0.0)
            vbottom = cls._safe_float(v.get("bottom"), 0.0)
            vw, vh = vx1 - vx0, vbottom - vtop
            # Ignore thin dividing lines spanning page
            if vw >= pw * 0.85 and vh <= 6:
                continue
            if vh >= ph * 0.85 and vw <= 6:
                continue
            if vw >= 25 and vh >= 25:
                bboxes.append((vx0, vtop, vx1, vbottom))

        if not bboxes:
            return []

        # Merge overlapping / adjacent bounding boxes
        margin = 8.0
        merged = []
        for b in bboxes:
            x0 = max(0.0, b[0] - margin)
            top = max(0.0, b[1] - margin)
            x1 = min(pw, b[2] + margin)
            bottom = min(ph, b[3] + margin)

            overlap_idx = -1
            for idx, (mx0, mtop, mx1, mbottom) in enumerate(merged):
                if not (x1 < mx0 or x0 > mx1 or bottom < mtop or top > mbottom):
                    overlap_idx = idx
                    break

            if overlap_idx >= 0:
                mx0, mtop, mx1, mbottom = merged[overlap_idx]
                merged[overlap_idx] = (min(mx0, x0), min(mtop, top), max(mx1, x1), max(mbottom, bottom))
            else:
                merged.append((x0, top, x1, bottom))

        final_boxes = []
        for mx0, mtop, mx1, mbottom in merged:
            w, h = mx1 - mx0, mbottom - mtop
            if w >= pw * 0.92 and h >= ph * 0.92:
                continue
            if w >= 25 and h >= 25:
                final_boxes.append((mx0, mtop, mx1, mbottom))

        return final_boxes

    @classmethod
    def extract_pages_with_images(cls, file_path: str) -> str:
        """Extract page text and crop graph/diagram image regions using pdfplumber."""
        if not HAS_PDFPLUMBER:
            return cls.extract_text_from_pdf(file_path)

        # Store extracted images in global uploads directory
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        image_dir = os.path.normpath(os.path.join(base_dir, "..", "data", "uploads", "extracted_images"))
        os.makedirs(image_dir, exist_ok=True)
        page_blocks = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for page_number, page in enumerate(pdf.pages, start=1):
                    markers = []
                    boxes = cls._find_page_visual_bboxes(page)
                    if boxes:
                        try:
                            page_image = page.to_image(resolution=200)
                            for image_index, bbox in enumerate(boxes, start=1):
                                if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                                    continue
                                image_path = os.path.join(
                                    image_dir,
                                    f"{uuid.uuid4().hex}_p{page_number}_{image_index}.png",
                                )
                                page_image.crop(bbox).save(image_path, format="PNG")
                                markers.append(f"[[EF_IMAGE:{image_path}]]")
                        except Exception:
                            markers = []
                    page_text = page.extract_text() or ""
                    page_text = cls.fix_arabic_pdf_text(page_text)
                    page_blocks.append("\n".join(markers + [page_text]))
            return "\n[[EF_PAGE_BREAK]]\n".join(page_blocks)
        except Exception:
            return cls.extract_text_from_pdf(file_path)

    @classmethod
    def _extract_choices_from_line(cls, line: str) -> Tuple[str, List[Tuple[str, str]]]:
        """Extract multiple choices from a single line."""
        stripped = line.strip()
        if not stripped:
            return "", []

        codes_str = "|".join(cls.ARABIC_CHOICE_CODES + cls.ENGLISH_CHOICE_CODES)
        pattern = r'(?:^|\s+)[\(\[\{]?\s*(' + codes_str + r')\s*[\)\]\}]?\s*[\.\)\-:\–]\s+'
        
        parts = re.split(pattern, line)
        if len(parts) == 1:
            pattern_start = r'^\s*[\(\[\{]?\s*(' + codes_str + r')\s*[\)\]\}]?\s+'
            m = re.match(pattern_start, line)
            if m:
                code = m.group(1)
                text = line[m.end():].strip()
                return "", [(code, text)]
            return line, []
            
        pre_text = parts[0].strip()
        choices = []
        for i in range(1, len(parts), 2):
            code = parts[i]
            c_text = parts[i+1].strip()
            choices.append((code, c_text))
            
        return pre_text, choices

    @classmethod
    def _extract_question_number(cls, line: str) -> Optional[Tuple[int, str]]:
        stripped = line.strip()
        if not stripped:
            return None
        norm_line = cls._convert_eastern_arabic_digits(stripped)
        for pat in cls.QUESTION_NUMBER_PATTERNS:
            m = re.match(pat, norm_line, re.IGNORECASE)
            if m:
                try:
                    num = int(m.group(1))
                    rest = stripped[m.end():].strip()
                    return num, rest
                except ValueError:
                    pass
        return None

    @classmethod
    def _is_true_false_question(cls, text: str) -> bool:
        for pat in cls.TRUE_FALSE_PATTERNS:
            if re.search(pat, text, re.IGNORECASE):
                return True
        return False

    @classmethod
    def _apply_embedded_answer(cls, text: str, choices: List[Dict[str, Any]]) -> None:
        """Mark an MCQ answer when the source includes an inline answer label."""
        ans_pattern = r"(?:\[|\()?\s*(?:الإجابة(?:\s+الصحيحة)?|إجابة|correct\s+answer|answer|key)\s*[:：\-=]?\s*\(?\s*([أبجدABCD])\s*\)?\s*(?:\]|\))?"
        match = re.search(ans_pattern, text, re.IGNORECASE)
        if not match:
            for choice in choices:
                match = re.search(ans_pattern, choice.get("text", ""), re.IGNORECASE)
                if match:
                    choice["text"] = re.sub(
                        ans_pattern + r"\s*$",
                        "",
                        choice.get("text", ""),
                        flags=re.IGNORECASE,
                    ).strip()
                    break
        if match:
            answer_code = match.group(1).lower()
            for choice in choices:
                c_code = choice.get("choice_code", "").lower()
                choice["is_correct"] = (c_code == answer_code)

    @classmethod
    def _extract_and_remove_global_answer_key(cls, raw_text: str) -> Tuple[str, Dict[int, str]]:
        if not re.search(r'(إجابة|الإجابات|Answer Key|Key|حلول|نموذج الإجابة)', raw_text, re.IGNORECASE):
            return raw_text, {}

        # First check if there is an explicit Answer Key section header
        key_header_match = re.search(r'(?:^|\n)\s*(?:نموذج\s+(?:الإجابة|إجابة)|الإجابات|Answer\s+Key|Key\b|حلول\s+الامتحان)[:：\-–]?', raw_text, re.IGNORECASE)
        answer_key = {}

        if key_header_match:
            header_idx = key_header_match.start()
            answer_section = raw_text[header_idx:]
            cleaned_text = raw_text[:header_idx]

            norm_section = cls._convert_eastern_arabic_digits(answer_section)
            pattern = r'(?:س|Q|)?\s*(\d{1,3})\s*[-:=>\.\)]?\s*[\(\[]?\s*([أبجدABCD])\s*[\)\]]?'
            for m in re.finditer(pattern, norm_section, re.IGNORECASE):
                answer_key[int(m.group(1))] = m.group(2).lower()
            return cleaned_text, answer_key

        norm_text = cls._convert_eastern_arabic_digits(raw_text)
        pattern = r'(?:^|\s)(?:س|Q|)?\s*(\d{1,3})\s*[-:=>\.\)]?\s*[\(\[]?\s*([أبجدABCD])\s*[\)\]]?(?=\s|$)'
        for match in re.finditer(pattern, norm_text, re.IGNORECASE):
            num_str = match.group(1)
            ans = match.group(2)
            answer_key[int(num_str)] = ans.lower()
            
        if len(answer_key) >= 2:
            cleaned_text = re.sub(pattern, ' ', raw_text, flags=re.IGNORECASE)
            return cleaned_text, answer_key
        
        return raw_text, {}

    @classmethod
    def _apply_global_answer_key(cls, questions: List[Dict[str, Any]], answer_key: Dict[int, str]) -> None:
        if not answer_key:
            return
        for q in questions:
            q_num = q.get("question_number")
            if q_num in answer_key:
                ans_code = answer_key[q_num]
                for choice in q.get("choices", []):
                    if choice.get("choice_code", "").lower() == ans_code:
                        choice["is_correct"] = True
                    else:
                        choice["is_correct"] = False

    @classmethod
    def _classify_question(
        cls,
        text: str,
        choices: List[Dict[str, Any]]
    ) -> str:
        if cls._is_true_false_question(text):
            return "true_false"
        if choices:
            choice_texts = " ".join(c.get("text", "") for c in choices).lower()
            if ("صواب" in choice_texts or "true" in choice_texts) and ("خطأ" in choice_texts or "false" in choice_texts):
                return "true_false"
            if len(choices) >= 2:
                return "mcq"
        return "essay"

    @classmethod
    def parse_questions_from_text(
        cls,
        raw_text: str,
        default_chapter: str = "الفصل الأول",
        default_source: str = "ملف PDF مستورد",
        default_subject: str = "الفيزياء",
        grade_level: Optional[str] = None,
        term: Optional[str] = None,
        branch: Optional[str] = None,
        lesson: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        raw_text, answer_key = cls._extract_and_remove_global_answer_key(raw_text)
        lines = raw_text.splitlines()
        questions: List[Dict[str, Any]] = []

        active_chapter = default_chapter
        current_q_text_parts: List[str] = []
        current_choices: List[Dict[str, Any]] = []
        current_q_num: Optional[int] = None
        current_image_paths: List[str] = []

        def flush_current():
            nonlocal current_image_paths, active_chapter, current_q_num, current_q_text_parts, current_choices
            if current_q_num is None and not current_q_text_parts:
                return
            text = " ".join(s.strip() for s in current_q_text_parts if s.strip()).strip()
            if not text and not current_choices and not current_image_paths:
                current_q_num = None
                current_q_text_parts = []
                current_choices = []
                return
            q_type = cls._classify_question(text, current_choices)
            if q_type == "mcq":
                cls._apply_embedded_answer(text, current_choices)
            difficulty = cls._estimate_difficulty(text, q_type)
            assigned_num = current_q_num or (len(questions) + 1)
            q: Dict[str, Any] = {
                "question_number": assigned_num,
                "text": text or f"سؤال رقم {assigned_num}",
                "question_type": q_type,
                "difficulty": difficulty,
                "chapter": active_chapter,
                "grade_level": grade_level,
                "term": term,
                "branch": branch,
                "lesson": lesson,
                "source": default_source,
                "subject": default_subject,
                "tags": [],
                "marks": 2,
                "choices": [],
                "model_answer": None,
                "image_paths": list(current_image_paths),
            }
            if q_type == "mcq" and current_choices:
                q["choices"] = current_choices
            elif q_type == "true_false":
                q["choices"] = [
                    {"choice_code": "أ", "text": "صواب (True)", "is_correct": False, "order_index": 0},
                    {"choice_code": "ب", "text": "خطأ (False)", "is_correct": False, "order_index": 1},
                ]
            questions.append(q)
            current_image_paths.clear()
            current_q_num = None
            current_q_text_parts = []
            current_choices = []

        i = 0
        while i < len(lines):
            line = lines[i]

            # Filter out headers, footers, page numbers and section instruction noise
            is_noise, ch_found = cls._is_header_or_noise_line(line)
            if ch_found:
                active_chapter = ch_found
            if is_noise:
                i += 1
                continue

            image_match = re.match(r"^\s*\[\[EF_IMAGE:(.+)\]\]\s*$", line)
            if image_match:
                if current_choices:
                    flush_current()
                img_p = image_match.group(1).strip()
                if os.path.exists(img_p):
                    current_image_paths.append(img_p)
                i += 1
                continue

            if line.strip() == "[[EF_PAGE_BREAK]]":
                flush_current()
                current_image_paths.clear()
                i += 1
                continue

            q_match = cls._extract_question_number(line)
            if q_match is not None:
                flush_current()
                current_q_num, rest = q_match
                if rest:
                    current_q_text_parts = [rest]
                i += 1
                continue

            pre_text, extracted_choices = cls._extract_choices_from_line(line)
            
            if extracted_choices:
                if current_q_num is None and not current_q_text_parts:
                    current_q_num = len(questions) + 1

                if pre_text:
                    if current_choices:
                        last = current_choices[-1]
                        last["text"] = (last["text"] + " " + pre_text).strip()
                    else:
                        current_q_text_parts.append(pre_text)
                
                for code, c_text in extracted_choices:
                    c_order = len(current_choices)
                    current_choices.append({
                        "choice_code": code,
                        "text": c_text,
                        "is_correct": False,
                        "order_index": c_order,
                    })
                i += 1
                continue

            if line.strip():
                if current_choices:
                    is_ans_line = bool(re.search(r'^(?:\[|\()?\s*(?:الإجابة(?:\s+الصحيحة)?|إجابة|correct\s+answer|answer|key)\s*[:：\-=]?', line.strip(), re.IGNORECASE))
                    if is_ans_line:
                        last = current_choices[-1]
                        last["text"] = (last["text"] + " " + line.strip()).strip()
                    else:
                        flush_current()
                        current_q_num = len(questions) + 1
                        current_q_text_parts = [line.strip()]
                else:
                    if current_q_num is None and not current_q_text_parts:
                        current_q_num = len(questions) + 1
                    current_q_text_parts.append(line.strip())
            i += 1

        flush_current()

        if not questions and raw_text.strip():
            paragraphs = [p.strip() for p in re.split(r'\n\s*\n', raw_text) if p.strip()]
            for idx, para in enumerate(paragraphs):
                if len(para) < 5:
                    continue
                questions.append({
                    "question_number": idx + 1,
                    "text": para[:600],
                    "question_type": "essay",
                    "difficulty": "medium",
                    "chapter": active_chapter,
                    "grade_level": grade_level,
                    "term": term,
                    "branch": branch,
                    "lesson": lesson,
                    "source": default_source,
                    "subject": default_subject,
                    "tags": [],
                    "marks": 2,
                    "choices": [],
                    "model_answer": None,
                    "image_paths": list(current_image_paths),
                })
                current_image_paths.clear()

        cls._apply_global_answer_key(questions, answer_key)

        return questions

    @classmethod
    def _estimate_difficulty(cls, text: str, question_type: str) -> str:
        normalized = text.lower()
        hard_markers = ("برهن", "أثبت", "استنتج", "حلل", "ناقش", "علل تعليلاً", "احسب القوة المكافئة", "احسب القدرة المستهلكة", "prove", "derive", "analyze", "evaluate")
        easy_markers = ("عرّف", "اذكر", "ما المقصود", "ما اسم", "حدد", "صواب", "خطأ", "find", "define", "identify", "name")
        if any(marker in normalized for marker in hard_markers):
            return "hard"
        if question_type == "true_false" or any(marker in normalized for marker in easy_markers):
            return "easy"
        return "medium"

    @classmethod
    def parse_pdf_to_questions(
        cls,
        file_path: str,
        default_chapter: str = "الفصل الأول",
        default_source: Optional[str] = None,
        default_subject: str = "الفيزياء",
        grade_level: Optional[str] = None,
        term: Optional[str] = None,
        branch: Optional[str] = None,
        lesson: Optional[str] = None,
        use_ai: bool = True,
        api_key: Optional[str] = None
    ) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
        """Parse PDF document using Multimodal AI Vision.

        Returns: (extracted_text, questions_list, metadata_dict)
        """
        source_name = default_source or os.path.splitext(os.path.basename(file_path))[0]
        text = cls.extract_pages_with_images(file_path)

        detected_subject = default_subject
        detected_language = "arabic"
        detected_chapter = default_chapter
        questions = []

        if use_ai:
            try:
                from app.services.ai_parser_service import AIParserService
                det_sub, det_lang, det_chap, questions = AIParserService.extract_questions_from_pdf_multimodal(
                    file_path,
                    api_key=api_key,
                    default_subject=default_subject,
                    default_chapter=default_chapter,
                    default_source=source_name
                )
                if det_sub:
                    detected_subject = det_sub
                if det_lang:
                    detected_language = det_lang
                if det_chap:
                    detected_chapter = det_chap
            except Exception as e:
                import logging
                logging.warning(f"AI Vision extraction error: {e}")
                questions = []

        if not questions:
            from app.services.smart_nlp_parser import SmartNLPParser
            questions = SmartNLPParser.parse_text(
                text,
                subject=default_subject,
                chapter=default_chapter,
                source=source_name
            )

        if not questions:
            questions = cls.parse_questions_from_text(
                text,
                default_chapter=default_chapter,
                default_source=source_name,
                default_subject=default_subject,
                grade_level=grade_level,
                term=term,
                branch=branch,
                lesson=lesson
            )

        # Enrich and normalize question items with metadata
        from app.services.smart_nlp_parser import SmartNLPParser
        for idx, q in enumerate(questions, 1):
            SmartNLPParser.normalize_question_item(q)
            q.setdefault("question_number", idx)
            q.setdefault("grade_level", grade_level)
            q.setdefault("term", term)
            q.setdefault("branch", branch)
            q.setdefault("lesson", lesson)
            q.setdefault("source", source_name)
            q.setdefault("subject", detected_subject)
            q.setdefault("chapter", detected_chapter)
            q.setdefault("marks", 2)
            q.setdefault("choices", [])
            q.setdefault("tags", [])
            q.setdefault("image_paths", [])

        metadata = {
            "detected_subject": detected_subject,
            "detected_language": detected_language,
            "detected_chapter": detected_chapter,
            "question_count": len(questions)
        }

        return text, questions, metadata
