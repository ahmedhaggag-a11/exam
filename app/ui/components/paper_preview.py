# Exam Paper Preview Renderer with 4 Distinct Templates + full AR/EN bilingual
import re
import customtkinter as ctk
from typing import Dict, Any, List, Optional
from app.config.theme import Theme
from app.config.settings import TeacherProfile

_LABELS = {
    "ar": {
        "student_name": "اسم الطالب",
        "group_hall": "المجموعة / القاعة",
        "instructions_title": "تعليمات هامة",
        "instructions_default": "تعليمات: اجب على جميع الأسئلة، ولا تنسَ تدوين اسمك ورقم القاعة ورقم النموذج.",
        "questions_title": "❖ الأسئلة",
        "marks_unit": "درجات",
        "marks_title": "الدرجة",
        "answer_space": "مساحة الإجابة:",
        "true": "صحيح",
        "false": "خطأ",
        "subject_label": "المادة",
        "duration_label": "الزمن",
        "model_label": "النموذج",
        "teacher_label": "المعلم",
        "page_of": "صفحة",
        "footer_wish": "ExamForge • مع أطيب تمنياتنا بالتفوق والنجاح",
    },
    "en": {
        "student_name": "Student Name",
        "group_hall": "Group / Hall",
        "instructions_title": "Important Instructions",
        "instructions_default": "Instructions: Answer all questions. Don't forget to write your name, hall number, and model number.",
        "questions_title": "❖ QUESTIONS",
        "marks_unit": "Marks",
        "marks_title": "Marks",
        "answer_space": "Answer Space:",
        "true": "True",
        "false": "False",
        "subject_label": "Subject",
        "duration_label": "Duration",
        "model_label": "Model",
        "teacher_label": "Teacher",
        "page_of": "Page",
        "footer_wish": "ExamForge • Best wishes for success and excellence",
    },
}


def _detect_lang(exam_data: Dict[str, Any], questions: List[Dict[str, Any]]) -> str:
    explicit = exam_data.get("language")
    if explicit in ("ar", "en"):
        return explicit
    samples = [
        exam_data.get("name", ""),
        exam_data.get("subject", ""),
        exam_data.get("instructions", ""),
    ]
    for q in questions:
        samples.append(q.get("text", ""))
        for c in q.get("choices", []) or []:
            samples.append(c.get("text", "") if isinstance(c, dict) else "")
    combined = " ".join(str(s) for s in samples if s)
    if not combined.strip():
        return "ar"
    ar_chars = len(re.findall(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', combined))
    en_chars = len(re.findall(r'[a-zA-Z]', combined))
    if ar_chars > en_chars:
        return "ar"
    if en_chars > ar_chars:
        return "en"
    return "ar"


class PaperPreviewWidget(ctk.CTkScrollableFrame):
    def __init__(
        self,
        master,
        exam_data: Dict[str, Any],
        questions: List[Dict[str, Any]],
        model_code: str = "A",
        template: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        super().__init__(
            master,
            fg_color="#F1F5F9",
            corner_radius=Theme.CORNER_RADIUS_LG,
            **kwargs
        )
        self.exam_data = exam_data
        self.questions = questions
        self.model_code = model_code
        self.template = template or {
            "layout_type": "classic",
            "accent_color": "#2563EB",
        }
        self.layout_type = self.template.get("layout_type", "classic")
        self.accent = self.template.get("accent_color", "#2563EB") if self.template.get("accent_color") else "#2563EB"
        # Resolve exam-specific language (RTL/LTR) regardless of app UI language
        self.exam_language = _detect_lang(self.exam_data, self.questions)
        self.exam_data["language"] = self.exam_language
        self.grid_columnconfigure(0, weight=1)
        self._render_paper()

    # ========== Helpers for bilingual labels (per-exam language, not UI language) ==========
    def _L(self) -> Dict[str, str]:
        return _LABELS.get(self.exam_language, _LABELS["ar"])

    
    def _render_question_images(self, parent_frame, q, max_w=340, max_h=120):
        import os
        img_paths = q.get("image_paths", []) or []
        if not img_paths and q.get("image_path"):
            img_paths = [q.get("image_path")]

        valid_paths = [p for p in img_paths if p and os.path.exists(p)]
        if not valid_paths:
            return

        try:
            from PIL import Image
            img_container = ctk.CTkFrame(parent_frame, fg_color="transparent")
            img_container.pack(fill="x", padx=4, pady=4)

            for img_path in valid_paths:
                try:
                    pil_img = Image.open(img_path)
                    w, h = pil_img.size
                    scale = min(max_w / max(1, w), max_h / max(1, h), 1.0)
                    disp_w = max(40, int(w * scale))
                    disp_h = max(30, int(h * scale))

                    ctk_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(disp_w, disp_h))
                    lbl = ctk.CTkLabel(img_container, text="", image=ctk_img)
                    lbl.pack(pady=4, anchor="center")
                except Exception:
                    pass
        except Exception:
            pass

    def _rtl_helpers(self):
        rtl = (self.exam_language == "ar")
        ta = "e" if rtl else "w"
        jv = "right" if rtl else "left"
        return rtl, ta, jv

    # ========== Top-level router: pick layout (4 distinct templates) ==========
    def _render_paper(self):
        for w in self.winfo_children():
            w.destroy()
        if self.layout_type == "classic":
            self._render_classic()
        elif self.layout_type == "ministry":
            self._render_official_sheet(double_frame=True)
        elif self.layout_type == "modern_split":
            self._render_modern_split()
        elif self.layout_type in ("simple", "simple_first", "simple_last", "compact"):
            self._render_simple_first()
        else:
            self._render_classic()

    # =========================================================
    # OFFICIAL SHEET - monochrome grid inspired by formal exam papers
    # =========================================================
    def _render_official_sheet(self, double_frame: bool = False):
        """A formal, black-and-white paper: three-part header and ruled question grid."""
        rtl, ta, jv = self._rtl_helpers()
        L = self._L()
        paper = ctk.CTkFrame(
            self, fg_color="#FFFFFF", border_color="#000000",
            border_width=4 if double_frame else 2, corner_radius=0,
        )
        paper.pack(fill="x", padx=28, pady=24)
        paper.grid_columnconfigure(0, weight=1)

        if double_frame:
            inner = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color="#000000", border_width=1, corner_radius=0)
            inner.pack(fill="x", padx=6, pady=6)
            paper = inner
            paper.grid_columnconfigure(0, weight=1)

        header = ctk.CTkFrame(paper, fg_color="transparent")
        header.pack(fill="x", padx=22, pady=(18, 8))
        header.grid_columnconfigure((0, 1, 2), weight=1)
        left_col, center_col, right_col = (2, 1, 0) if rtl else (0, 1, 2)

        teacher = ctk.CTkFrame(header, fg_color="transparent")
        teacher.grid(row=0, column=left_col, sticky="e" if rtl else "w")
        ctk.CTkLabel(teacher, text=TeacherProfile.NAME_AR if rtl else TeacherProfile.NAME_EN,
                     font=("Times New Roman", 11, "bold"), text_color="#000000", anchor=ta).pack(anchor=ta)
        ctk.CTkLabel(teacher, text=TeacherProfile.TITLE_AR if rtl else TeacherProfile.TITLE_EN,
                     font=("Times New Roman", 9), text_color="#000000", anchor=ta).pack(anchor=ta)

        center = ctk.CTkFrame(header, fg_color="transparent")
        center.grid(row=0, column=center_col, sticky="nsew")
        ctk.CTkLabel(center, text="بسم الله الرحمن الرحيم", font=("Times New Roman", 11, "bold"), text_color="#000000").pack()
        ctk.CTkLabel(center, text="ورقة اختبار", font=("Times New Roman", 15, "bold"), text_color="#000000").pack(pady=(4, 0))
        ctk.CTkLabel(center, text=f"{L['subject_label']}: {self.exam_data.get('subject', '')}",
                     font=("Times New Roman", 10), text_color="#000000").pack()

        details = ctk.CTkFrame(header, fg_color="transparent")
        details.grid(row=0, column=right_col, sticky="w" if rtl else "e")
        ctk.CTkLabel(details, text=f"{L['duration_label']}: {self.exam_data.get('duration', '')}",
                     font=("Times New Roman", 10), text_color="#000000", anchor="w" if rtl else "e").pack(anchor="w" if rtl else "e")
        ctk.CTkLabel(details, text=f"{L['model_label']}: {self.exam_data.get('model_name', self.model_code)}",
                     font=("Times New Roman", 10, "bold"), text_color="#000000", anchor="w" if rtl else "e").pack(anchor="w" if rtl else "e")

        ctk.CTkLabel(paper, text=self.exam_data.get("name", "اختبار"), font=("Times New Roman", 14, "bold"),
                     text_color="#000000", anchor="center").pack(fill="x", padx=22, pady=(8, 4))
        ctk.CTkFrame(paper, height=1, fg_color="#000000").pack(fill="x", padx=22)

        info = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color="#000000", border_width=1, corner_radius=0)
        info.pack(fill="x", padx=22, pady=10)
        info.grid_columnconfigure((0, 1), weight=1)
        name_col, hall_col = (1, 0) if rtl else (0, 1)
        ctk.CTkLabel(info, text=f"{L['student_name']}: " + "_" * 28, font=("Times New Roman", 10), text_color="#000000", anchor=ta).grid(row=0, column=name_col, padx=8, pady=7, sticky="ew")
        ctk.CTkLabel(info, text=f"{L['group_hall']}: " + "_" * 18, font=("Times New Roman", 10), text_color="#000000", anchor=ta).grid(row=0, column=hall_col, padx=8, pady=7, sticky="ew")

        section = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color="#000000", border_width=1, corner_radius=0)
        section.pack(fill="x", padx=22, pady=(0, 0))
        ctk.CTkLabel(section, text=f"❖ {L['questions_title']}", font=("Times New Roman", 11, "bold"), text_color="#000000", anchor=ta).pack(fill="x", padx=8, pady=5)

        for index, question in enumerate(self.questions, start=1):
            self._render_official_question(paper, question, index, rtl, ta, jv, L, border_color="#000000")

        footer = ctk.CTkFrame(paper, fg_color="transparent")
        footer.pack(fill="x", padx=22, pady=(10, 16))
        ctk.CTkFrame(footer, height=1, fg_color="#000000").pack(fill="x", pady=(0, 5))
        ctk.CTkLabel(footer, text=f"{L['page_of']} 1", font=("Times New Roman", 9), text_color="#000000").pack()

    def _render_official_question(self, paper, question, number, rtl, ta, jv, L, border_color="#000000", num_bg=None, num_fg="#000000"):
        row = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color=border_color, border_width=1, corner_radius=0)
        row.pack(fill="x", padx=22, pady=(0, 0))
        number_col, body_col = (1, 0) if rtl else (0, 1)
        row.grid_columnconfigure(body_col, weight=1)

        if num_bg:
            num_box = ctk.CTkFrame(row, fg_color=num_bg, corner_radius=0, width=38)
            num_box.grid(row=0, column=number_col, sticky="ns")
            num_box.grid_propagate(False)
            ctk.CTkLabel(num_box, text=str(number), font=("Segoe UI", 11, "bold"), text_color=num_fg).place(relx=0.5, rely=0.5, anchor="center")
        else:
            ctk.CTkLabel(row, text=str(number), font=("Times New Roman", 11, "bold"), text_color="#000000", width=34).grid(row=0, column=number_col, padx=4, pady=5, sticky="ns")

        # Body container using pack() sequentially for text -> image -> choices
        body_frame = ctk.CTkFrame(row, fg_color="transparent")
        body_frame.grid(row=0, column=body_col, padx=8, pady=6, sticky="ew")

        # 1. Question Text
        ctk.CTkLabel(
            body_frame,
            text=question.get("text", ""),
            font=("Segoe UI", 11) if num_bg else ("Times New Roman", 11),
            text_color="#000000",
            wraplength=600,
            justify=jv,
            anchor=ta
        ).pack(fill="x", pady=(2, 4), anchor=ta)

        # 2. Attached Image (scaled max 340px width x 120px height)
        self._render_question_images(body_frame, question, max_w=340, max_h=120)

        # 3. Choices / Answer Space
        qtype = question.get("question_type", "mcq")
        if qtype == "mcq" and question.get("choices"):
            choices = ctk.CTkFrame(body_frame, fg_color="#FFFFFF", border_color=border_color, border_width=1, corner_radius=0)
            choices.pack(fill="x", pady=(4, 2))
            values = question.get("choices", [])[:4]
            for choice_index, choice in enumerate(values):
                choices.grid_columnconfigure(choice_index, weight=1)
                code = (['أ', 'ب', 'ج', 'د'] if rtl else ['A', 'B', 'C', 'D'])[choice_index]
                ctk.CTkLabel(
                    choices,
                    text=f"({code}) {choice.get('text', '')}",
                    font=("Segoe UI" if num_bg else "Times New Roman", 10),
                    text_color="#000000",
                    anchor="center",
                    wraplength=135
                ).grid(row=0, column=choice_index, padx=2, pady=5, sticky="ew")
        elif qtype == "true_false":
            ctk.CTkLabel(
                body_frame,
                text=f"(   ) {L['true']}     (   ) {L['false']}",
                font=("Segoe UI" if num_bg else "Times New Roman", 10),
                text_color="#000000",
                anchor=ta
            ).pack(fill="x", pady=(4, 4), anchor=ta)
        else:
            ctk.CTkLabel(
                body_frame,
                text=("_" * 90),
                font=("Segoe UI" if num_bg else "Times New Roman", 9),
                text_color="#000000",
                anchor=ta
            ).pack(fill="x", pady=(4, 6), anchor=ta)

    # =========================================================
    #  LAYOUT 1 - CLASSIC (Ministry-inspired structured format with blue accents)
    # =========================================================
    def _render_classic(self):
        rtl, ta, jv = self._rtl_helpers()
        L = self._L()

        paper = ctk.CTkFrame(self, fg_color="#FFFFFF", border_color=self.accent, border_width=2, corner_radius=0)
        paper.pack(fill="x", padx=28, pady=24)
        paper.grid_columnconfigure(0, weight=1)

        # Top Accent Strip
        ctk.CTkFrame(paper, height=4, fg_color=self.accent, corner_radius=0).pack(fill="x")

        # Header
        header = ctk.CTkFrame(paper, fg_color="transparent")
        header.pack(fill="x", padx=22, pady=(18, 8))
        header.grid_columnconfigure((0, 1, 2), weight=1)
        left_col, center_col, right_col = (2, 1, 0) if rtl else (0, 1, 2)

        teacher = ctk.CTkFrame(header, fg_color="transparent")
        teacher.grid(row=0, column=left_col, sticky="e" if rtl else "w")
        ctk.CTkLabel(teacher, text=TeacherProfile.NAME_AR if rtl else TeacherProfile.NAME_EN,
                     font=("Segoe UI", 12, "bold"), text_color=self.accent, anchor=ta).pack(anchor=ta)
        ctk.CTkLabel(teacher, text=TeacherProfile.TITLE_AR if rtl else TeacherProfile.TITLE_EN,
                     font=("Segoe UI", 9), text_color="#334155", anchor=ta).pack(anchor=ta)

        center = ctk.CTkFrame(header, fg_color="transparent")
        center.grid(row=0, column=center_col, sticky="nsew")
        ctk.CTkLabel(center, text="بسم الله الرحمن الرحيم", font=("Segoe UI", 11, "bold"), text_color="#334155").pack()
        ctk.CTkLabel(center, text=self.exam_data.get("name", "ورقة اختبار"), font=("Segoe UI", 16, "bold"), text_color=self.accent).pack(pady=(4, 0))
        ctk.CTkLabel(center, text=f"{L['subject_label']}: {self.exam_data.get('subject', '')}",
                     font=("Segoe UI", 10, "bold"), text_color="#1E293B").pack()

        details = ctk.CTkFrame(header, fg_color="transparent")
        details.grid(row=0, column=right_col, sticky="w" if rtl else "e")
        ctk.CTkLabel(details, text=f"{L['duration_label']}: {self.exam_data.get('duration', '')}",
                     font=("Segoe UI", 10), text_color="#334155", anchor="w" if rtl else "e").pack(anchor="w" if rtl else "e")
        ctk.CTkLabel(details, text=f"{L['model_label']}: {self.exam_data.get('model_name', self.model_code)}",
                     font=("Segoe UI", 11, "bold"), text_color=self.accent, anchor="w" if rtl else "e").pack(anchor="w" if rtl else "e")

        ctk.CTkFrame(paper, height=1, fg_color=self.accent).pack(fill="x", padx=22, pady=(6, 0))

        # Student Info Box
        info = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color=self.accent, border_width=1, corner_radius=0)
        info.pack(fill="x", padx=22, pady=10)
        info.grid_columnconfigure((0, 1), weight=1)
        name_col, hall_col = (1, 0) if rtl else (0, 1)
        ctk.CTkLabel(info, text=f"{L['student_name']}: " + "_" * 28, font=("Segoe UI", 10, "bold"), text_color="#1E293B", anchor=ta).grid(row=0, column=name_col, padx=8, pady=7, sticky="ew")
        ctk.CTkLabel(info, text=f"{L['group_hall']}: " + "_" * 18, font=("Segoe UI", 10, "bold"), text_color="#1E293B", anchor=ta).grid(row=0, column=hall_col, padx=8, pady=7, sticky="ew")

        # Questions Section Header
        section = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color=self.accent, border_width=1, corner_radius=0)
        section.pack(fill="x", padx=22, pady=(0, 0))
        ctk.CTkLabel(section, text=f"❖ {L['questions_title']}", font=("Segoe UI", 11, "bold"), text_color=self.accent, anchor=ta).pack(fill="x", padx=8, pady=5)

        for index, question in enumerate(self.questions, start=1):
            self._render_official_question(paper, question, index, rtl, ta, jv, L, border_color=self.accent, num_bg=self.accent, num_fg="#FFFFFF")

        footer = ctk.CTkFrame(paper, fg_color="transparent")
        footer.pack(fill="x", padx=22, pady=(10, 16))
        ctk.CTkFrame(footer, height=1, fg_color=self.accent).pack(fill="x", pady=(0, 5))
        ctk.CTkLabel(footer, text=f"{L['page_of']} 1", font=("Segoe UI", 9), text_color="#475569").pack()

    def _student_info_boxed(self, paper, ta, rtl, L):
        meta = ctk.CTkFrame(paper, fg_color="transparent")
        meta.pack(fill="x", padx=36, pady=(18, 0))
        meta.grid_columnconfigure((0, 1), weight=1)

        def field(label, col):
            col0, col1 = (0, 1) if rtl else (1, 0)
            outer = ctk.CTkFrame(meta, fg_color="transparent")
            outer.grid(row=0, column=col, padx=(4, 4), sticky="nsew")
            top_bar = ctk.CTkFrame(outer, fg_color=self.accent, corner_radius=4)
            top_bar.pack(fill="x")
            ctk.CTkLabel(top_bar, text=label, font=("Segoe UI", 10, "bold"),
                         text_color="#FFFFFF", anchor=ta).pack(anchor=ta, padx=12, pady=4)
            body = ctk.CTkFrame(outer, fg_color="#F9FAFB", border_color=self.accent,
                                border_width=1, corner_radius=4)
            body.pack(fill="x")
            ctk.CTkLabel(body, text=" " * 60, font=("Segoe UI", 12),
                         text_color="#1F2937", anchor=ta).pack(anchor=ta, padx=12, pady=10)
            ctk.CTkFrame(body, height=1, fg_color="#CBD5E1").pack(fill="x", padx=12, pady=(0, 10))

        if rtl:
            field(L["student_name"], 1)
            field(L["group_hall"], 0)
        else:
            field(L["student_name"], 0)
            field(L["group_hall"], 1)

    def _instructions_panel(self, paper, ta, jv, L, accent_bg=False):
        inst_text = self.exam_data.get("instructions") or L["instructions_default"]
        if accent_bg:
            bg_fg, bd_col, hdr_bg = self.accent, self.accent, "#FFFFFF"
            lbl_txt_clr, hdr_txt_clr = "#FFFFFF", "#FFFFFF"
        else:
            bg_fg, bd_col, hdr_bg = "#F9FAFB", "#E5E7EB", self.accent
            lbl_txt_clr, hdr_txt_clr = "#4B5563", "#FFFFFF"

        inst = ctk.CTkFrame(paper, fg_color=bg_fg, corner_radius=6, border_color=bd_col, border_width=1)
        inst.pack(fill="x", padx=36, pady=(16, 0))
        i_inner = ctk.CTkFrame(inst, fg_color="transparent")
        i_inner.pack(fill="x", padx=14, pady=10)
        i_inner.grid_columnconfigure(1, weight=1)

        side_col, label_col = (0, 1)
        ctk.CTkLabel(i_inner, text="ℹ️", font=("Segoe UI", 18), text_color=(lbl_txt_clr if not accent_bg else "#FFFFFF")
                     ).grid(row=0, column=side_col, rowspan=2, padx=(0, 10), sticky=ta)
        tl = ctk.CTkFrame(i_inner, fg_color=hdr_bg if accent_bg else hdr_bg, corner_radius=4)
        tl.grid(row=0, column=label_col, pady=(0, 6), sticky=ta)
        ctk.CTkLabel(tl, text=L["instructions_title"], font=("Segoe UI", 11, "bold"),
                     text_color=("#FFFFFF" if accent_bg else "#FFFFFF"), anchor=ta).pack(padx=12, pady=3)
        ctk.CTkLabel(i_inner, text=inst_text, font=("Segoe UI", 10),
                     text_color=(lbl_txt_clr if not accent_bg else "#FFFFFF"),
                     wraplength=680, justify=jv, anchor=ta).grid(row=1, column=label_col, sticky="ew")

    def _section_title(self, paper, title_text, ta, rtl):
        qs_title = ctk.CTkFrame(paper, fg_color="transparent")
        qs_title.pack(fill="x", padx=36, pady=(24, 14))
        qs_title.grid_columnconfigure(0, weight=1)
        qs_title.grid_columnconfigure(2, weight=1)

        if rtl:
            t_col, l_col = 2, 0
            t_padx, l_padx = (0, 10), (10, 0)
        else:
            t_col, l_col = 0, 2
            t_padx, l_padx = (0, 10), (10, 0)

        lbl = ctk.CTkLabel(qs_title, text=title_text, font=("Segoe UI", 14, "bold"),
                           text_color=self.accent, anchor=ta)
        lbl.grid(row=0, column=t_col, padx=t_padx, sticky=("e" if rtl else "w"))
        ctk.CTkFrame(qs_title, height=2, fg_color=self.accent, corner_radius=2
                     ).grid(row=0, column=l_col, padx=l_padx, sticky="ew")

    def _classic_single_question(self, paper, idx, q, ta, jv, rtl, L):
        q_row = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color="#E5E7EB",
                             border_width=1, corner_radius=8)
        q_row.pack(fill="x", padx=36, pady=(0, 16))
        q_row.grid_columnconfigure(1, weight=1)

        q_type = q.get("question_type", "mcq")
        q_num = idx + 1
        marks = q.get("marks", 2)

        # Number + accent strip (large block)
        num_col = 2 if rtl else 0
        marks_col = 0 if rtl else 2

        num_frame = ctk.CTkFrame(q_row, fg_color=self.accent, corner_radius=8, width=60)
        num_frame.grid(row=0, column=num_col, rowspan=3, padx=(12, 0) if rtl else (0, 12), pady=12, sticky="ns")
        num_frame.grid_propagate(False)
        ctk.CTkLabel(num_frame, text=f"{q_num:02d}", font=("Segoe UI", 18, "bold"),
                     text_color="#FFFFFF").pack(pady=(10, 2))
        ctk.CTkLabel(num_frame, text=L["marks_title"], font=("Segoe UI", 8),
                     text_color="#DBEAFE").pack()
        ctk.CTkFrame(num_frame, height=1, fg_color="#BFDBFE").pack(fill="x", padx=10, pady=4)
        ctk.CTkLabel(num_frame, text=f"{marks}", font=("Segoe UI", 16, "bold"),
                     text_color="#FFFFFF").pack()

        # Marks pill (alternate)
        marks_bg = "#ECFDF5"
        marks_fg = "#065F46"
        mframe = ctk.CTkFrame(q_row, fg_color=marks_bg, corner_radius=20)
        mframe.grid(row=0, column=marks_col, rowspan=3, padx=(0, 12) if rtl else (12, 0),
                    pady=12, sticky="n")
        ctk.CTkLabel(mframe, text=f"{marks} {L['marks_unit']}", font=("Segoe UI", 10, "bold"),
                     text_color=marks_fg).pack(padx=14, pady=6)

        # Question text body
        body_col = 1
        ctk.CTkLabel(q_row, text=q.get("text", ""),
                     font=("Segoe UI", 13, "bold"), text_color="#111827",
                     wraplength=530, justify=jv, anchor=ta
                     ).grid(row=0, column=body_col, pady=(14, 10), sticky="ew", padx=(4, 4))
        self._render_question_images(q_row, body_col, q, rtl)

        # Choices / answers
        self._render_choices(q_row, body_col, q, q_type, ta, jv, rtl, L, classic=True)
        q_row.grid_rowconfigure(2, weight=1)

    def _render_choices(self, parent, col, q, q_type, ta, jv, rtl, L, classic=False):
        if q_type == "mcq" and q.get("choices"):
            c_wrap = ctk.CTkFrame(parent, fg_color="transparent")
            c_wrap.grid(row=1, column=col, pady=(0, 14), sticky="ew", padx=(4, 10))
            c_wrap.grid_columnconfigure(0, weight=1)
            codes = ["أ", "ب", "ج", "د", "هـ"] if rtl else ["A", "B", "C", "D", "E"]
            for c_idx, c in enumerate(q.get("choices", [])):
                code = codes[c_idx] if c_idx < len(codes) else c.get("choice_code", "")
                c_line = ctk.CTkFrame(c_wrap, fg_color="transparent")
                c_line.grid(row=c_idx, column=0, padx=0, pady=3, sticky="ew")
                c_line.grid_columnconfigure(0, weight=1)

                # Choice letter next to choice text
                choice_text = f"{code}) {c.get('text', '')}"
                ctk.CTkLabel(c_line, text=choice_text,
                             font=("Segoe UI", 12), text_color="#374151",
                             wraplength=480, justify=jv, anchor=ta
                             ).grid(row=0, column=0, sticky=("e" if rtl else "w"))

        elif q_type == "essay":
            ans_area = ctk.CTkFrame(parent, fg_color="transparent", border_color="#CBD5E1",
                                    border_width=1, corner_radius=6)
            ans_area.grid(row=1, column=col, pady=(0, 14), sticky="ew", padx=(4, 10))
            ctk.CTkLabel(ans_area, text=f"   {L['answer_space']}",
                         font=("Segoe UI", 10, "bold"), text_color=self.accent, anchor=ta
                         ).pack(fill="x", padx=10, pady=(8, 4), anchor=ta)
            lines = ("—" * 110 + "\n") * 3
            ctk.CTkLabel(ans_area, text=lines, font=("Segoe UI", 6),
                         text_color="#D1D5DB", justify=jv).pack(fill="x", padx=10, pady=(0, 10))

        elif q_type == "true_false":
            tf_wrap = ctk.CTkFrame(parent, fg_color="transparent")
            tf_wrap.grid(row=1, column=col, pady=(0, 14), sticky=ta, padx=(4, 10))

            codes = ["أ", "ب"] if rtl else ["A", "B"]
            choices = [L["true"], L["false"]]
            
            for idx, (code, choice_text) in enumerate(zip(codes, choices)):
                choice_label = f"{code}) {choice_text}"
                ctk.CTkLabel(tf_wrap, text=choice_label,
                             font=("Segoe UI", 12), text_color="#374151",
                             anchor=ta).pack(side=("right" if rtl else "left"), padx=(0, 16) if idx == 0 else (0, 0))

    def _footer_classic(self, paper, rtl, L):
        ft = ctk.CTkFrame(paper, fg_color="transparent")
        ft.pack(fill="x", padx=36, pady=(4, 28))
        ctk.CTkFrame(ft, height=2, fg_color=self.accent, corner_radius=2).pack(fill="x", pady=(0, 12))
        ft_inner = ctk.CTkFrame(ft, fg_color="transparent")
        ft_inner.pack(fill="x")
        ft_inner.grid_columnconfigure(1, weight=1)

        pg_col = 0 if rtl else 2
        w_col = 2 if rtl else 0
        pg_sticky = "w" if rtl else "e"
        w_sticky = "e" if rtl else "w"

        ctk.CTkLabel(ft_inner, text=f"{L['page_of']} 1 / 1",
                     font=("Segoe UI", 9), text_color="#6B7280", anchor=pg_sticky
                     ).grid(row=0, column=pg_col, sticky=pg_sticky)
        ctk.CTkLabel(ft_inner, text=L["footer_wish"],
                     font=("Segoe UI", 9), text_color="#6B7280", anchor=w_sticky
                     ).grid(row=0, column=w_col, sticky=w_sticky)

    # =========================================================
    #  LAYOUT 2 - MODERN TWO-COLUMN (paper saver, magazine-style
    #              cards, accent-colored side bands, two questions
    #              side by side where possible)
    # =========================================================
    def _render_modern_split(self):
        rtl, ta, jv = self._rtl_helpers()
        L = self._L()

        paper = ctk.CTkFrame(self, fg_color="#FFFFFF", border_color=self.accent, border_width=2, corner_radius=10)
        paper.pack(fill="x", padx=28, pady=24)
        paper.grid_columnconfigure(0, weight=1)
        paper.grid_columnconfigure(1, weight=1)

        # Header: magazine style with big accent tile on one edge
        header = ctk.CTkFrame(paper, fg_color=self.accent, corner_radius=0)
        header.pack(fill="x")
        header.grid_columnconfigure(0, weight=1)
        header.grid_columnconfigure(1, weight=1)
        header.grid_columnconfigure(2, weight=1)

        if rtl:
            tch_c, tit_c, pl_c = 2, 1, 0
        else:
            tch_c, tit_c, pl_c = 0, 1, 2

        tch = ctk.CTkFrame(header, fg_color="transparent")
        tch.grid(row=0, column=tch_c, padx=20, pady=16, sticky=("e" if rtl else "w"))
        ctk.CTkLabel(tch, text=TeacherProfile.NAME_AR if rtl else TeacherProfile.NAME_EN,
                     font=("Segoe UI", 12, "bold"), text_color="#FFFFFF", anchor=ta).pack(anchor=ta)
        ctk.CTkLabel(tch, text=TeacherProfile.TITLE_AR if rtl else TeacherProfile.TITLE_EN,
                     font=("Segoe UI", 9), text_color="#DBEAFE", anchor=ta).pack(anchor=ta)
        ctk.CTkLabel(tch, text=TeacherProfile.CENTER_AR if rtl else TeacherProfile.CENTER_EN,
                     font=("Segoe UI", 9), text_color="#DBEAFE", anchor=ta).pack(anchor=ta)

        ctr = ctk.CTkFrame(header, fg_color="#FFFFFF", corner_radius=8)
        ctr.grid(row=0, column=tit_c, padx=10, pady=10, sticky="nsew")
        ctr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(ctr, text=self.exam_data.get("name", "اختبار مادة الفيزياء"),
                     font=("Segoe UI", 15, "bold"), text_color=self.accent, anchor="center"
                     ).grid(row=0, column=0, pady=(10, 4), sticky="ew")
        subj_txt = f"{L['subject_label']}: {self.exam_data.get('subject', 'الفيزياء')}   •   {L['duration_label']}: {self.exam_data.get('duration', '90 دقيقة')}   •   {L['model_label']}: {self.exam_data.get('model_name', self.model_code)}"
        ctk.CTkLabel(ctr, text=subj_txt, font=("Segoe UI", 10), text_color="#374151", anchor="center"
                     ).grid(row=1, column=0, pady=(0, 10), sticky="ew")

        # Student info: compact inline row
        meta = ctk.CTkFrame(paper, fg_color="#F8FAFC", corner_radius=0)
        meta.pack(fill="x")
        meta.grid_columnconfigure((0, 1, 2), weight=1)

        def compact_field(label, col, sticky):
            inner = ctk.CTkFrame(meta, fg_color="transparent")
            inner.grid(row=0, column=col, padx=18, pady=10, sticky=sticky)
            ctk.CTkLabel(inner, text=f"{label}:", font=("Segoe UI", 9, "bold"),
                         text_color=self.accent, anchor=ta).pack(anchor=ta)
            ctk.CTkLabel(inner, text="__________________________",
                         font=("Segoe UI", 9), text_color="#64748B", anchor=ta).pack(anchor=ta)

        if rtl:
            compact_field(L["student_name"], 2, "e")
            compact_field(L["group_hall"], 0, "w")
        else:
            compact_field(L["student_name"], 0, "w")
            compact_field(L["group_hall"], 2, "e")

        # Instructions: small pill
        self._instructions_compact(paper, ta, jv, L)

        # Questions section title
        self._section_title(paper, L["questions_title"], ta, rtl)

        # Two-column questions grid
        q_container = ctk.CTkFrame(paper, fg_color="transparent")
        q_container.pack(fill="x", padx=28, pady=(0, 20))
        q_container.grid_columnconfigure(0, weight=1)
        q_container.grid_columnconfigure(1, weight=1)

        for idx, q in enumerate(self.questions):
            col = idx % 2
            row = idx // 2
            self._modern_tile_question(q_container, idx, q, col, row, ta, jv, rtl, L)

        self._footer_simple(paper, rtl, L)

    def _instructions_compact(self, paper, ta, jv, L):
        inst_text = self.exam_data.get("instructions") or L["instructions_default"]
        wrap = ctk.CTkFrame(paper, fg_color="transparent")
        wrap.pack(fill="x", padx=36, pady=(16, 0))
        tag = ctk.CTkFrame(wrap, fg_color="#F1F5F9", corner_radius=10)
        tag.pack(fill="x")
        tag.grid_columnconfigure(1, weight=1)
        ic = ctk.CTkFrame(tag, fg_color=self.accent, corner_radius=10)
        ic.grid(row=0, column=0 if not ta else 0, rowspan=2, padx=(0, 12), sticky="nsew")
        ctk.CTkLabel(ic, text="ℹ️", font=("Segoe UI", 18)).pack(padx=16, pady=12)
        ctk.CTkLabel(tag, text=L["instructions_title"], font=("Segoe UI", 11, "bold"),
                     text_color=self.accent, anchor=ta
                     ).grid(row=0, column=1, padx=12, pady=(12, 4), sticky=ta)
        ctk.CTkLabel(tag, text=inst_text, font=("Segoe UI", 9),
                     text_color="#475569", wraplength=560, justify=jv, anchor=ta
                     ).grid(row=1, column=1, padx=12, pady=(0, 12), sticky="ew")

    def _modern_tile_question(self, parent, idx, q, col, row, ta, jv, rtl, L):
        q_num = idx + 1
        marks = q.get("marks", 2)
        tile = ctk.CTkFrame(parent, fg_color="#FFFFFF", border_color="#E2E8F0",
                            border_width=1, corner_radius=10)
        pady_val = (0, 14)
        padx_col = (0, 7) if col == 0 else (7, 0)
        if not rtl:
            padx_col = (0, 7) if col == 0 else (7, 0)
        tile.grid(row=row, column=col, padx=padx_col, pady=pady_val, sticky="nsew")
        tile.grid_columnconfigure(1, weight=1)

        # Number circle (colored)
        num_col = 2 if rtl else 0
        marks_col = 0 if rtl else 2
        num_frame = ctk.CTkFrame(tile, fg_color=self.accent, width=38, height=38, corner_radius=19)
        num_frame.grid(row=0, column=num_col, rowspan=2, padx=(10, 0) if rtl else (0, 10), pady=10, sticky="n")
        num_frame.grid_propagate(False)
        ctk.CTkLabel(num_frame, text=f"{q_num}", font=("Segoe UI", 14, "bold"),
                     text_color="#FFFFFF").place(relx=0.5, rely=0.5, anchor="center")

        # Marks mini badge
        marks_soft = self._shade_color(self.accent, 0.94)
        marks_frame2 = ctk.CTkFrame(tile, fg_color=marks_soft, corner_radius=14)
        marks_frame2.grid(row=0, column=marks_col, rowspan=2, padx=(0, 10) if rtl else (10, 0), pady=10, sticky="n")
        ctk.CTkLabel(marks_frame2, text=f"✦ {marks}", font=("Segoe UI", 10, "bold"),
                     text_color=self.accent).pack(padx=10, pady=5)

        # Text + choices container
        text_col = 1
        tile_body = ctk.CTkFrame(tile, fg_color="transparent")
        tile_body.grid(row=0, column=text_col, rowspan=2, padx=(4, 4), pady=(10, 10), sticky="ew")

        ctk.CTkLabel(tile_body, text=q.get("text", ""), font=("Segoe UI", 11, "bold"),
                     text_color="#0F172A", wraplength=240, justify=jv, anchor=ta
                     ).pack(fill="x", pady=(0, 4), anchor=ta)

        self._render_question_images(tile_body, q, max_w=200, max_h=90)

        q_type = q.get("question_type", "mcq")
        if q_type == "mcq" and q.get("choices"):
            c_wrap = ctk.CTkFrame(tile_body, fg_color="transparent")
            c_wrap.pack(fill="x", pady=(4, 0))
            c_wrap.grid_columnconfigure(0, weight=1)
            codes = ["أ", "ب", "ج", "د"] if rtl else ["A", "B", "C", "D"]
            for c_idx, c in enumerate(q.get("choices", [])[:4]):
                code = codes[c_idx]
                line = ctk.CTkFrame(c_wrap, fg_color="transparent")
                line.pack(fill="x", pady=1)
                line.grid_columnconfigure(1, weight=1)
                mark = ctk.CTkFrame(line, width=16, height=16, corner_radius=8,
                                    fg_color="#FFFFFF", border_color=self.accent, border_width=1)
                mark.grid(row=0, column=0, padx=(0, 6), sticky=ta)
                mark.grid_propagate(False)
                ctk.CTkLabel(mark, text=code, font=("Segoe UI", 8, "bold"),
                             text_color=self.accent).place(relx=0.5, rely=0.5, anchor="center")
                ctk.CTkLabel(line, text=c.get("text", ""),
                             font=("Segoe UI", 9), text_color="#334155",
                             wraplength=190, justify=jv, anchor=ta
                             ).grid(row=0, column=1, sticky=ta)
        elif q_type == "true_false":
            tf_line = ctk.CTkFrame(tile_body, fg_color="transparent")
            tf_line.pack(fill="x", pady=(4, 0), anchor=ta)

            def mini_box(t, sym, s, bg, bd, tc):
                f = ctk.CTkFrame(tf_line, fg_color=bg, corner_radius=4, border_color=bd,
                                  border_width=1, width=70, height=26)
                f.pack(side=s, padx=(0, 4))
                f.pack_propagate(False)
                ctk.CTkLabel(f, text=f"{sym} {t}", font=("Segoe UI", 9),
                             text_color=tc).pack(pady=4)

            if rtl:
                mini_box(L["true"], "✓", "right", "#F0FDF4", "#86EFAC", "#166534")
                mini_box(L["false"], "✗", "right", "#FEF2F2", "#FECACA", "#991B1B")
            else:
                mini_box(L["true"], "✓", "left", "#F0FDF4", "#86EFAC", "#166534")
                mini_box(L["false"], "✗", "left", "#FEF2F2", "#FECACA", "#991B1B")
        else:
            ebox = ctk.CTkFrame(tile_body, fg_color="#F8FAFC", border_color="#CBD5E1",
                                border_width=1, corner_radius=4)
            ebox.pack(fill="x", pady=(4, 0))
            ctk.CTkLabel(ebox, text=f"[ {L['answer_space']} ]",
                         font=("Segoe UI", 8, "bold"), text_color="#64748B", anchor=ta
                         ).pack(padx=6, pady=8, anchor=ta)

    def _shade_color(self, hex_str, factor):
        h = hex_str.lstrip("#")
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        r, g, b = [int(max(0, min(255, c * factor))) for c in (r, g, b)]
        return f"#{r:02X}{g:02X}{b:02X}"

    def _footer_simple(self, paper, rtl, L):
        ft = ctk.CTkFrame(paper, fg_color="transparent")
        ft.pack(fill="x", padx=36, pady=(4, 24))
        ft.grid_columnconfigure(1, weight=1)

        pg_col = 0 if rtl else 2
        w_col = 2 if rtl else 0
        ctk.CTkLabel(ft, text=f"{L['page_of']} 1 / 1", font=("Segoe UI", 9),
                     text_color="#6B7280", anchor=("w" if rtl else "e")
                     ).grid(row=0, column=pg_col, sticky=("w" if rtl else "e"))
        ctk.CTkLabel(ft, text=L["footer_wish"], font=("Segoe UI", 9),
                     text_color="#6B7280", anchor=("e" if rtl else "w")
                     ).grid(row=0, column=w_col, sticky=("e" if rtl else "w"))

    # =========================================================
    #  LAYOUT 3 - COMPACT (dense, quizzes, minimal decoration)
    # =========================================================
    #  LAYOUT 4 - MINIMALIST CLEAN (Ministry-inspired monochrome format)
    # =========================================================
    def _render_simple_first(self):
        rtl, ta, jv = self._rtl_helpers()
        L = self._L()

        paper = ctk.CTkFrame(self, fg_color="#FFFFFF", border_color="#000000", border_width=1, corner_radius=0)
        paper.pack(fill="x", padx=28, pady=24)
        paper.grid_columnconfigure(0, weight=1)

        # Minimalist Header Bar
        header = ctk.CTkFrame(paper, fg_color="transparent")
        header.pack(fill="x", padx=22, pady=(16, 6))
        header.grid_columnconfigure((0, 1, 2), weight=1)
        left_col, center_col, right_col = (2, 1, 0) if rtl else (0, 1, 2)

        teacher = ctk.CTkFrame(header, fg_color="transparent")
        teacher.grid(row=0, column=left_col, sticky="e" if rtl else "w")
        ctk.CTkLabel(teacher, text=TeacherProfile.NAME_AR if rtl else TeacherProfile.NAME_EN,
                     font=("Times New Roman", 11, "bold"), text_color="#000000", anchor=ta).pack(anchor=ta)

        center = ctk.CTkFrame(header, fg_color="transparent")
        center.grid(row=0, column=center_col, sticky="nsew")
        ctk.CTkLabel(center, text=f"{self.exam_data.get('name', 'اختبار')} - {L['subject_label']}: {self.exam_data.get('subject', '')}",
                     font=("Times New Roman", 13, "bold"), text_color="#000000").pack()

        details = ctk.CTkFrame(header, fg_color="transparent")
        details.grid(row=0, column=right_col, sticky="w" if rtl else "e")
        ctk.CTkLabel(details, text=f"{L['model_label']}: {self.exam_data.get('model_name', self.model_code)} | {L['duration_label']}: {self.exam_data.get('duration', '')}",
                     font=("Times New Roman", 10, "bold"), text_color="#000000", anchor="w" if rtl else "e").pack(anchor="w" if rtl else "e")

        ctk.CTkFrame(paper, height=1, fg_color="#000000").pack(fill="x", padx=22, pady=(4, 8))

        # Underlined Student info
        info = ctk.CTkFrame(paper, fg_color="transparent")
        info.pack(fill="x", padx=22, pady=(0, 10))
        info.grid_columnconfigure((0, 1), weight=1)
        name_col, hall_col = (1, 0) if rtl else (0, 1)
        ctk.CTkLabel(info, text=f"{L['student_name']}: " + "_" * 32, font=("Times New Roman", 10), text_color="#000000", anchor=ta).grid(row=0, column=name_col, padx=4, pady=2, sticky="ew")
        ctk.CTkLabel(info, text=f"{L['group_hall']}: " + "_" * 20, font=("Times New Roman", 10), text_color="#000000", anchor=ta).grid(row=0, column=hall_col, padx=4, pady=2, sticky="ew")

        section = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color="#000000", border_width=1, corner_radius=0)
        section.pack(fill="x", padx=22, pady=(0, 0))
        ctk.CTkLabel(section, text=f"❖ {L['questions_title']}", font=("Times New Roman", 11, "bold"), text_color="#000000", anchor=ta).pack(fill="x", padx=8, pady=4)

        for index, question in enumerate(self.questions, start=1):
            self._render_official_question(paper, question, index, rtl, ta, jv, L, border_color="#000000")

        footer = ctk.CTkFrame(paper, fg_color="transparent")
        footer.pack(fill="x", padx=22, pady=(8, 14))
        ctk.CTkFrame(footer, height=1, fg_color="#000000").pack(fill="x", pady=(0, 4))
        ctk.CTkLabel(footer, text=f"{L['page_of']} 1", font=("Times New Roman", 9), text_color="#000000").pack()

    def _compact_question(self, parent, idx, q, ta, jv, rtl, L):
        q_num = idx + 1
        marks = q.get("marks", 1)
        q_type = q.get("question_type", "mcq")
        line = ctk.CTkFrame(parent, fg_color="transparent")
        line.pack(fill="x", pady=(0, 10))
        line.grid_columnconfigure(1, weight=1)

        num_txt = f"[{q_num}]"
        ctk.CTkLabel(line, text=num_txt, font=("Segoe UI", 11, "bold"),
                     text_color=self.accent, anchor=ta, width=40
                     ).grid(row=0, column=0 if not rtl else 2, rowspan=2, padx=(0, 8) if not rtl else (8, 0), sticky=ta)

        marks_lbl = ctk.CTkLabel(line, text=f"({marks})", font=("Segoe UI", 9, "bold"),
                                 text_color="#0F172A", anchor=ta, width=36)
        marks_lbl.grid(row=0, column=2 if not rtl else 0, rowspan=2, padx=(8, 0) if not rtl else (0, 8), sticky=ta)

        ctk.CTkLabel(line, text=q.get("text", ""), font=("Segoe UI", 11, "bold"),
                     text_color="#0F172A", wraplength=600, justify=jv, anchor=ta
                     ).grid(row=0, column=1, sticky="ew", pady=(0, 4))
        self._render_question_images(line, 1, q, rtl)

        if q_type == "mcq" and q.get("choices"):
            ch = ctk.CTkFrame(line, fg_color="transparent")
            ch.grid(row=1, column=1, sticky="ew")
            ch.grid_columnconfigure((0, 1), weight=1)
            codes = ["أ", "ب", "ج", "د"] if rtl else ["A", "B", "C", "D"]
            for c_idx, c in enumerate(q.get("choices", [])[:4]):
                code = codes[c_idx]
                col = c_idx % 2
                row = c_idx // 2
                cf = ctk.CTkFrame(ch, fg_color="transparent")
                cf.grid(row=row, column=col, pady=1, sticky="ew")
                cf.grid_columnconfigure(1, weight=1)
                ctk.CTkLabel(cf, text=f"  ( {code} )  ", font=("Segoe UI", 10, "bold"),
                             text_color=self.accent, anchor=ta
                             ).grid(row=0, column=0, sticky=ta)
                ctk.CTkLabel(cf, text=c.get("text", ""),
                             font=("Segoe UI", 10), text_color="#334155",
                             wraplength=270, justify=jv, anchor=ta
                             ).grid(row=0, column=1, sticky=("e" if rtl else "w"))

        elif q_type == "true_false":
            tf = ctk.CTkFrame(line, fg_color="transparent")
            tf.grid(row=1, column=1, sticky=ta)
            for t, s, tc in [(L["true"], "right" if rtl else "left", "#166534"),
                             (L["false"], "left" if rtl else "right", "#991B1B")]:
                f = ctk.CTkFrame(tf, fg_color="transparent", border_color="#334155",
                                 border_width=1, corner_radius=2, width=80, height=24)
                f.pack(side=s, padx=4)
                f.pack_propagate(False)
                ctk.CTkLabel(f, text=f"(  ) {t}", font=("Segoe UI", 9),
                             text_color=tc).pack()

        else:
            ans = ctk.CTkFrame(line, fg_color="transparent")
            ans.grid(row=1, column=1, sticky="ew", pady=(4, 0))
            lines = ("." * 90 + "\n") * 2
            ctk.CTkLabel(ans, text=lines, font=("Segoe UI", 4),
                         text_color="#94A3B8", justify=jv).pack(anchor=ta, fill="x")

    # =========================================================
    #  LAYOUT 4 - MINISTRY (double frame, official look, triple
    #              horizontal dividers, Arabic-only traditional style)
    # =========================================================
    def _render_ministry(self):
        rtl, ta, jv = self._rtl_helpers()
        L = self._L()

        # Thick outer box
        outer = ctk.CTkFrame(self, fg_color="#FFFFFF", border_color="#000000", border_width=4, corner_radius=0)
        outer.pack(fill="x", padx=28, pady=24)
        # Inner box 1
        inner = ctk.CTkFrame(outer, fg_color="#FFFFFF", border_color="#000000", border_width=2, corner_radius=0)
        inner.pack(fill="x", padx=10, pady=10)
        inner.grid_columnconfigure(0, weight=1)

        paper = inner

        # Ministry Header (triple-line layout: Teacher left, Logo center, Model right)
        header = ctk.CTkFrame(paper, fg_color="transparent")
        header.pack(fill="x", padx=24, pady=(24, 4))
        header.grid_columnconfigure(0, weight=1)
        header.grid_columnconfigure(1, weight=2)
        header.grid_columnconfigure(2, weight=1)

        if rtl:
            t_c, l_c, m_c = 2, 1, 0
            t_a, m_a = "e", "w"
        else:
            t_c, l_c, m_c = 0, 1, 2
            t_a, m_a = "w", "e"

        tcol = ctk.CTkFrame(header, fg_color="transparent")
        tcol.grid(row=0, column=t_c, sticky=t_a)
        ctk.CTkLabel(tcol, text=f"{L['teacher_label']}:  " + (TeacherProfile.NAME_AR if rtl else TeacherProfile.NAME_EN),
                     font=("Segoe UI", 12, "bold"), text_color="#111827", anchor=t_a).pack(anchor=t_a)
        ctk.CTkLabel(tcol, text=TeacherProfile.TITLE_AR if rtl else TeacherProfile.TITLE_EN,
                     font=("Segoe UI", 10), text_color="#111827", anchor=t_a).pack(anchor=t_a)
        ctk.CTkLabel(tcol, text=TeacherProfile.CENTER_AR if rtl else TeacherProfile.CENTER_EN,
                     font=("Segoe UI", 10), text_color="#111827", anchor=t_a).pack(anchor=t_a)

        # Center big title with heavy accent underline
        ctr = ctk.CTkFrame(header, fg_color="transparent")
        ctr.grid(row=0, column=l_c, sticky="nsew", padx=10)
        ctr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(ctr, text=self.exam_data.get("name", "ورقة امتحان مادة الفيزياء"),
                     font=("Segoe UI", 22, "bold"), text_color=self.accent, anchor="center"
                     ).grid(row=0, column=0, pady=(0, 4))
        ctk.CTkFrame(ctr, height=4, fg_color=self.accent, corner_radius=2
                     ).grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 6))
        subj_txt = f"{L['subject_label']}: {self.exam_data.get('subject', 'الفيزياء')}   •   {L['duration_label']}: {self.exam_data.get('duration', '90 دقيقة')}"
        ctk.CTkLabel(ctr, text=subj_txt, font=("Segoe UI", 12, "bold"),
                     text_color="#111827", anchor="center").grid(row=2, column=0)

        # Model number box (right-side in RTL, left in LTR)
        mcol = ctk.CTkFrame(header, fg_color=self.accent, corner_radius=4)
        mcol.grid(row=0, column=m_c, sticky=m_a)
        ctk.CTkLabel(mcol, text=f"{L['model_label']}  {self.exam_data.get('model_name', self.model_code)}",
                     font=("Segoe UI", 12, "bold"), text_color="#FFFFFF", anchor="center"
                     ).pack(padx=20, pady=14)

        # === Triple dividers ===
        self._triple_divider(paper)

        # === Student info in boxes with double lines ===
        self._ministry_student_info(paper, ta, rtl, L)

        # === Instructions: double-framed ===
        inst_text = self.exam_data.get("instructions") or L["instructions_default"]
        outer_inst = ctk.CTkFrame(paper, fg_color="transparent", border_color="#000000",
                                  border_width=2, corner_radius=0)
        outer_inst.pack(fill="x", padx=32, pady=(16, 0))
        inner_inst = ctk.CTkFrame(outer_inst, fg_color="#F8FAFC", border_color="#000000",
                                  border_width=1, corner_radius=0)
        inner_inst.pack(fill="x", padx=4, pady=4)
        inner_inst.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(inner_inst, text="☰", font=("Segoe UI", 20, "bold"), text_color=self.accent
                     ).grid(row=0, column=0, rowspan=2, padx=(10, 10), sticky=ta)
        ctk.CTkLabel(inner_inst, text=L["instructions_title"], font=("Segoe UI", 12, "bold"),
                     text_color="#111827", anchor=ta
                     ).grid(row=0, column=1, padx=10, pady=(8, 2), sticky=ta)
        ctk.CTkLabel(inner_inst, text=inst_text, font=("Segoe UI", 10),
                     text_color="#111827", wraplength=620, justify=jv, anchor=ta
                     ).grid(row=1, column=1, padx=10, pady=(0, 8), sticky="ew")

        # === QUESTIONS SECTION ===
        self._section_title(paper, L["questions_title"], ta, rtl)

        for idx, q in enumerate(self.questions):
            self._ministry_question(paper, idx, q, ta, jv, rtl, L)

        self._triple_divider(paper, pady=(10, 10))

        # Footer
        ft = ctk.CTkFrame(paper, fg_color="transparent")
        ft.pack(fill="x", padx=32, pady=(4, 20))
        ft.grid_columnconfigure(1, weight=1)
        pg_col = 0 if rtl else 2
        w_col = 2 if rtl else 0
        ctk.CTkLabel(ft, text=f"{L['page_of']} 1 / 1", font=("Segoe UI", 9, "bold"),
                     text_color="#111827", anchor=("w" if rtl else "e")
                     ).grid(row=0, column=pg_col, sticky=("w" if rtl else "e"))
        ctk.CTkLabel(ft, text=L["footer_wish"], font=("Segoe UI", 9),
                     text_color="#111827", anchor=("e" if rtl else "w")
                     ).grid(row=0, column=w_col, sticky=("e" if rtl else "w"))

    def _triple_divider(self, paper, pady=(10, 0)):
        wrap = ctk.CTkFrame(paper, fg_color="transparent")
        wrap.pack(fill="x", padx=32, pady=pady)
        ctk.CTkFrame(wrap, height=3, fg_color="#000000").pack(fill="x")
        ctk.CTkFrame(wrap, height=2, fg_color="transparent").pack(fill="x")
        ctk.CTkFrame(wrap, height=2, fg_color=self.accent).pack(fill="x")
        ctk.CTkFrame(wrap, height=2, fg_color="transparent").pack(fill="x")
        ctk.CTkFrame(wrap, height=1, fg_color="#000000").pack(fill="x")

    def _ministry_student_info(self, paper, ta, rtl, L):
        meta = ctk.CTkFrame(paper, fg_color="transparent")
        meta.pack(fill="x", padx=32, pady=(12, 0))
        meta.grid_columnconfigure((0, 1), weight=1)

        def ministry_field(label, col):
            outer = ctk.CTkFrame(meta, fg_color="transparent", border_color="#000000",
                                 border_width=2, corner_radius=0)
            outer.grid(row=0, column=col, padx=4, sticky="nsew")
            outer_inner = ctk.CTkFrame(outer, fg_color="transparent", border_color="#000000",
                                       border_width=1, corner_radius=0)
            outer_inner.pack(fill="x", padx=3, pady=3)
            ctk.CTkLabel(outer_inner, text=f"    {label}    ", font=("Segoe UI", 10, "bold"),
                         text_color="#FFFFFF", fg_color=self.accent, anchor=ta).pack(fill="x", pady=(6, 6))
            ctk.CTkLabel(outer_inner, text=" " * 80,
                         font=("Segoe UI", 12), text_color="#0F172A", anchor=ta
                         ).pack(padx=10, pady=12, anchor=ta)
            ctk.CTkFrame(outer_inner, height=2, fg_color="#000000").pack(fill="x", padx=10, pady=(0, 10))

        if rtl:
            ministry_field(L["student_name"], 1)
            ministry_field(L["group_hall"], 0)
        else:
            ministry_field(L["student_name"], 0)
            ministry_field(L["group_hall"], 1)

    def _ministry_question(self, paper, idx, q, ta, jv, rtl, L):
        q_row = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color="#000000",
                             border_width=1, corner_radius=0)
        q_row.pack(fill="x", padx=32, pady=(0, 12))
        q_row.grid_columnconfigure(1, weight=1)

        q_num = idx + 1
        marks = q.get("marks", 2)
        q_type = q.get("question_type", "mcq")

        num_col = 2 if rtl else 0
        marks_col = 0 if rtl else 2

        num = ctk.CTkFrame(q_row, fg_color=self.accent, corner_radius=0, width=62)
        num.grid(row=0, column=num_col, rowspan=3, padx=(0, 0) if rtl else (0, 0), pady=0, sticky="ns")
        num.grid_propagate(False)
        ctk.CTkLabel(num, text=f"سؤال", font=("Segoe UI", 9),
                     text_color="#FFFFFF").pack(pady=(10, 0))
        ctk.CTkLabel(num, text=f"{q_num:02d}", font=("Segoe UI", 22, "bold"),
                     text_color="#FFFFFF").pack()
        ctk.CTkFrame(num, height=1, fg_color="#FFFFFF").pack(fill="x", padx=10, pady=4)
        ctk.CTkLabel(num, text=f"{marks} {L['marks_unit']}", font=("Segoe UI", 9, "bold"),
                     text_color="#FFFFFF").pack(pady=(0, 10))

        # Marks label on other side (ministry has marks in square box)
        box_mark = ctk.CTkFrame(q_row, fg_color=self.accent, corner_radius=0, width=56)
        box_mark.grid(row=0, column=marks_col, rowspan=3, padx=(0, 0), sticky="ns")
        box_mark.grid_propagate(False)
        ctk.CTkLabel(box_mark, text=L["marks_title"], font=("Segoe UI", 10, "bold"),
                     text_color="#FFFFFF").pack(pady=(12, 2))
        ctk.CTkFrame(box_mark, height=1, fg_color="#FFFFFF").pack(fill="x", padx=8, pady=4)
        ctk.CTkLabel(box_mark, text=f"{marks}", font=("Segoe UI", 18, "bold"),
                     text_color="#FFFFFF").pack()

        # Text area
        ctk.CTkLabel(q_row, text=q.get("text", ""),
                     font=("Segoe UI", 13, "bold"), text_color="#0F172A",
                     wraplength=520, justify=jv, anchor=ta
                     ).grid(row=0, column=1, padx=12, pady=(14, 10), sticky="ew")
        self._render_question_images(q_row, 1, q, rtl)

        self._render_choices(q_row, 1, q, q_type, ta, jv, rtl, L, classic=True)

    # =========================================================
    #  LAYOUT 5 - SIMPLE FIRST (Black and white, no colors, for first model)
    # =========================================================
    def _render_simple_first(self):
        rtl, ta, jv = self._rtl_helpers()
        L = self._L()

        paper = ctk.CTkFrame(self, fg_color="#FFFFFF", border_color="#000000", border_width=2, corner_radius=0)
        paper.pack(fill="x", padx=28, pady=24)
        paper.grid_columnconfigure(0, weight=1)

        # === HEADER ===
        header = ctk.CTkFrame(paper, fg_color="transparent")
        header.pack(fill="x", padx=20, pady=(20, 8))
        header.grid_columnconfigure(0, weight=1)
        header.grid_columnconfigure(1, weight=0)
        header.grid_columnconfigure(2, weight=1)

        if rtl:
            tch_col, tt_col, place_col = 2, 1, 0
            tch_align, tt_align, place_align = "e", "center", "w"
        else:
            tch_col, tt_col, place_col = 0, 1, 2
            tch_align, tt_align, place_align = "w", "center", "e"

        # Teacher info
        tch = ctk.CTkFrame(header, fg_color="transparent")
        tch.grid(row=0, column=tch_col, sticky=tch_align)
        ctk.CTkLabel(tch, text=TeacherProfile.NAME_AR if rtl else TeacherProfile.NAME_EN,
                     font=("Times New Roman", 12, "bold"), text_color="#000000", anchor=tch_align).pack(anchor=tch_align)
        ctk.CTkLabel(tch, text=f"{L['teacher_label']}: " + (TeacherProfile.TITLE_AR if rtl else TeacherProfile.TITLE_EN),
                     font=("Times New Roman", 10), text_color="#000000", anchor=tch_align).pack(anchor=tch_align)

        # Title center
        ctr = ctk.CTkFrame(header, fg_color="transparent")
        ctr.grid(row=0, column=tt_col, padx=10, sticky="nsew")
        ctr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(ctr, text=self.exam_data.get("name", "اختبار مادة الفيزياء"),
                     font=("Times New Roman", 16, "bold"), text_color="#000000", anchor="center").grid(row=0, column=0, pady=(0, 6), sticky="ew")
        meta_row = ctk.CTkFrame(ctr, fg_color="transparent", corner_radius=0)
        meta_row.grid(row=1, column=0, pady=2)
        subj_txt = f"{L['subject_label']}: {self.exam_data.get('subject', 'الفيزياء')}   •   {L['duration_label']}: {self.exam_data.get('duration', '90 دقيقة')}   •   {L['model_label']}: {self.exam_data.get('model_name', f'النموذج {self.model_code}')}"
        ctk.CTkLabel(meta_row, text=subj_txt, font=("Times New Roman", 10, "bold"),
                     text_color="#000000").pack(padx=10, pady=4)

        # Right-side (RTL) placeholder balance (empty)
        ctk.CTkFrame(header, fg_color="transparent").grid(row=0, column=place_col, sticky=place_align)

        # Black divider
        ctk.CTkFrame(paper, height=2, fg_color="#000000", corner_radius=0).pack(fill="x", padx=20, pady=(10, 0))

        # === STUDENT INFO (simple lines) ===
        self._simple_student_info(paper, ta, rtl, L)

        # === INSTRUCTIONS (simple box) ===
        self._simple_instructions(paper, ta, jv, L)

        # === QUESTIONS SECTION HEADER ===
        self._simple_section_title(paper, L["questions_title"], ta, rtl)

        # === QUESTIONS (simple without colors) ===
        for idx, q in enumerate(self.questions):
            self._render_official_question(paper, q, idx + 1, rtl, ta, jv, L, border_color="#000000")

        # === FOOTER (simple line) ===
        self._simple_footer(paper, rtl, L)

    def _simple_student_info(self, paper, ta, rtl, L):
        meta = ctk.CTkFrame(paper, fg_color="transparent")
        meta.pack(fill="x", padx=20, pady=(12, 0))
        meta.grid_columnconfigure((0, 1), weight=1)

        def field(label, col):
            col0, col1 = (0, 1) if rtl else (1, 0)
            outer = ctk.CTkFrame(meta, fg_color="transparent")
            outer.grid(row=0, column=col, padx=(4, 4), sticky="nsew")
            
            ctk.CTkLabel(outer, text=label, font=("Times New Roman", 10, "bold"),
                         text_color="#000000", anchor=ta).pack(anchor=ta, padx=(0, 4), pady=2)
            ctk.CTkFrame(outer, height=1, fg_color="#000000").pack(fill="x")

        if rtl:
            field(L["student_name"], 1)
            field(L["group_hall"], 0)
        else:
            field(L["student_name"], 0)
            field(L["group_hall"], 1)

    def _simple_instructions(self, paper, ta, jv, L):
        inst_text = self.exam_data.get("instructions") or L["instructions_default"]
        
        inst = ctk.CTkFrame(paper, fg_color="#FFFFFF", corner_radius=0, border_color="#000000", border_width=1)
        inst.pack(fill="x", padx=20, pady=(12, 0))
        
        ctk.CTkLabel(inst, text=L["instructions_title"], font=("Times New Roman", 11, "bold"),
                     text_color="#000000", anchor=ta).pack(anchor=ta, padx=8, pady=(4, 2))
        ctk.CTkFrame(inst, height=1, fg_color="#000000").pack(fill="x", padx=8)
        ctk.CTkLabel(inst, text=inst_text, font=("Times New Roman", 10),
                     text_color="#000000", wraplength=700, justify=jv, anchor=ta).pack(padx=8, pady=6)

    def _simple_section_title(self, paper, title_text, ta, rtl):
        qs_title = ctk.CTkFrame(paper, fg_color="transparent")
        qs_title.pack(fill="x", padx=20, pady=(16, 10))
        
        ctk.CTkLabel(qs_title, text=title_text, font=("Times New Roman", 14, "bold"),
                           text_color="#000000", anchor=ta).pack(anchor=ta)
        ctk.CTkFrame(qs_title, height=2, fg_color="#000000", corner_radius=0
                     ).pack(fill="x", pady=(4, 0))

    def _simple_question(self, paper, idx, q, ta, jv, rtl, L):
        q_row = ctk.CTkFrame(paper, fg_color="#FFFFFF", border_color="#000000",
                             border_width=1, corner_radius=0)
        q_row.pack(fill="x", padx=20, pady=(0, 12))
        q_row.grid_columnconfigure(1, weight=1)

        q_type = q.get("question_type", "mcq")
        q_num = idx + 1
        marks = q.get("marks", 2)

        # Question number and text
        q_text = f"{q_num}. {q.get('text', '')} [{marks} {L['marks_unit']}]"
        ctk.CTkLabel(q_row, text=q_text, font=("Times New Roman", 12), text_color="#000000",
                     wraplength=700, justify=jv, anchor=ta).pack(anchor=ta, padx=8, pady=8)
        self._render_question_images(q_row, q, max_w=340, max_h=120)

        # Choices
        self._render_choices(q_row, 0, q, q_type, ta, jv, rtl, L, classic=False)

    def _simple_footer(self, paper, rtl, L):
        ft = ctk.CTkFrame(paper, fg_color="transparent")
        ft.pack(fill="x", padx=20, pady=(8, 16))
        ctk.CTkFrame(ft, height=1, fg_color="#000000", corner_radius=0).pack(fill="x", pady=(0, 8))
        ctk.CTkLabel(ft, text=L["footer_wish"],
                     font=("Times New Roman", 9), text_color="#000000", anchor="center"
                     ).pack()

    # =========================================================
    #  LAYOUT 6 - SIMPLE LAST (Black and white, no colors, for last model)
    # =========================================================
    def _render_simple_last(self):
        # Use the same as simple_first for now
        self._render_simple_first()

