# Reusable Modal Dialogs System
import os
import shutil
import uuid
import customtkinter as ctk
from typing import Optional, Callable, Dict, Any, List
from app.config.theme import Theme
from app.config.i18n import t
from app.ui.components.buttons import PrimaryButton, SecondaryButton, OutlineButton, DangerButton, GhostButton
from app.ui.components.form_controls import FormEntry, FormDropdown, FormTextArea, FormSpinBox
from app.ui.components.cards import Badge

class BaseModal(ctk.CTkToplevel):
    def __init__(
        self,
        parent,
        title: str,
        width: int = 600,
        height: int = 500,
        **kwargs
    ):
        super().__init__(parent, **kwargs)
        self.title(title)
        self.geometry(f"{width}x{height}")
        self.resizable(False, False)
        self.configure(fg_color=Theme.BG_CARD)

        # Center on parent
        self.transient(parent)
        self.grab_set()

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # Modal Header
        self.header = ctk.CTkFrame(self, height=54, corner_radius=0, fg_color=Theme.BG_CARD_ALT)
        self.header.grid(row=0, column=0, sticky="ew")
        self.header.grid_columnconfigure(0, weight=1)

        self.title_lbl = ctk.CTkLabel(
            self.header,
            text=title,
            font=Theme.title_font(16),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        self.title_lbl.grid(row=0, column=0, padx=20, pady=12, sticky="w")

        self.close_btn = ctk.CTkButton(
            self.header,
            text="✕",
            width=32,
            height=32,
            corner_radius=Theme.CORNER_RADIUS_SM,
            fg_color="transparent",
            hover_color=Theme.BG_HOVER,
            text_color=Theme.TEXT_SECONDARY,
            font=Theme.bold_font(14),
            command=self.destroy
        )
        self.close_btn.grid(row=0, column=1, padx=12, pady=10)

        # Body Frame
        self.body = ctk.CTkScrollableFrame(self, fg_color="transparent", corner_radius=0)
        self.body.grid(row=1, column=0, sticky="nsew", padx=20, pady=12)
        self.body.grid_columnconfigure(0, weight=1)

        # Footer Frame
        self.footer = ctk.CTkFrame(self, height=60, corner_radius=0, fg_color=Theme.BG_CARD_ALT)
        self.footer.grid(row=2, column=0, sticky="ew")

        self.bind_all("<MouseWheel>", self._on_modal_mousewheel, add="+")

    def _on_modal_mousewheel(self, event):
        try:
            x, y = self.winfo_pointerx(), self.winfo_pointery()
            widget = self.winfo_containing(x, y)
            delta = event.delta
            if delta == 0:
                return
            step = -1 if delta > 0 else 1
            scroll_units = int(-1 * (delta / 120) * 3) if abs(delta) >= 120 else step
            while widget:
                if hasattr(widget, "_parent_canvas"):
                    widget._parent_canvas.yview_scroll(scroll_units, "units")
                    break
                elif isinstance(widget, ctk.CTkScrollableFrame):
                    widget._parent_canvas.yview_scroll(scroll_units, "units")
                    break
                elif isinstance(widget, ctk.CTkCanvas):
                    widget.yview_scroll(scroll_units, "units")
                    break
                widget = getattr(widget, "master", None)
        except Exception:
            pass

class ConfirmDialog(BaseModal):
    def __init__(
        self,
        parent,
        title: str,
        message: str,
        confirm_text: str = "تأكيد",
        cancel_text: str = "إلغاء",
        is_danger: bool = False,
        on_confirm: Optional[Callable[[], None]] = None
    ):
        super().__init__(parent, title=title, width=460, height=230)
        self.on_confirm = on_confirm

        msg_lbl = ctk.CTkLabel(
            self.body,
            text=message,
            font=Theme.body_font(14),
            text_color=Theme.TEXT_PRIMARY,
            wraplength=400,
            justify="center"
        )
        msg_lbl.pack(pady=20)

        # Footer buttons
        btn_box = ctk.CTkFrame(self.footer, fg_color="transparent")
        btn_box.pack(side="right", padx=16, pady=12)

        cancel_btn = OutlineButton(btn_box, text=cancel_text, width=90, command=self.destroy)
        cancel_btn.pack(side="right", padx=6)

        if is_danger:
            confirm_btn = DangerButton(btn_box, text=confirm_text, width=100, command=self._handle_confirm)
        else:
            confirm_btn = PrimaryButton(btn_box, text=confirm_text, width=100, command=self._handle_confirm)
        confirm_btn.pack(side="right", padx=6)

    def _handle_confirm(self):
        if self.on_confirm:
            self.on_confirm()
        self.destroy()

class AddEditQuestionModal(BaseModal):
    def __init__(
        self,
        parent,
        chapters: List[str],
        sources: List[str],
        question_data: Optional[Dict[str, Any]] = None,
        on_save: Optional[Callable[[Dict[str, Any]], None]] = None
    ):
        is_edit = question_data is not None
        title = t("modal_edit_question_title") if is_edit else t("modal_add_question_title")
        super().__init__(parent, title=title, width=680, height=680)
        
        self.question_data = question_data or {}
        self.on_save = on_save
        self.chapters = chapters or ["الفصل الأول: التيار الكهربي", "الفصل الثاني: التأثير المغناطيسي", "الفصل الثالث: الحث الكهرومغناطيسي"]
        self.sources = sources or ["كتاب الوزارة المعتمد", "مذكرات وسلسلة الأستاذ أحمد فؤاد الشاملة"]

        existing_imgs = self.question_data.get("image_paths", []) or []
        if not existing_imgs and self.question_data.get("image_path"):
            existing_imgs = [self.question_data.get("image_path")]
        self.attached_image_path = existing_imgs[0] if existing_imgs else None

        self._build_form()

    def _build_form(self):
        # Question Statement
        self.text_input = FormTextArea(
            self.body,
            label=t("field_q_text"),
            initial_value=self.question_data.get("text", ""),
            height=90
        )
        self.text_input.pack(fill="x", pady=(0, 12))

        # Optional Image Attachment Control
        img_section = ctk.CTkFrame(self.body, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_SM)
        img_section.pack(fill="x", pady=(0, 12))

        img_header = ctk.CTkFrame(img_section, fg_color="transparent")
        img_header.pack(fill="x", padx=12, pady=8)

        img_lbl = ctk.CTkLabel(
            img_header,
            text="إضافة صورة مرفقة بالسؤال (اختياري)",
            font=Theme.bold_font(12),
            text_color=Theme.TEXT_PRIMARY
        )
        img_lbl.pack(side="right")

        self.pick_img_btn = SecondaryButton(
            img_header,
            text="📷 اختيار صورة",
            width=130,
            command=self._pick_image
        )
        self.pick_img_btn.pack(side="left")

        self.img_preview_box = ctk.CTkFrame(img_section, fg_color="transparent")
        self.img_preview_box.pack(fill="x", padx=12, pady=(0, 8))

        self._render_image_preview()

        # Row 1: Type & Difficulty
        r1 = ctk.CTkFrame(self.body, fg_color="transparent")
        r1.pack(fill="x", pady=(0, 12))
        r1.grid_columnconfigure((0, 1), weight=1)

        type_options = ["mcq", "essay", "true_false"]
        type_labels = [t("type_mcq"), t("type_essay"), t("type_true_false")]
        self.type_dropdown = FormDropdown(
            r1,
            label=t("field_q_type"),
            values=type_labels,
            default_value=type_labels[0] if not self.question_data else type_labels[type_options.index(self.question_data.get("question_type", "mcq"))],
            command=self._on_type_changed
        )
        self.type_dropdown.grid(row=0, column=0, padx=(0, 6), sticky="ew")

        diff_options = ["easy", "medium", "hard"]
        diff_labels = [t("diff_easy"), t("diff_medium"), t("diff_hard")]
        curr_diff = self.question_data.get("difficulty", "medium")
        self.diff_dropdown = FormDropdown(
            r1,
            label=t("field_q_diff"),
            values=diff_labels,
            default_value=diff_labels[diff_options.index(curr_diff)] if curr_diff in diff_options else diff_labels[1]
        )
        self.diff_dropdown.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        # Row 2: Chapter & Source
        r2 = ctk.CTkFrame(self.body, fg_color="transparent")
        r2.pack(fill="x", pady=(0, 12))
        r2.grid_columnconfigure((0, 1), weight=1)

        self.chapter_dropdown = FormDropdown(
            r2,
            label=t("field_q_chapter"),
            values=self.chapters,
            default_value=self.question_data.get("chapter", self.chapters[0] if self.chapters else "")
        )
        self.chapter_dropdown.grid(row=0, column=0, padx=(0, 6), sticky="ew")

        self.source_dropdown = FormDropdown(
            r2,
            label=t("field_q_source"),
            values=self.sources,
            default_value=self.question_data.get("source", self.sources[0] if self.sources else "")
        )
        self.source_dropdown.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        # Row 3: Tags & Marks
        r3 = ctk.CTkFrame(self.body, fg_color="transparent")
        r3.pack(fill="x", pady=(0, 12))
        r3.grid_columnconfigure(0, weight=3)
        r3.grid_columnconfigure(1, weight=1)

        tags_str = ",".join(self.question_data.get("tags", [])) if isinstance(self.question_data.get("tags"), list) else self.question_data.get("tags", "")
        self.tags_entry = FormEntry(
            r3,
            label=t("field_q_tags"),
            placeholder=t("field_q_tags_ph"),
            initial_value=tags_str
        )
        self.tags_entry.grid(row=0, column=0, padx=(0, 6), sticky="ew")

        self.marks_spinbox = FormSpinBox(
            r3,
            label="الدرجة المخصصة",
            initial_value=self.question_data.get("marks", 2),
            min_value=1,
            max_value=10
        )
        self.marks_spinbox.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        # Dynamic Choices Container (for MCQ)
        self.choices_container = ctk.CTkFrame(self.body, fg_color="transparent")
        self.choices_container.pack(fill="x", pady=(0, 12))
        
        self.choice_entries = []
        self.correct_choice_var = ctk.StringVar(value="0")

        # Model Answer Container (for Essay)
        self.essay_container = ctk.CTkFrame(self.body, fg_color="transparent")
        self.model_answer_entry = FormTextArea(
            self.essay_container,
            label=t("field_model_answer"),
            initial_value=self.question_data.get("model_answer", ""),
            height=70
        )
        self.model_answer_entry.pack(fill="x")

        self._render_choices_section()

        # Footer Buttons
        btn_box = ctk.CTkFrame(self.footer, fg_color="transparent")
        btn_box.pack(side="right", padx=16, pady=12)

        cancel_btn = OutlineButton(btn_box, text=t("btn_cancel"), width=90, command=self.destroy)
        cancel_btn.pack(side="right", padx=6)

        save_btn = PrimaryButton(btn_box, text=t("btn_save"), width=120, command=self._handle_save)
        save_btn.pack(side="right", padx=6)

    def _pick_image(self):
        from tkinter import filedialog
        file_path = filedialog.askopenfilename(
            title="اختيار صورة مرفقة بالسؤال",
            filetypes=[("ملفات الصور", "*.png;*.jpg;*.jpeg;*.webp;*.bmp")]
        )
        if file_path:
            self.attached_image_path = file_path
            self._render_image_preview()

    def _remove_image(self):
        self.attached_image_path = None
        self._render_image_preview()

    def _render_image_preview(self):
        for w in self.img_preview_box.winfo_children():
            w.destroy()
        if not self.attached_image_path or not os.path.exists(self.attached_image_path):
            lbl = ctk.CTkLabel(
                self.img_preview_box,
                text="لا توجد صورة مرفقة حالياً",
                font=Theme.body_font(11),
                text_color=Theme.TEXT_MUTED
            )
            lbl.pack(pady=4)
            return

        row = ctk.CTkFrame(self.img_preview_box, fg_color="transparent")
        row.pack(fill="x")

        try:
            from PIL import Image
            pil_img = Image.open(self.attached_image_path)
            w, h = pil_img.size
            scale = min(200 / max(1, w), 100 / max(1, h), 1.0)
            dw, dh = max(30, int(w * scale)), max(20, int(h * scale))
            c_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(dw, dh))
            img_lbl = ctk.CTkLabel(row, text="", image=c_img)
            img_lbl.pack(side="right", padx=8, pady=4)
        except Exception:
            pass

        filename = os.path.basename(self.attached_image_path)
        name_lbl = ctk.CTkLabel(row, text=filename, font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY)
        name_lbl.pack(side="right", padx=8)

        rm_btn = DangerButton(row, text="❌ إزالة الصورة", width=110, command=self._remove_image)
        rm_btn.pack(side="left", padx=8)

    def _on_type_changed(self, choice_text: str):
        self._render_choices_section()

    def _render_choices_section(self):
        for w in self.choices_container.winfo_children():
            w.destroy()
        self.choice_entries.clear()

        type_text = self.type_dropdown.get()
        if t("type_essay") in type_text:
            self.essay_container.pack(fill="x", pady=(0, 12))
            return
        else:
            self.essay_container.pack_forget()

        # MCQ choices
        lbl = ctk.CTkLabel(
            self.choices_container,
            text=t("field_mcq_choices"),
            font=Theme.bold_font(12),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        lbl.pack(fill="x", pady=(0, 6))

        choice_codes = ["أ", "ب", "ج", "د"]
        existing_choices = self.question_data.get("choices", [])

        for idx, code in enumerate(choice_codes):
            row = ctk.CTkFrame(self.choices_container, fg_color="transparent")
            row.pack(fill="x", pady=3)
            row.grid_columnconfigure(1, weight=1)

            # Radio for correct choice
            rb = ctk.CTkRadioButton(
                row,
                text=f"({code})",
                value=str(idx),
                variable=self.correct_choice_var,
                font=Theme.bold_font(12),
                fg_color=Theme.PRIMARY[0]
            )
            rb.grid(row=0, column=0, padx=(0, 8))

            val = existing_choices[idx]["text"] if idx < len(existing_choices) else ""
            if idx < len(existing_choices) and existing_choices[idx].get("is_correct"):
                self.correct_choice_var.set(str(idx))

            entry = ctk.CTkEntry(
                row,
                placeholder_text=f"نص البديل ({code})...",
                height=34,
                corner_radius=Theme.CORNER_RADIUS_SM,
                border_color=Theme.BORDER,
                border_width=1,
                fg_color=Theme.BG_INPUT,
                text_color=Theme.TEXT_PRIMARY,
                font=Theme.body_font(12)
            )
            entry.grid(row=0, column=1, sticky="ew")
            if val:
                entry.insert(0, val)
            self.choice_entries.append(entry)

    def _handle_save(self):
        q_text = self.text_input.get()
        if not q_text:
            return

        type_text = self.type_dropdown.get()
        if t("type_essay") in type_text:
            q_type = "essay"
        elif t("type_true_false") in type_text:
            q_type = "true_false"
        else:
            q_type = "mcq"

        diff_text = self.diff_dropdown.get()
        if t("diff_easy") in diff_text:
            diff = "easy"
        elif t("diff_hard") in diff_text:
            diff = "hard"
        else:
            diff = "medium"

        choices_data = []
        if q_type == "mcq":
            correct_idx = int(self.correct_choice_var.get())
            codes = ["أ", "ب", "ج", "د"]
            for idx, e in enumerate(self.choice_entries):
                c_text = e.get().strip()
                choices_data.append({
                    "choice_code": codes[idx],
                    "text": c_text or f"خيار ({codes[idx]})",
                    "is_correct": (idx == correct_idx)
                })

        # Save image attachment if present
        image_paths = []
        if self.attached_image_path and os.path.exists(self.attached_image_path):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            target_dir = os.path.normpath(os.path.join(base_dir, "data", "uploads", "question_images"))
            os.makedirs(target_dir, exist_ok=True)
            if not os.path.abspath(self.attached_image_path).startswith(target_dir):
                ext = os.path.splitext(self.attached_image_path)[1] or ".png"
                dest_path = os.path.join(target_dir, f"q_img_{uuid.uuid4().hex[:10]}{ext}")
                shutil.copy2(self.attached_image_path, dest_path)
                image_paths = [dest_path]
            else:
                image_paths = [self.attached_image_path]

        payload = {
            "text": q_text,
            "question_type": q_type,
            "difficulty": diff,
            "chapter": self.chapter_dropdown.get(),
            "source": self.source_dropdown.get(),
            "tags": [t.strip() for t in self.tags_entry.get().split(",") if t.strip()],
            "marks": self.marks_spinbox.get(),
            "model_answer": self.model_answer_entry.get() if q_type == "essay" else None,
            "choices": choices_data,
            "image_paths": image_paths
        }

        if self.on_save:
            self.on_save(payload)
        self.destroy()

class QuestionViewModal(BaseModal):
    def __init__(self, parent, question: Dict[str, Any]):
        super().__init__(parent, title="معاينة السؤال التفصيلية", width=620, height=480)
        self.question = question
        self._render_details()

    def _render_details(self):
        # Metadata Badges
        badge_box = ctk.CTkFrame(self.body, fg_color="transparent")
        badge_box.pack(fill="x", pady=(0, 12))

        q_type = self.question.get("question_type", "mcq")
        type_labels = {"mcq": "اختيار من متعدد", "essay": "مقالي", "true_false": "صح أو خطأ"}
        Badge(badge_box, text=type_labels.get(q_type, q_type), bg_color="#EFF6FF", text_color="#1E40AF").pack(side="left", padx=4)

        diff = self.question.get("difficulty", "medium")
        diff_colors = {"easy": ("#ECFDF5", "#065F46", "سهل"), "medium": ("#FFFBEB", "#92400E", "متوسط"), "hard": ("#FEF2F2", "#991B1B", "صعب")}
        d_bg, d_fg, d_name = diff_colors.get(diff, ("#EFF6FF", "#1E40AF", diff))
        Badge(badge_box, text=f"المستوى: {d_name}", bg_color=d_bg, text_color=d_fg).pack(side="left", padx=4)

        Badge(badge_box, text=f"{self.question.get('marks', 2)} درجات", bg_color="#F1F5F9", text_color="#334155").pack(side="left", padx=4)

        # Question Statement Card
        stmt_card = ctk.CTkFrame(self.body, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_MD)
        stmt_card.pack(fill="x", pady=(0, 14))
        
        stmt_lbl = ctk.CTkLabel(
            stmt_card,
            text=self.question.get("text", ""),
            font=Theme.bold_font(13),
            text_color=Theme.TEXT_PRIMARY,
            wraplength=540,
            justify="right"
        )
        stmt_lbl.pack(padx=16, pady=14, fill="x")

        # Render question images if present
        import os
        img_paths = self.question.get("image_paths", []) or []
        if not img_paths and self.question.get("image_path"):
            img_paths = [self.question.get("image_path")]
        valid_imgs = [p for p in img_paths if p and os.path.exists(p)]
        if valid_imgs:
            img_card = ctk.CTkFrame(self.body, fg_color="transparent")
            img_card.pack(fill="x", pady=(0, 12))
            try:
                from PIL import Image
                for ip in valid_imgs:
                    pil_img = Image.open(ip)
                    w, h = pil_img.size
                    scale = min(500 / max(1, w), 220 / max(1, h), 1.0)
                    dw, dh = max(40, int(w * scale)), max(30, int(h * scale))
                    c_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(dw, dh))
                    lbl = ctk.CTkLabel(img_card, text="", image=c_img)
                    lbl.pack(pady=4, anchor="center")
            except Exception:
                pass

        # Choices or Model Answer
        if q_type == "mcq" and self.question.get("choices"):
            choices_box = ctk.CTkFrame(self.body, fg_color="transparent")
            choices_box.pack(fill="x", pady=(0, 12))

            for c in self.question.get("choices", []):
                c_row = ctk.CTkFrame(choices_box, fg_color=Theme.BG_CARD if not c.get("is_correct") else "#ECFDF5", corner_radius=Theme.CORNER_RADIUS_SM)
                c_row.pack(fill="x", pady=3)
                
                check = "✓ (الإجابة الصحيحة)" if c.get("is_correct") else ""
                txt = f"({c.get('choice_code')})  {c.get('text')}   {check}"
                c_lbl = ctk.CTkLabel(
                    c_row,
                    text=txt,
                    font=Theme.bold_font(12) if c.get("is_correct") else Theme.body_font(12),
                    text_color="#065F46" if c.get("is_correct") else Theme.TEXT_PRIMARY,
                    anchor="w"
                )
                c_lbl.pack(padx=12, pady=8, fill="x")

        elif self.question.get("model_answer"):
            ans_box = ctk.CTkFrame(self.body, fg_color="#F0FDF4", corner_radius=Theme.CORNER_RADIUS_MD)
            ans_box.pack(fill="x", pady=(0, 12))
            
            ans_title = ctk.CTkLabel(ans_box, text="الإجابة النموذجية:", font=Theme.bold_font(12), text_color="#166534")
            ans_title.pack(padx=12, pady=(10, 4), anchor="w")

            ans_lbl = ctk.CTkLabel(ans_box, text=self.question.get("model_answer"), font=Theme.body_font(12), text_color="#15803D", wraplength=520, justify="right")
            ans_lbl.pack(padx=12, pady=(0, 10), fill="x")

        # Footer
        close_btn = PrimaryButton(self.footer, text=t("btn_close"), width=100, command=self.destroy)
        close_btn.pack(side="right", padx=16, pady=12)

class TemplatePreviewModal(BaseModal):
    def __init__(self, parent, template_data: Dict[str, Any]):
        super().__init__(parent, title=f"معاينة القالب: {template_data.get('name_ar')}", width=800, height=600)
        self.template_data = template_data
        self._render_template_preview()

    def _render_template_preview(self):
        from app.ui.components.paper_preview import PaperPreviewWidget
        
        # Sample exam data for preview
        sample_exam_data = {
            "name": "اختبار نموذجي للمعاينة",
            "subject": "الفيزياء",
            "grade": "الصف الثالث الثانوي",
            "duration": "90 دقيقة",
            "instructions": "هذه معاينة للقالب المحدد. الأجابة هنا مجرد نموذج توضيحي.",
            "language": "ar",
            "model_name": "النموذج (أ)"
        }
        
        # Sample questions for preview
        sample_questions = [
            {
                "id": 1,
                "text": "سؤال نموذجي لمعاينة القالب - هذا نص سؤال تجريبي لعرض شكل القالب",
                "question_type": "mcq",
                "difficulty": "medium",
                "marks": 2,
                "choices": [
                    {"choice_code": "أ", "text": "الخيار الأول من هذا السؤال النموذجي", "is_correct": True},
                    {"choice_code": "ب", "text": "الخيار الثاني من هذا السؤال النموذجي", "is_correct": False},
                    {"choice_code": "ج", "text": "الخيار الثالث من هذا السؤال النموذجي", "is_correct": False},
                    {"choice_code": "د", "text": "الخيار الرابع من هذا السؤال النموذجي", "is_correct": False}
                ]
            },
            {
                "id": 2,
                "text": "سؤال نموذجي آخر لمعاينة القالب - هذا نص سؤال تجريبي ثانٍ",
                "question_type": "mcq",
                "difficulty": "easy",
                "marks": 1,
                "choices": [
                    {"choice_code": "أ", "text": "الخيار الأول", "is_correct": False},
                    {"choice_code": "ب", "text": "الخيار الثاني الصحيح", "is_correct": True},
                    {"choice_code": "ج", "text": "الخيار الثالث", "is_correct": False},
                    {"choice_code": "د", "text": "الخيار الرابع", "is_correct": False}
                ]
            },
            {
                "id": 3,
                "text": "سؤال صح أو خطأ نموذجي",
                "question_type": "true_false",
                "difficulty": "medium",
                "marks": 1,
                "choices": [
                    {"choice_code": "أ", "text": "صواب", "is_correct": True},
                    {"choice_code": "ب", "text": "خطأ", "is_correct": False}
                ]
            }
        ]
        
        # Create paper preview widget with the template
        preview = PaperPreviewWidget(
            self.body,
            exam_data=sample_exam_data,
            questions=sample_questions,
            model_code="A",
            template=self.template_data
        )
        preview.pack(fill="both", expand=True, padx=5, pady=5)

        # Close button
        btn = PrimaryButton(self.footer, text=t("btn_close"), width=100, command=self.destroy)
        btn.pack(side="right", padx=16, pady=12)

class GenerateExamProgressModal(BaseModal):
    def __init__(self, parent, on_complete: Optional[Callable[[], None]] = None):
        super().__init__(parent, title="جاري توليد النماذج الامتحانية...", width=480, height=280)
        self.on_complete = on_complete

        lbl = ctk.CTkLabel(self.body, text="🚀 جاري إنشاء وخلط وتوزيع النماذج الامتحانية", font=Theme.bold_font(14), text_color=Theme.TEXT_PRIMARY)
        lbl.pack(pady=(20, 10))

        self.status_lbl = ctk.CTkLabel(self.body, text="التحقق من توازن مصفوفة الصعوبة...", font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY)
        self.status_lbl.pack(pady=(0, 14))

        self.progress = ctk.CTkProgressBar(self.body, width=380, height=14, corner_radius=7, fg_color=Theme.BORDER[0], progress_color=Theme.PRIMARY[0])
        self.progress.pack(pady=10)
        self.progress.set(0.1)

        self._step = 0
        self.after(400, self._advance_progress)

    def _advance_progress(self):
        self._step += 1
        steps = [
            (0.3, "توليد النموذج (أ) والتحقق من الترتيب الأساسي..."),
            (0.6, "توليد النموذج (ب) وخلط ترتيب الأسئلة والبدائل..."),
            (0.85, "توليد النموذجين (ج) و (د) وتطبيق معايير مكافحة الغش..."),
            (1.0, "تم توليد وتثبيت جميع النماذج بنجاح!")
        ]

        if self._step <= len(steps):
            val, msg = steps[self._step - 1]
            self.progress.set(val)
            self.status_lbl.configure(text=msg)
            if self._step < len(steps):
                self.after(500, self._advance_progress)
            else:
                self.after(600, self._finish)

    def _finish(self):
        if self.on_complete:
            self.on_complete()
        self.destroy()

class ExportSuccessModal(BaseModal):
    def __init__(self, parent, exam_name: str, models_count: int = 4):
        super().__init__(parent, title="تم تصدير ملفات PDF بنجاح", width=520, height=320)
        self.exam_name = exam_name
        self.models_count = models_count

        icon_lbl = ctk.CTkLabel(self.body, text="🎉", font=("Segoe UI", 36))
        icon_lbl.pack(pady=(10, 4))

        title_lbl = ctk.CTkLabel(self.body, text="تم إنشاء حزمة الاختبار بنجاح!", font=Theme.title_font(16), text_color=Theme.SUCCESS_TEXT[0])
        title_lbl.pack(pady=(0, 6))

        desc = ctk.CTkLabel(
            self.body,
            text=f"تم تصدير عدد ({self.models_count}) نماذج امتحانية مع ورقة الإجابة وبابل شيت ونموذج الإجابة الرسمي في مجلد التصدير.",
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            wraplength=440,
            justify="center"
        )
        desc.pack(pady=(0, 14))

        box = ctk.CTkFrame(self.body, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_SM)
        box.pack(fill="x", padx=10, pady=4)
        
        path_lbl = ctk.CTkLabel(box, text=f"📁 C:/ExamForge_Output/{self.exam_name}_Models_A_B_C_D.pdf", font=Theme.mono_font(11), text_color=Theme.PRIMARY[0])
        path_lbl.pack(padx=10, pady=8)

        btn = PrimaryButton(self.footer, text="تم وحفظ", width=110, command=self.destroy)
        btn.pack(side="right", padx=16, pady=12)


class ImportPDFQuestionsModal(BaseModal):
    def __init__(
        self,
        parent,
        chapters: List[str],
        sources: List[str],
        on_import_complete: Optional[Callable[[int], None]] = None
    ):
        # Keep the dialog inside a typical display even with 150% Windows DPI.
        # The content itself is scrollable, so no action controls are lost.
        super().__init__(parent, title="استيراد أسئلة من ملف PDF", width=640, height=520)

        # Keep BaseModal's scrollable body so long metadata forms remain usable.
        self.body.grid_columnconfigure(0, weight=1)
        self.body.configure(
            scrollbar_fg_color=Theme.BG_CARD_ALT,
            scrollbar_button_color=Theme.PRIMARY[0],
            scrollbar_button_hover_color=Theme.PRIMARY_HOVER[0],
        )
        self.chapters = chapters or ["الفصل الأول", "الفصل الثاني", "الفصل الثالث"]
        self.sources_list = sources or ["كتاب الوزارة المعتمد", "ملف PDF مستورد"]
        self.on_import_complete = on_import_complete
        self.selected_pdf_path: Optional[str] = None
        self.extracted_questions: List[Dict[str, Any]] = []
        self.selected_indices: set = set()
        self.page_size = 20
        self.current_page = 0

        self._build_step1_file_select()

        cancel_btn = OutlineButton(self.footer, text="إلغاء", width=90, command=self.destroy)
        cancel_btn.pack(side="right", padx=6, pady=12)

        # A permanently visible file selector in the footer avoids relying on
        # a control that may be below the fold in the scrollable form.
        self.choose_file_btn = SecondaryButton(
            self.footer, text="📄 اختر ملف PDF", width=145, command=self._browse_pdf
        )
        self.choose_file_btn.pack(side="right", padx=6, pady=12)

        self.import_btn = PrimaryButton(self.footer, text="إضافة إلى بنك الأسئلة", width=180, command=self._handle_import, state="disabled")
        self.import_btn.pack(side="right", padx=16, pady=12)

    def _clear_body(self):
        for w in self.body.winfo_children():
            w.destroy()

    def _build_step1_file_select(self):
        self._clear_body()

        title = ctk.CTkLabel(self.body, text="الخطوة 1: اختيار ملف PDF", font=Theme.bold_font(14), text_color=Theme.TEXT_PRIMARY, anchor="w")
        title.pack(fill="x", pady=(0, 6))

        subtitle = ctk.CTkLabel(
            self.body,
            text="حدد ملف PDF يحتوي على الأسئلة. سيقوم النظام باستخراج النص وتحليله تلقائياً.",
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            wraplength=640,
            justify="right"
        )
        subtitle.pack(fill="x", pady=(0, 16))

        file_box = ctk.CTkFrame(self.body, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_MD)
        file_box.pack(fill="x", pady=(0, 14))

        self.file_path_lbl = ctk.CTkLabel(
            file_box,
            text="📄 لم يتم اختيار أي ملف بعد...",
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w"
        )
        browse_btn = SecondaryButton(file_box, text="اختر ملف PDF", width=130, command=self._browse_pdf)
        browse_btn.pack(side="right", padx=12, pady=10)

        self.file_path_lbl.pack(side="left", padx=14, pady=14, fill="x", expand=True)

        settings_title = ctk.CTkLabel(self.body, text="إعدادات الاستخراج الافتراضية", font=Theme.bold_font(13), text_color=Theme.TEXT_PRIMARY, anchor="w")
        settings_title.pack(fill="x", pady=(8, 6))

        r1 = ctk.CTkFrame(self.body, fg_color="transparent")
        r1.pack(fill="x", pady=(0, 10))
        r1.grid_columnconfigure((0, 1), weight=1)

        self.chapter_dropdown = FormDropdown(
            r1,
            label="الفصل / الوحدة الافتراضي",
            values=self.chapters,
            default_value=self.chapters[0] if self.chapters else ""
        )
        self.chapter_dropdown.grid(row=0, column=0, padx=(0, 6), sticky="ew")

        r2 = ctk.CTkFrame(self.body, fg_color="transparent")
        r2.pack(fill="x", pady=(0, 10))
        r2.grid_columnconfigure((0, 1), weight=1)

        self.grade_dropdown = FormDropdown(
            r2,
            label="الصف الدراسي",
            values=["الأولى الإعدادية", "الثانية الإعدادية", "الثالثة الإعدادية", "الأولى الثانوية", "الثانية الثانوية", "الثالثة الثانوية"],
            default_value="الثانية الإعدادية"
        )
        self.grade_dropdown.grid(row=0, column=0, padx=(0, 6), sticky="ew")

        self.term_dropdown = FormDropdown(
            r2,
            label="الفصل الدراسي",
            values=["الترم الأول", "الترم الثاني", "العام الدراسي"],
            default_value="الترم الأول"
        )
        self.term_dropdown.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        r3 = ctk.CTkFrame(self.body, fg_color="transparent")
        r3.pack(fill="x", pady=(0, 10))
        r3.grid_columnconfigure((0, 1), weight=1)

        self.branch_entry = FormEntry(r3, label="الفرع / المجال", placeholder="مثال: الجبر", initial_value="")
        self.branch_entry.grid(row=0, column=0, padx=(0, 6), sticky="ew")
        self.lesson_entry = FormEntry(r3, label="الدرس", placeholder="مثال: الدرس الثاني", initial_value="")
        self.lesson_entry.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        subjects = ["الفيزياء", "الكيمياء", "الأحياء", "الرياضيات", "اللغة الفرنسية", "اللغة العربية", "اللغة الإنجليزية", "التاريخ", "الجغرافيا"]
        self.subject_dropdown = FormDropdown(
            r1,
            label="المادة الدراسية",
            values=subjects,
            default_value="الفيزياء"
        )
        self.subject_dropdown.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        # AI Extraction Options Card
        ai_box = ctk.CTkFrame(self.body, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_SM)
        ai_box.pack(fill="x", pady=(0, 10))

        ai_header = ctk.CTkFrame(ai_box, fg_color="transparent")
        ai_header.pack(fill="x", padx=12, pady=6)

        self.ai_switch_var = ctk.BooleanVar(value=True)
        self.ai_switch = ctk.CTkSwitch(
            ai_header,
            text="🤖 التفعيل بالذكاء الاصطناعي أونلاين (مستوصى به للفرنسية والفيزياء وكافة المواد)",
            variable=self.ai_switch_var,
            font=Theme.bold_font(12),
            text_color=Theme.PRIMARY[0],
            fg_color=Theme.BORDER[0],
            progress_color=Theme.PRIMARY[0]
        )
        self.ai_switch.pack(side="right", padx=6)

        from app.services.ai_parser_service import AIParserService
        saved_k = AIParserService.get_saved_api_key() or ""

        self.api_key_entry = FormEntry(
            ai_box,
            label="مفتاح الذكاء الاصطناعي Gemini API Key (سيتم حفظ المفتاح لاستخدامه دائماً تلقائياً)",
            placeholder="AIzaSy...",
            initial_value=saved_k
        )
        self.api_key_entry.pack(fill="x", padx=12, pady=(0, 8))

        self.source_name_entry = FormEntry(
            self.body,
            label="اسم المصدر (اختياري)",
            placeholder="سيتم استخدام اسم الملف إذا ترك فارغاً",
            initial_value=""
        )
        self.source_name_entry.pack(fill="x", pady=(0, 14))

        self.parse_btn = PrimaryButton(self.body, text="🤖 تحليل واستخراج الأسئلة بالذكاء الاصطناعي", width=260, command=self._handle_parse_pdf, state="disabled")
        self.parse_btn.pack(pady=(4, 0))

        self.status_lbl = ctk.CTkLabel(self.body, text="", font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY)
        self.status_lbl.pack(pady=(10, 0))

    def _browse_pdf(self):
        from tkinter import filedialog
        path = filedialog.askopenfilename(
            parent=self.winfo_toplevel(),
            title="اختر ملف PDF",
            filetypes=[("PDF Files", ("*.pdf", "*.PDF")), ("All Files", "*.*")]
        )
        if path:
            self.selected_pdf_path = path
            import os
            fname = os.path.basename(path)
            fsize = int(os.path.getsize(path) / 1024)
            if self.file_path_lbl.winfo_exists():
                self.file_path_lbl.configure(
                    text=f"📄 {fname}  •  {fsize:,} كيلوبايت",
                    text_color=Theme.TEXT_PRIMARY
                )
            self.choose_file_btn.configure(text=f"📄 {fname[:18]}")
            self.parse_btn.configure(state="normal")
            self.status_lbl.configure(text="جاهز للتحليل. اضغط على زر استخراج الأسئلة بالذكاء الاصطناعي.")

    def _handle_parse_pdf(self):
        if not self.selected_pdf_path:
            return
        self.parse_btn.configure(state="disabled")
        self.status_lbl.configure(text="🤖 ⏳ جاري بدء خيط المعالجة بالذكاء الاصطناعي التوليدي...", text_color=Theme.PRIMARY[0])
        self.update_idletasks()

        default_chapter = self.chapter_dropdown.get()
        default_subject = self.subject_dropdown.get()
        grade_level = self.grade_dropdown.get()
        term = self.term_dropdown.get()
        branch = self.branch_entry.get().strip() or None
        lesson = self.lesson_entry.get().strip() or None
        src_name = self.source_name_entry.get().strip()
        use_ai = bool(self.ai_switch_var.get())
        custom_key = self.api_key_entry.get().strip() or None

        import os, threading
        default_source = src_name or os.path.splitext(os.path.basename(self.selected_pdf_path))[0]

        def _worker():
            try:
                from app.services.pdf_parser_service import PDFParserService
                
                def _update_progress(curr, total, msg):
                    self.after(0, lambda c=curr, t=total, m=msg: self._on_ai_progress(c, t, m))

                res = PDFParserService.parse_pdf_to_questions(
                    self.selected_pdf_path,
                    default_chapter=default_chapter,
                    default_source=default_source,
                    default_subject=default_subject,
                    grade_level=grade_level,
                    term=term,
                    branch=branch,
                    lesson=lesson,
                    use_ai=use_ai,
                    api_key=custom_key
                )
                if len(res) == 3:
                    extracted_text, questions, meta = res
                else:
                    extracted_text, questions = res[0], res[1]
                    meta = {}

                self.after(0, lambda: self._on_ai_complete(extracted_text, questions, meta, default_subject))
            except Exception as e:
                self.after(0, lambda err=str(e): self._on_ai_error(err))

        threading.Thread(target=_worker, daemon=True).start()

    def _on_ai_progress(self, curr, total, msg):
        if self.status_lbl.winfo_exists():
            self.status_lbl.configure(text=msg, text_color=Theme.PRIMARY[0])

    def _on_ai_complete(self, extracted_text, questions, meta, default_subject):
        self.extracted_questions = questions
        self.ai_metadata = meta
        for idx in range(len(questions)):
            self.selected_indices.add(idx)

        if not questions:
            if self.status_lbl.winfo_exists():
                self.status_lbl.configure(text=f"⚠️ لم يتم التعرف على أسئلة في الملف. النص المستخرج: {len(extracted_text)} حرف.", text_color="#92400E")
            self.parse_btn.configure(state="normal")
        else:
            det_sub = meta.get("detected_subject", default_subject)
            det_lang = meta.get("detected_language", "العربية")
            if self.status_lbl.winfo_exists():
                self.status_lbl.configure(text=f"✨ تم استخراج ({len(questions)}) سؤال بنجاح! [المادة: {det_sub} • اللغة: {det_lang}]", text_color=Theme.SUCCESS_TEXT[0])
            self.after(600, lambda: self._build_step2_review())

    def _on_ai_error(self, err_msg):
        if self.status_lbl.winfo_exists():
            self.status_lbl.configure(text=f"❌ خطأ أثناء المعالجة: {err_msg}", text_color=Theme.DANGER[0])
        self.parse_btn.configure(state="normal")

    def _build_step2_review(self):
        self._clear_body()
        self.current_page = 0
        self.choose_file_btn.configure(state="disabled")
        self.import_btn.configure(state="normal" if self.selected_indices else "disabled")

        top_bar = ctk.CTkFrame(self.body, fg_color="transparent")
        top_bar.pack(fill="x", pady=(0, 10))

        title = ctk.CTkLabel(top_bar, text=f"الخطوة 2: مراجعة الأسئلة المستخرجة ({len(self.extracted_questions)})", font=Theme.bold_font(14), text_color=Theme.TEXT_PRIMARY, anchor="w")
        title.pack(side="left")

        select_all_btn = GhostButton(top_bar, text="تحديد الكل / إلغاء", width=140, command=self._toggle_select_all)
        select_all_btn.pack(side="right")

        counter = ctk.CTkLabel(top_bar, text=f"المحدد للاستيراد: {len(self.selected_indices)}", font=Theme.body_font(12), text_color=Theme.PRIMARY[0])
        counter.pack(side="right", padx=10)
        self.selected_counter_lbl = counter

        self.review_cards_frame = ctk.CTkScrollableFrame(self.body, fg_color="transparent", corner_radius=0, height=320)
        self.review_cards_frame.pack(fill="both", expand=True)
        self.review_cards_frame.grid_columnconfigure(0, weight=1)

        self.pagination_bar = ctk.CTkFrame(self.body, fg_color="transparent")
        self.pagination_bar.pack(fill="x", pady=(6, 0))

        self._render_review_page()

    def _render_review_page(self):
        for child in self.review_cards_frame.winfo_children():
            child.destroy()
        for child in self.pagination_bar.winfo_children():
            child.destroy()

        total_items = len(self.extracted_questions)
        if total_items == 0:
            return

        total_pages = max(1, (total_items + self.page_size - 1) // self.page_size)
        self.current_page = max(0, min(self.current_page, total_pages - 1))
        start_idx = self.current_page * self.page_size
        end_idx = min(total_items, start_idx + self.page_size)

        type_dict = {"mcq": "اختيار من متعدد", "essay": "مقالي", "true_false": "صح أو خطأ"}
        type_colors = {"mcq": ("#EFF6FF", "#1E40AF"), "essay": ("#F0FDFA", "#0D9488"), "true_false": ("#F5F3FF", "#7C3AED")}

        for idx in range(start_idx, end_idx):
            q = self.extracted_questions[idx]
            try:
                card = ctk.CTkFrame(self.review_cards_frame, fg_color=Theme.BG_CARD, corner_radius=Theme.CORNER_RADIUS_SM, border_color=Theme.BORDER, border_width=1)
                card.grid(row=idx - start_idx, column=0, sticky="ew", pady=4, padx=2)
                card.grid_columnconfigure(1, weight=1)

                var = ctk.BooleanVar(value=(idx in self.selected_indices))

                def _toggle(v=var, i=idx):
                    if v.get():
                        self.selected_indices.add(i)
                    else:
                        self.selected_indices.discard(i)
                    self.selected_counter_lbl.configure(text=f"المحدد للاستيراد: {len(self.selected_indices)}")
                    self.import_btn.configure(state="normal" if self.selected_indices else "disabled")

                cb = ctk.CTkCheckBox(
                    card, text="", variable=var, command=_toggle,
                    fg_color=Theme.PRIMARY[0], width=22, height=22
                )
                cb.grid(row=0, column=0, rowspan=4, padx=(12, 6), pady=10, sticky="n")

                header = ctk.CTkFrame(card, fg_color="transparent")
                header.grid(row=0, column=1, sticky="ew", padx=(0, 12), pady=(10, 4))
                header.grid_columnconfigure(1, weight=1)

                num_lbl = ctk.CTkLabel(header, text=f"السؤال {idx+1}", font=Theme.bold_font(12), text_color=Theme.TEXT_PRIMARY, anchor="w")
                num_lbl.grid(row=0, column=0, padx=(0, 8))

                qt = q.get("question_type", "mcq")
                bg, fg = type_colors.get(qt, ("#F1F5F9", "#334155"))
                type_badge = ctk.CTkLabel(header, text=type_dict.get(qt, qt), font=Theme.small_font(10), fg_color=bg, text_color=fg, corner_radius=8)
                type_badge.grid(row=0, column=1, padx=(0, 8), sticky="w")
                if q.get("image_paths"):
                    img_badge = ctk.CTkLabel(header, text=f"🖼️ رسم/بياني ({len(q['image_paths'])})", font=Theme.small_font(10), fg_color="#FEF3C7", text_color="#92400E", corner_radius=8)
                    img_badge.grid(row=0, column=2, padx=(0, 4), sticky="w")

                # Check duplicate against Question Bank
                try:
                    from app.services.question_service import QuestionService
                    dup_q = QuestionService.check_duplicate(q.get("text", ""))
                    if dup_q:
                        dup_badge = ctk.CTkLabel(header, text=f"⚠️ تكرار محتمل (#ID:{dup_q.get('id')})", font=Theme.small_font(10), fg_color="#FEF2F2", text_color="#991B1B", corner_radius=8)
                        dup_badge.grid(row=0, column=3, padx=(0, 4), sticky="w")
                except Exception:
                    pass

                if q.get("needs_review"):
                    rev_badge = ctk.CTkLabel(header, text="⚠️ يحتاج مراجعة", font=Theme.small_font(10), fg_color="#FFFBEB", text_color="#92400E", corner_radius=8)
                    rev_badge.grid(row=0, column=4, padx=(0, 4), sticky="w")

                if q.get("source_page"):
                    pg_badge = ctk.CTkLabel(header, text=f"📄 ص {q['source_page']}", font=Theme.small_font(10), fg_color="#F1F5F9", text_color="#334155", corner_radius=8)
                    pg_badge.grid(row=0, column=5, padx=(0, 4), sticky="w")

                src_lbl = ctk.CTkLabel(header, text=f"{q.get('chapter', '')} • {q.get('source', '')}", font=Theme.small_font(10), text_color=Theme.TEXT_SECONDARY, anchor="e")
                src_lbl.grid(row=0, column=6, sticky="e")

                text_lbl = ctk.CTkLabel(
                    card, text=q.get("text", "")[:220] + ("..." if len(q.get("text", "")) > 220 else ""),
                    font=Theme.body_font(12), text_color=Theme.TEXT_PRIMARY, anchor="w", justify="right", wraplength=540
                )
                text_lbl.grid(row=1, column=1, sticky="ew", padx=(0, 12), pady=(0, 6))

                choices_text = ""
                choices = q.get("choices", []) or []
                if qt == "mcq" and choices:
                    parts = []
                    for c in choices[:4]:
                        ct = c.get("text", "")[:50]
                        parts.append(f"({c.get('choice_code', '?')}) {ct}")
                    choices_text = "    ".join(parts)

                if choices_text:
                    ch_lbl = ctk.CTkLabel(card, text=choices_text, font=Theme.small_font(11), text_color=Theme.TEXT_SECONDARY, anchor="w", wraplength=540, justify="right")
                    ch_lbl.grid(row=2, column=1, sticky="ew", padx=(0, 12), pady=(0, 10))

                classify = ctk.CTkFrame(card, fg_color="transparent")
                classify.grid(row=3, column=1, sticky="ew", padx=(0, 12), pady=(0, 10))
                classify.grid_columnconfigure((0, 1, 2), weight=1)

                type_values = ["mcq", "essay", "true_false"]
                type_display_labels = ["اختيار من متعدد", "مقالي", "صح أو خطأ"]
                current_type = q.get("question_type", "essay")
                type_menu = ctk.CTkOptionMenu(
                    classify, values=type_display_labels,
                    width=130, height=28, font=Theme.small_font(10),
                    fg_color=Theme.BG_INPUT, button_color=Theme.BORDER,
                )
                type_menu.set(type_display_labels[type_values.index(current_type)] if current_type in type_values else type_display_labels[1])
                type_menu.grid(row=0, column=0, padx=(0, 4), sticky="ew")

                diff_values = ["easy", "medium", "hard"]
                diff_labels = ["سهل", "متوسط", "صعب"]
                current_diff = q.get("difficulty", "medium")
                diff_menu = ctk.CTkOptionMenu(
                    classify, values=diff_labels,
                    width=100, height=28, font=Theme.small_font(10),
                    fg_color=Theme.BG_INPUT, button_color=Theme.BORDER,
                )
                diff_menu.set(diff_labels[diff_values.index(current_diff)] if current_diff in diff_values else diff_labels[1])
                diff_menu.grid(row=0, column=1, padx=4, sticky="ew")

                chapter_values = self.chapters or ["الفصل الأول"]
                chapter_menu = ctk.CTkOptionMenu(
                    classify, values=chapter_values,
                    width=170, height=28, font=Theme.small_font(10),
                    fg_color=Theme.BG_INPUT, button_color=Theme.BORDER,
                )
                chapter_menu.set(q.get("chapter") if q.get("chapter") in chapter_values else chapter_values[0])
                chapter_menu.grid(row=0, column=2, padx=(4, 0), sticky="ew")

                def save_classification(*_args, question=q, type_control=type_menu,
                                        diff_control=diff_menu, chapter_control=chapter_menu):
                    question["question_type"] = type_values[type_display_labels.index(type_control.get())]
                    question["difficulty"] = diff_values[diff_labels.index(diff_control.get())]
                    question["chapter"] = chapter_control.get()
                    from app.services.smart_nlp_parser import SmartNLPParser
                    SmartNLPParser.normalize_question_item(question)

                type_menu.configure(command=save_classification)
                diff_menu.configure(command=save_classification)
                chapter_menu.configure(command=save_classification)
            except Exception as e:
                print(f"[Error rendering question {idx+1}]: {e}")

        if total_pages > 1:
            prev_btn = SecondaryButton(
                self.pagination_bar, text="▶ السابق", width=90, height=28,
                state="normal" if self.current_page > 0 else "disabled",
                command=self._prev_page
            )
            prev_btn.pack(side="left", padx=6)

            page_info = ctk.CTkLabel(
                self.pagination_bar,
                text=f"صفحة {self.current_page + 1} من {total_pages}   (عرض {start_idx + 1} إلى {end_idx} من أصل {total_items} سؤال)",
                font=Theme.body_font(11),
                text_color=Theme.TEXT_SECONDARY
            )
            page_info.pack(side="left", expand=True)

            next_btn = SecondaryButton(
                self.pagination_bar, text="التالي ◀", width=90, height=28,
                state="normal" if self.current_page < total_pages - 1 else "disabled",
                command=self._next_page
            )
            next_btn.pack(side="right", padx=6)

    def _prev_page(self):
        if self.current_page > 0:
            self.current_page -= 1
            self._render_review_page()

    def _next_page(self):
        total_pages = (len(self.extracted_questions) + self.page_size - 1) // self.page_size
        if self.current_page < total_pages - 1:
            self.current_page += 1
            self._render_review_page()

    def _toggle_select_all(self):
        all_selected = len(self.selected_indices) == len(self.extracted_questions)
        if all_selected:
            self.selected_indices.clear()
        else:
            for i in range(len(self.extracted_questions)):
                self.selected_indices.add(i)

        self._render_review_page()
        self.selected_counter_lbl.configure(text=f"المحدد للاستيراد: {len(self.selected_indices)}")
        self.import_btn.configure(state="normal" if self.selected_indices else "disabled")

    def _handle_import(self):
        if not self.selected_indices:
            return
        self.import_btn.configure(state="disabled")
        selected_qs = [self.extracted_questions[i] for i in sorted(self.selected_indices)]

        try:
            from app.services.source_service import SourceService
            from app.services.question_service import QuestionService

            src_result = None
            if self.selected_pdf_path:
                import os
                orig_name = os.path.basename(self.selected_pdf_path)
                name_ar = self.source_name_entry.get().strip() or None
                try:
                    src_result, _, _ = SourceService.upload_pdf_and_extract(
                        self.selected_pdf_path,
                        original_name=orig_name,
                        name_ar=name_ar,
                        subject=self.subject_dropdown.get(),
                        default_chapter=self.chapter_dropdown.get(),
                        grade_level=self.grade_dropdown.get(),
                        term=self.term_dropdown.get(),
                        branch=self.branch_entry.get().strip() or None,
                        lesson=self.lesson_entry.get().strip() or None,
                    )
                    src_name = src_result.get("name_ar", "ملف PDF مستورد")
                    for q in selected_qs:
                        q["source"] = src_name
                        q["subject"] = self.subject_dropdown.get()
                        q["grade_level"] = self.grade_dropdown.get()
                        q["term"] = self.term_dropdown.get()
                        q["branch"] = self.branch_entry.get().strip() or None
                        q["lesson"] = self.lesson_entry.get().strip() or None
                        # Preserve chapter/type/difficulty selected per question
                        # in the review screen; only fill a missing chapter.
                        q.setdefault("chapter", self.chapter_dropdown.get())
                except Exception:
                    pass

            result = QuestionService.create_questions_bulk(selected_qs)
            created = result.get("created_count", 0)
            failed = result.get("failed_count", 0)

            if src_result:
                SourceService.update_source(src_result["id"], {
                    "question_count": created,
                    "status": "certified" if created else "pending",
                    "status_ar": "معتمد رسمياً" if created else "قيد المراجعة",
                    "status_en": "Certified" if created else "Pending review",
                })

            if self.on_import_complete:
                self.on_import_complete(created)

            self._clear_body()

            icon = ctk.CTkLabel(self.body, text="✅", font=("Segoe UI", 36))
            icon.pack(pady=(10, 4))

            t_title = ctk.CTkLabel(self.body, text="اكتمل استيراد الأسئلة!", font=Theme.title_font(16), text_color=Theme.SUCCESS_TEXT[0])
            t_title.pack(pady=(0, 8))

            msg_parts = [f"تمت إضافة ({created}) سؤال إلى بنك الأسئلة بنجاح."]
            if failed > 0:
                msg_parts.append(f"فشل إضافة ({failed}) سؤال.")
            if src_result:
                msg_parts.append(f"تم حفظ الملف كمصدر تعليمي ضمن المصادر.")

            desc = ctk.CTkLabel(
                self.body,
                text="\n".join(msg_parts),
                font=Theme.body_font(12),
                text_color=Theme.TEXT_SECONDARY,
                wraplength=500,
                justify="center"
            )
            desc.pack(pady=(0, 14))

            self.import_btn.destroy()
            done_btn = PrimaryButton(self.footer, text="تم", width=110, command=self.destroy)
            done_btn.pack(side="right", padx=16, pady=12)
        except Exception as e:
            self._clear_body()
            err = ctk.CTkLabel(self.body, text=f"❌ حدث خطأ أثناء الاستيراد: {str(e)}", font=Theme.body_font(13), text_color=Theme.DANGER[0], wraplength=600, justify="center")
            err.pack(pady=40)
            self.import_btn.configure(state="normal")

# patched