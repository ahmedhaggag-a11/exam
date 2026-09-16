# Exams Registry View
import customtkinter as ctk
from typing import Optional, Callable, Dict, Any
from app.config.theme import Theme
from app.config.i18n import t
from app.services import ExamService
from app.ui.components import (
    Card, PrimaryButton, SecondaryButton, OutlineButton, GhostButton,
    DataTable, ConfirmDialog, ExportSuccessModal, GenerateExamProgressModal
)
from app.services import build_exam_output_paths

class ExamsView(ctk.CTkFrame):
    def __init__(
        self,
        master,
        on_navigate: Optional[Callable[[str], None]] = None,
        on_notify: Optional[Callable[[str, str], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", corner_radius=0, **kwargs)
        self.on_navigate = on_navigate
        self.on_notify = on_notify

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        self._build_top_bar()
        self._build_filter_bar()
        self._build_table()
        self.refresh()

    def _build_top_bar(self):
        top_bar = Card(self)
        top_bar.grid(row=0, column=0, padx=24, pady=(16, 8), sticky="ew")
        top_bar.grid_columnconfigure(0, weight=1)

        inner = ctk.CTkFrame(top_bar, fg_color="transparent")
        inner.pack(fill="x", padx=16, pady=12)

        title_box = ctk.CTkFrame(inner, fg_color="transparent")
        title_box.pack(side="left")

        ctk.CTkLabel(
            title_box,
            text=f"📑 {t('nav_exams')}",
            font=Theme.title_font(16),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(anchor="w")

        self.count_lbl = ctk.CTkLabel(
            title_box,
            text="تحميل سجل الاختبارات...",
            font=Theme.small_font(11),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w"
        ).pack(anchor="w")

        # Create Exam Button
        create_btn = PrimaryButton(
            inner,
            text=f"✨ {t('action_create_exam')}",
            width=160,
            command=lambda: self._navigate_to("create_exam")
        )
        create_btn.pack(side="right")

    def _build_filter_bar(self):
        f_bar = ctk.CTkFrame(self, fg_color="transparent")
        f_bar.grid(row=1, column=0, padx=24, pady=(0, 10), sticky="ew")

        # Search Entry
        self.search_entry = ctk.CTkEntry(
            f_bar,
            placeholder_text="🔍 بحث في اسم الاختبار أو المادة...",
            width=280,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            border_color=Theme.BORDER,
            fg_color=Theme.BG_INPUT,
            font=Theme.body_font(12)
        )
        self.search_entry.pack(side="left", padx=(0, 8))
        self.search_entry.bind("<KeyRelease>", lambda e: self.refresh())

        # Status Filter Menu
        self.status_menu = ctk.CTkOptionMenu(
            f_bar,
            values=["جميع الحالات", "جاهز للاعتماد", "تم توليد النماذج", "مسودة"],
            command=lambda v: self.refresh(),
            width=160,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_INPUT,
            button_color=Theme.BORDER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(12)
        )
        self.status_menu.pack(side="left", padx=4)

    def _build_table(self):
        cols = [
            {"key": "name", "title": t("col_exam_name"), "weight": 3, "max_len": 40},
            {"key": "subject", "title": t("col_subject"), "weight": 1},
            {"key": "exam_date", "title": t("col_date"), "weight": 1},
            {"key": "total_questions", "title": t("col_questions_count"), "weight": 1},
            {"key": "models_count", "title": t("col_models_count"), "weight": 1},
            {
                "key": "status",
                "title": t("col_status"),
                "weight": 1,
                "type": "badge",
                "color_map": {
                    "ready": ("#ECFDF5", "#065F46"),
                    "generated": ("#EFF6FF", "#1E40AF"),
                    "draft": ("#FFFBEB", "#92400E")
                }
            },
            {"key": "actions", "title": t("col_actions"), "weight": 3, "type": "actions", "align": "right"}
        ]
        actions = [
            {"label": "طباعة", "key": "print", "style": "primary", "width": 55},
            {"label": "إجابة", "key": "answer_key", "style": "outline", "width": 55},
            {"label": "PDF", "key": "export", "style": "outline", "width": 45},
            {"label": "توليد", "key": "generate", "style": "outline", "width": 45},
            {"label": "نسخ", "key": "duplicate", "style": "ghost", "width": 45},
            {"label": "حذف", "key": "delete", "style": "danger", "width": 45}
        ]

        self.table = DataTable(
            self,
            columns=cols,
            row_actions=actions,
            on_action=self._handle_table_action,
            empty_message="لا توجد اختبارات مسجلة حالياً."
        )
        self.table.grid(row=2, column=0, padx=24, pady=(0, 16), sticky="nsew")

    def refresh(self):
        search = self.search_entry.get().strip() if hasattr(self, "search_entry") else ""
        
        status_val = self.status_menu.get() if hasattr(self, "status_menu") else "جميع الحالات"
        if "جاهز" in status_val:
            s_filter = "ready"
        elif "توليد" in status_val:
            s_filter = "generated"
        elif "مسودة" in status_val:
            s_filter = "draft"
        else:
            s_filter = None

        exams = ExamService.get_exams(search_query=search, status_filter=s_filter)
        self.table.set_data(exams)

    def _handle_table_action(self, action_key: str, exam_row: Dict[str, Any]):
        eid = exam_row.get("id")
        ename = exam_row.get("name", "Exam")
        mcount = exam_row.get("models_count", 4)

        if action_key == "print":
            # Use the identifier already carried by the clicked row.  Looking an
            # exam up by name can select the wrong row (or no row at all when a
            # search/filter is active), which made the print button unreliable.
            self._handle_print_exam(eid, ename, mcount)
        elif action_key == "answer_key":
            self._handle_answer_key(eid, ename)
        elif action_key == "export":
            ExportSuccessModal(self.winfo_toplevel(), exam_name=ename, models_count=mcount)
        elif action_key == "generate":
            GenerateExamProgressModal(
                self.winfo_toplevel(),
                on_complete=lambda: self._on_generated_success(ename, mcount)
            )
        elif action_key == "duplicate":
            ExamService.duplicate_exam(eid)
            if self.on_notify:
                self.on_notify("تم تكرار الاختبار بنجاح!", "success")
            self.refresh()
        elif action_key == "delete":
            ConfirmDialog(
                self.winfo_toplevel(),
                title="تأكيد حذف الاختبار",
                message=t("msg_confirm_delete_exam"),
                confirm_text="حذف الاختبار",
                is_danger=True,
                on_confirm=lambda e_id=eid: self._on_exam_deleted(e_id)
            )

    def _on_generated_success(self, ename: str, mcount: int):
        ExportSuccessModal(self.winfo_toplevel(), exam_name=ename, models_count=mcount)
        if self.on_notify:
            self.on_notify("تمت إعادة توليد النماذج بنجاح!", "success")
        self.refresh()

    def _on_exam_deleted(self, eid: int):
        ExamService.delete_exam(eid)
        if self.on_notify:
            self.on_notify("تم حذف الاختبار بنجاح.", "info")
        self.refresh()

    def _handle_print_exam(self, exam_id: int, exam_name: str, models_count: int):
        try:
            from app.services import build_and_open_html_print_preview
            from app.config.settings import TeacherProfile
            
            if not exam_id:
                if self.on_notify:
                    self.on_notify("تعذر العثور على بيانات الاختبار للطباعة.", "error")
                return
            
            exam_data = ExamService.get_exam_by_id(exam_id)
            if not exam_data:
                if self.on_notify:
                    self.on_notify("تعذر تحميل بيانات الاختبار.", "error")
                return
            
            # Prepare exam payload for printing
            exam_payload = {
                "name": exam_data.get("name", exam_name),
                "subject": exam_data.get("subject", "الفيزياء"),
                "grade": exam_data.get("grade", "الصف الثالث الثانوي"),
                "duration": exam_data.get("duration", "90 دقيقة"),
                "instructions": exam_data.get("instructions", ""),
                "teacher_name": TeacherProfile.NAME_AR
            }
            
            # Get questions per model
            question_ids = [q["id"] for q in exam_data.get("questions", [])]
            questions_per_model = ExamService.get_model_question_order(
                exam_id=exam_id,
                question_ids=question_ids,
                models_count=models_count,
                shuffle_q=exam_data.get("shuffle_questions", True),
                shuffle_c=exam_data.get("shuffle_choices", True)
            )
            
            # Build output paths
            output_paths = build_exam_output_paths(exam_name, models_count)
            
            # Detect language
            language = exam_data.get("language", "ar")

            from app.services import TemplateService
            template = TemplateService.get_template_by_id(exam_data.get("template_id")) if exam_data.get("template_id") else None
            
            # Open print preview
            build_and_open_html_print_preview(
                exam_name=exam_name,
                exam_data=exam_payload,
                questions_per_model=questions_per_model,
                output_paths=output_paths,
                language=language,
                template=template,
            )
            
            if self.on_notify:
                self.on_notify("تم فتح نافذة معاينة الطباعة!", "success")
                
        except Exception as e:
            import traceback
            error_msg = str(e) or "خطأ غير معروف"
            print(f"[PRINT ERROR] {error_msg}\n{traceback.format_exc()}")
            if self.on_notify:
                self.on_notify(f"حدث خطأ أثناء الطباعة: {error_msg}", "error")

    def _handle_answer_key(self, exam_id: int, exam_name: str):
        try:
            from app.services import build_and_open_html_answer_key_preview
            from app.config.settings import TeacherProfile

            exam_data = ExamService.get_exam_by_id(exam_id)
            if not exam_data:
                raise ValueError("تعذر تحميل بيانات الاختبار")
            answer_keys = ExamService.get_model_answer_keys(exam_id)
            opened = build_and_open_html_answer_key_preview(
                exam_name=exam_name,
                exam_data={"teacher_name": TeacherProfile.NAME_AR},
                answer_keys=answer_keys,
                language=exam_data.get("language", "ar"),
            )
            if self.on_notify:
                self.on_notify("تم فتح نموذج الإجابة لكل النماذج.", "success" if opened else "error")
        except Exception as e:
            if self.on_notify:
                self.on_notify(f"حدث خطأ أثناء فتح نموذج الإجابة: {e}", "error")

    def _navigate_to(self, route: str):
        if self.on_navigate:
            self.on_navigate(route)
