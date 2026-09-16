import os
import io
import json
import base64
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional, Tuple

class AIParserService:
    """Multimodal Vision AI Extraction Engine for ExamForge.

    Directly inspects PDF page renders (images) using Generative AI Vision API,
    automatically detecting the subject (e.g. French, Physics, Chemistry, Math, Arabic),
    document language, chapter, question types (QCM, Vrai/Faux, Essay), options,
    difficulty, and model answers with human-level accuracy.
    """

    DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    MULTIMODAL_SYSTEM_PROMPT = """You are an Expert Multimodal Educational Exam & Textbook Question Extractor.
Inspect the provided page image or text carefully.

Your mission:
1. AUTO-DETECT Document Language (e.g. "french", "arabic", "english", "german").
2. AUTO-DETECT Subject Name in Arabic (e.g. "اللغة الفرنسية", "الفيزياء", "الكيمياء", "الرياضيات", "اللغة العربية", "اللغة الإنجليزية", "التاريخ", "الجغرافيا").
3. AUTO-DETECT Chapter / Unit title if present on the page.
4. EXTRACT ALL questions, exercises, QCMs, True/False, and essay items into structured JSON.

Strict JSON Output Schema:
{
  "detected_language": "french" | "arabic" | "english",
  "detected_subject": "اللغة الفرنسية" | "الفيزياء" | "الكيمياء" | "الرياضيات" | "اللغة العربية" | "اللغة الإنجليزية" | "التاريخ" | "الجغرافيا",
  "detected_chapter": "Unit / Chapter title string or null",
  "questions": [
    {
      "question_number": integer or null,
      "text": "Full question statement in original language",
      "question_type": "mcq" | "true_false" | "essay",
      "difficulty": "easy" | "medium" | "hard",
      "choices": [
        {
          "choice_code": "a" | "b" | "c" | "d" | "أ" | "ب" | "ج" | "د",
          "text": "Choice text",
          "is_correct": boolean
        }
      ],
      "model_answer": "Answer string if available or null"
    }
  ]
}

Extraction Guidelines:
- CRITICAL FOR QUESTION TYPES: ANY question containing choices or options (marked by 'a)', 'b)', 'c)', 'd)', 'أ)', 'ب)', '1)', '2)' OR symbols like '☐', '☑', '⚪', '◯', '[ ]', '( )') MUST be categorized as "question_type": "mcq". NEVER classify multiple choice questions as "essay"!
- REMOVE choice symbols (like '☐', '⚪', '[ ]') from the 'text' field and put each option string cleanly into the 'choices' list array.
- French QCM: Extract 'a)', 'b)', 'c)', 'd)' choices. For Vrai/Faux, create two choices 'a) Vrai' and 'b) Faux' and set "question_type": "true_false".
- Arabic: Extract 'أ', 'ب', 'ج', 'د'. For صح/خطأ, create 'أ) صواب' and 'ب) خطأ' and set "question_type": "true_false".
- Physics & Math: Preserve formula symbols, units, and references to diagrams ("dans la figure ci-contre" / "في الشكل المقابل").
- Extract ALL questions on the page accurately without skipping any item.
"""

    @classmethod
    def _clean_json_response(cls, response_text: str) -> str:
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()
        return cleaned

    CONFIG_FILE = os.path.normpath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "data", "config", "ai_settings.json"))

    @classmethod
    def get_saved_api_key(cls) -> Optional[str]:
        if os.path.exists(cls.CONFIG_FILE):
            try:
                with open(cls.CONFIG_FILE, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    k = cfg.get("api_key")
                    if k:
                        return k
            except Exception:
                pass
        return os.environ.get("GEMINI_API_KEY") or os.environ.get("EXAMFORGE_AI_KEY")

    @classmethod
    def save_api_key(cls, key: str) -> None:
        if not key:
            return
        os.makedirs(os.path.dirname(cls.CONFIG_FILE), exist_ok=True)
        try:
            with open(cls.CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump({"api_key": key}, f)
        except Exception:
            pass

    @classmethod
    def extract_questions_from_pdf_multimodal(
        cls,
        file_path: str,
        api_key: Optional[str] = None,
        default_subject: str = "الفيزياء",
        default_chapter: str = "الفصل الأول",
        default_source: str = "مصدر مستورد",
        progress_callback: Optional[Any] = None
    ) -> Tuple[str, str, str, List[Dict[str, Any]]]:
        """Convert PDF pages into images/text and process using Multimodal Vision AI with progress reporting."""
        if api_key:
            cls.save_api_key(api_key)
        
        key = api_key or cls.get_saved_api_key()

        from app.services.pdf_analyzer_service import PDFAnalyzerService
        analysis = PDFAnalyzerService.analyze_pdf(file_path)
        pages_info = analysis.get("pages", [])
        total_pages = len(pages_info)

        if progress_callback:
            progress_callback(1, total_pages, f"تمت تحليل ملف PDF ({total_pages} صفحة). جاري تجهيز الذكاء الاصطناعي...")

        all_questions: List[Dict[str, Any]] = []
        detected_subject = default_subject
        detected_language = "arabic"
        detected_chapter = default_chapter

        # Process page by page or in smart 3-page chunks to prevent timeouts
        chunk_size = 3
        for idx in range(0, total_pages, chunk_size):
            chunk_pages = pages_info[idx:idx + chunk_size]
            current_page_num = idx + 1
            if progress_callback:
                progress_callback(current_page_num, total_pages, f"🤖 [صفحة {current_page_num} من {total_pages}] جاري استخراج الأسئلة عبر الذكاء الاصطناعي...")

            # Combine page texts or images
            chunk_images = [p["image_bytes"] for p in chunk_pages if p.get("image_bytes")]
            chunk_texts = "\n".join(p["text"] for p in chunk_pages if p.get("text"))

            if key and chunk_images:
                # Encode first image of chunk for vision API
                b64_img = base64.b64encode(chunk_images[0]).decode("utf-8")
                res = cls._call_gemini_vision_api(b64_img, key=key)
                if res:
                    det_sub = res.get("detected_subject")
                    if det_sub:
                        detected_subject = det_sub
                    det_lang = res.get("detected_language")
                    if det_lang:
                        detected_language = det_lang
                    det_chap = res.get("detected_chapter")
                    if det_chap:
                        detected_chapter = det_chap
                    
                    p_questions = res.get("questions", [])
                    from app.services.smart_nlp_parser import SmartNLPParser
                    for q in p_questions:
                        q["source_page"] = current_page_num
                        q = SmartNLPParser.normalize_question_item(q)
                        # Validation for review
                        if not q.get("text") or (q.get("question_type") == "mcq" and len(q.get("choices", [])) < 2):
                            q["needs_review"] = True
                        else:
                            q["needs_review"] = False
                        all_questions.append(q)

        # Fallback to SmartNLPParser if AI returned no questions
        if not all_questions:
            if progress_callback:
                progress_callback(total_pages, total_pages, "⏳ المعالجة عبر المحلل الهيكلي الذكي...")
            from app.services.smart_nlp_parser import SmartNLPParser
            full_txt = analysis.get("full_text", "")
            all_questions = SmartNLPParser.parse_text(
                full_txt,
                subject=default_subject,
                chapter=default_chapter,
                source=default_source
            )
            if any(w in full_txt.lower() for w in ["exercice", "choisissez", "répondez", "vrai", "faux"]):
                detected_language = "french"
                detected_subject = "اللغة الفرنسية"

        if progress_callback:
            progress_callback(total_pages, total_pages, f"✨ اكتمل الاستخراج! تم العثور على ({len(all_questions)}) سؤال.")

        return detected_subject, detected_language, detected_chapter, all_questions

    @classmethod
    def _call_gemini_vision_api(cls, image_b64: str, key: str) -> Optional[Dict[str, Any]]:
        """Send base64 page image to Gemini 1.5 Flash Vision Multimodal REST API."""
        url = f"{cls.DEFAULT_GEMINI_ENDPOINT}?key={key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": cls.MULTIMODAL_SYSTEM_PROMPT},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": image_b64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "topP": 0.95,
                "responseMimeType": "application/json"
            }
        }

        try:
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=35) as resp:
                result_json = json.loads(resp.read().decode("utf-8"))
                candidates = result_json.get("candidates", [])
                if not candidates:
                    return None
                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    return None
                
                text_response = parts[0].get("text", "")
                cleaned_json_str = cls._clean_json_response(text_response)
                return json.loads(cleaned_json_str)
        except Exception as err:
            import logging
            logging.warning(f"Gemini Vision API Call error: {err}")
            return None
