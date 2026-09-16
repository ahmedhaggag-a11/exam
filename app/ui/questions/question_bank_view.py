# Question Bank View
import customtkinter as ctk
from typing import Optional, Callable, Dict, Any, List
from app.config.theme import Theme
from app.config.i18n import t
from app.services import QuestionService
from app.ui.components import (
    Card, PrimaryButton, SecondaryButton, OutlineButton, GhostButton,
    DataTable, AddEditQuestionModal, QuestionViewModal, ConfirmDialog,
    ToastNotification, ImportPDFQuestionsModal
)

class QuestionBankView(ctk.CTkFrame):
    def __init__(
        self,
        master,
        on_notify: Optional[Callable[[str, str], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", corner_radius=0, **kwargs)
        self.on_notify = on_notify
        self._search_timer = None

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        self.chapters_list = ["all"] + QuestionService.get_distinct_chapters()
        self.sources_list = ["all"] + QuestionService.get_distinct_sources()

        self._build_top_controls()
        self._build_filter_bar()
        self._build_table()
        self.refresh()

    def _build_top_controls(self):
        top_bar = Card(self)
        top_bar.grid(row=0, column=0, padx=24, pady=(16, 8), sticky="ew")
        top_bar.grid_columnconfigure(0, weight=1)

        inner = ctk.CTkFrame(top_bar, fg_color="transparent")
        inner.pack(fill="x", padx=16, pady=12)

        # Title and counter
        title_box = ctk.CTkFrame(inner, fg_color="transparent")
        title_box.pack(side="left")

        self.title_lbl = ctk.CTkLabel(
            title_box,
            text=f"📚 {t('bank_title')}",
            font=Theme.title_font(16),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        self.title_lbl.pack(anchor="w")

        self.count_lbl = ctk.CTkLabel(
            title_box,
            text="تحميل الأسئلة...",
            font=Theme.small_font(11),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w"
        )
        self.count_lbl.pack(anchor="w")

        # Import PDF Button
        import_btn = SecondaryButton(
            inner,
            text="📥 استيراد من PDF",
            width=160,
            command=self._open_import_pdf_modal
        )
        import_btn.pack(side="right", padx=(0, 8))

        # Add Question Button
        add_btn = PrimaryButton(
            inner,
            text=f"➕ {t('btn_add_new_question')}",
            width=160,
            command=self._open_add_modal
        )
        add_btn.pack(side="right")

    
    def _on_search_key_release(self, event=None):
        if self._search_timer:
            self.after_cancel(self._search_timer)
        self._search_timer = self.after(300, self.refresh)

    def _build_filter_bar(self):
        f_bar = ctk.CTkFrame(self, fg_color="transparent")
        f_bar.grid(row=1, column=0, padx=24, pady=(0, 10), sticky="ew")

        # Search Entry
        self.search_entry = ctk.CTkEntry(
            f_bar,
            placeholder_text="🔍 ابحث في نص السؤال، الوسوم، أو الكلمات الدلالية...",
            width=260,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            border_color=Theme.BORDER,
            fg_color=Theme.BG_INPUT,
            font=Theme.body_font(12)
        )
        self.search_entry.pack(side="left", padx=(0, 4))
        self.search_entry.bind("<KeyRelease>", self._on_search_key_release)
        self.search_entry.bind("<Return>", lambda e: self.refresh())

        # Search Button
        search_btn = PrimaryButton(
            f_bar,
            text="🔍 بحث",
            width=80,
            height=36,
            command=self.refresh
        )
        search_btn.pack(side="left", padx=(0, 8))

        # Chapter Filter Dropdown
        chap_labels = [t("filter_all_chapters")] + [ch[:30] + "..." if len(ch) > 30 else ch for ch in self.chapters_list[1:]]
        self.chap_menu = ctk.CTkOptionMenu(
            f_bar,
            values=chap_labels,
            command=lambda v: self.refresh(),
            width=170,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_INPUT,
            button_color=Theme.BORDER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(12)
        )
        self.chap_menu.pack(side="left", padx=4)

        # Type Filter Dropdown
        type_options = [t("filter_all_types"), "اختيار من متعدد (MCQ)", "مقالي (Essay)", "صح أو خطأ (T/F)"]
        self.type_menu = ctk.CTkOptionMenu(
            f_bar,
            values=type_options,
            command=lambda v: self.refresh(),
            width=150,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_INPUT,
            button_color=Theme.BORDER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(12)
        )
        self.type_menu.pack(side="left", padx=4)

        # Difficulty Filter Dropdown
        diff_options = [t("filter_all_difficulties"), "سهل (Easy)", "متوسط (Medium)", "صعب (Hard)"]
        self.diff_menu = ctk.CTkOptionMenu(
            f_bar,
            values=diff_options,
            command=lambda v: self.refresh(),
            width=130,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_INPUT,
            button_color=Theme.BORDER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(12)
        )
        self.diff_menu.pack(side="left", padx=4)

        # Term Filter Dropdown
        term_options = ["جميع الفصول", "الفصل الأول", "الفصل الثاني", "الفصل الثالث"]
        self.term_menu = ctk.CTkOptionMenu(
            f_bar,
            values=term_options,
            command=lambda v: self.refresh(),
            width=130,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_INPUT,
            button_color=Theme.BORDER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(12)
        )
        self.term_menu.pack(side="left", padx=4)

        # Academic Year Filter Dropdown
        year_options = ["جميع السنوات", "2024-2025", "2025-2026", "2026-2027"]
        self.year_menu = ctk.CTkOptionMenu(
            f_bar,
            values=year_options,
            command=lambda v: self.refresh(),
            width=130,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_INPUT,
            button_color=Theme.BORDER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(12)
        )
        self.year_menu.pack(side="left", padx=4)

        # Reset Filter Button
        reset_btn = GhostButton(f_bar, text="🔄 إعادة ضبط", width=90, command=self._reset_filters)
        reset_btn.pack(side="right")

    def _build_table(self):
        cols = [
            {
                "key": "text",
                "title": t("col_question_text"),
                "weight": 4,
                "max_len": 50,
                "wraplength": 300,
                "clickable": True
            },
            {
                "key": "question_type",
                "title": t("col_type"),
                "weight": 1,
                "type": "badge",
                "color_map": {
                    "mcq": ("#EFF6FF", "#1E40AF"),
                    "essay": ("#F0FDFA", "#0D9488"),
                    "true_false": ("#F5F3FF", "#7C3AED")
                }
            },
            {"key": "chapter", "title": t("col_chapter"), "weight": 2, "max_len": 28},
            {
                "key": "difficulty",
                "title": t("col_difficulty"),
                "weight": 1,
                "type": "badge",
                "color_map": {
                    "easy": ("#ECFDF5", "#065F46"),
                    "medium": ("#FFFBEB", "#92400E"),
                    "hard": ("#FEF2F2", "#991B1B")
                }
            },
            {"key": "source", "title": t("col_source"), "weight": 2, "max_len": 25},
            {"key": "actions", "title": t("col_actions"), "weight": 3, "type": "actions", "align": "right"}
        ]
        actions = [
            {"label": "عرض", "key": "view", "style": "outline", "width": 45},
            {"label": "تعديل", "key": "edit", "style": "outline", "width": 45},
            {"label": "نسخ", "key": "duplicate", "style": "ghost", "width": 45},
            {"label": "حذف", "key": "delete", "style": "danger", "width": 45}
        ]

        self.table = DataTable(
            self,
            columns=cols,
            row_actions=actions,
            on_action=self._handle_table_action,
            on_cell_click=self._handle_cell_click,
            empty_message="لا توجد أسئلة تطابق معايير البحث الحالية."
        )
        self.table.grid(row=2, column=0, padx=24, pady=(0, 16), sticky="nsew")

    def refresh(self):
        search = self.search_entry.get().strip() if hasattr(self, "search_entry") else ""
        
        # Parse chapter filter
        ch_val = self.chap_menu.get() if hasattr(self, "chap_menu") else t("filter_all_chapters")
        if ch_val == t("filter_all_chapters"):
            chap_filter = None
        else:
            # find original chapter name
            idx = self.chap_menu._values.index(ch_val) if ch_val in self.chap_menu._values else 0
            chap_filter = self.chapters_list[idx] if idx < len(self.chapters_list) and self.chapters_list[idx] != "all" else None

        # Parse type filter
        type_val = self.type_menu.get() if hasattr(self, "type_menu") else t("filter_all_types")
        if "MCQ" in type_val:
            type_filter = "mcq"
        elif "Essay" in type_val or "مقالي" in type_val:
            type_filter = "essay"
        elif "T/F" in type_val or "صح" in type_val:
            type_filter = "true_false"
        else:
            type_filter = None

        # Parse difficulty filter
        diff_val = self.diff_menu.get() if hasattr(self, "diff_menu") else t("filter_all_difficulties")
        if "Easy" in diff_val or "سهل" in diff_val:
            diff_filter = "easy"
        elif "Medium" in diff_val or "متوسط" in diff_val:
            diff_filter = "medium"
        elif "Hard" in diff_val or "صعب" in diff_val:
            diff_filter = "hard"
        else:
            diff_filter = None

        # Parse term filter
        term_val = self.term_menu.get() if hasattr(self, "term_menu") else "جميع الفصول"
        if term_val == "جميع الفصول":
            term_filter = None
        else:
            term_filter = term_val

        # Parse academic year filter
        year_val = self.year_menu.get() if hasattr(self, "year_menu") else "جميع السنوات"
        if year_val == "جميع السنوات":
            year_filter = None
        else:
            year_filter = year_val

        questions = QuestionService.get_questions(
            search_query=search,
            chapter=chap_filter,
            question_type=type_filter,
            difficulty=diff_filter,
            term=term_filter,
            academic_year=year_filter,
            limit=250
        )

        self.table.set_data(questions)
        self.count_lbl.configure(text=f"إجمالي الأسئلة المعروضة: ({len(questions)}) سؤال")

    def _reset_filters(self):
        self.search_entry.delete(0, "end")
        self.chap_menu.set(t("filter_all_chapters"))
        self.type_menu.set(t("filter_all_types"))
        self.diff_menu.set(t("filter_all_difficulties"))
        self.term_menu.set("جميع الفصول")
        self.year_menu.set("جميع السنوات")
        self.refresh()

    def _handle_table_action(self, action_key: str, q_row: Dict[str, Any]):
        qid = q_row.get("id")
        if action_key == "view":
            full_q = QuestionService.get_question_by_id(qid)
            if full_q:
                QuestionViewModal(self.winfo_toplevel(), question=full_q)
        elif action_key == "edit":
            full_q = QuestionService.get_question_by_id(qid)
            if full_q:
                AddEditQuestionModal(
                    self.winfo_toplevel(),
                    chapters=self.chapters_list[1:],
                    sources=self.sources_list[1:],
                    question_data=full_q,
                    on_save=lambda data, q_id=qid: self._on_question_edited(q_id, data)
                )
        elif action_key == "duplicate":
            QuestionService.duplicate_question(qid)
            if self.on_notify:
                self.on_notify("تم تكرار السؤال بنجاح!", "success")
            self.refresh()
        elif action_key == "delete":
            ConfirmDialog(
                self.winfo_toplevel(),
                title="تأكيد حذف السؤال",
                message=t("msg_confirm_delete_q"),
                confirm_text="حذف نهائي",
                is_danger=True,
                on_confirm=lambda q_id=qid: self._on_question_deleted(q_id)
            )

    def _handle_cell_click(self, column: Dict[str, Any], q_row: Dict[str, Any]):
        if column.get("key") == "text":
            full_q = QuestionService.get_question_by_id(q_row.get("id"))
            if full_q:
                QuestionViewModal(self.winfo_toplevel(), question=full_q)

    def _open_add_modal(self):
        AddEditQuestionModal(
            self.winfo_toplevel(),
            chapters=self.chapters_list[1:],
            sources=self.sources_list[1:],
            on_save=self._on_question_created
        )

    def _open_import_pdf_modal(self):
        ImportPDFQuestionsModal(
            self.winfo_toplevel(),
            chapters=self.chapters_list[1:] or ["الفصل الأول", "الفصل الثاني", "الفصل الثالث"],
            sources=self.sources_list[1:] or ["كتاب الوزارة المعتمد", "ملف PDF مستورد"],
            on_import_complete=self._on_import_complete
        )

    def _on_import_complete(self, count: int):
        if self.on_notify:
            self.on_notify(f"تم استيراد ({count}) سؤال إلى بنك الأسئلة بنجاح!", "success")
        self.chapters_list = ["all"] + QuestionService.get_distinct_chapters()
        self.sources_list = ["all"] + QuestionService.get_distinct_sources()
        self.refresh()

    def _on_question_created(self, payload: Dict[str, Any]):
        QuestionService.create_question(payload)
        if self.on_notify:
            self.on_notify(t("msg_question_added"), "success")
        self.refresh()

    def _on_question_edited(self, qid: int, payload: Dict[str, Any]):
        QuestionService.update_question(qid, payload)
        if self.on_notify:
            self.on_notify(t("msg_question_updated"), "success")
        self.refresh()

    def _on_question_deleted(self, qid: int):
        QuestionService.delete_question(qid)
        if self.on_notify:
            self.on_notify(t("msg_question_deleted"), "info")
        self.refresh()
