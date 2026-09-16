# Step 3: Question Selection Mode (Auto / Manual)
import customtkinter as ctk
from typing import Dict, Any, List
from app.config.theme import Theme
from app.config.i18n import t
from app.services import QuestionService
from app.ui.components import Card, Badge, OutlineButton, PrimaryButton, GhostButton

class Step3QuestionSelect(ctk.CTkFrame):
    def __init__(self, master, wizard_state: Dict[str, Any], **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.wizard_state = wizard_state
        self.selected_q_ids = set(wizard_state.get("selected_question_ids", []))
        self.mode = wizard_state.get("selection_mode", "auto")
        self.all_questions = QuestionService.get_questions(limit=300)
        self.q_check_vars = {}

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        self._build_ui()

    def _build_ui(self):
        for w in self.winfo_children():
            w.destroy()

        # Top Mode Selector Bar
        top_bar = Card(self)
        top_bar.grid(row=0, column=0, padx=20, pady=(10, 8), sticky="ew")
        top_bar.grid_columnconfigure((0, 1), weight=1)

        self.auto_btn = ctk.CTkButton(
            top_bar,
            text=f"✨ {t('mode_auto')}",
            height=42,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.PRIMARY[0] if self.mode == "auto" else "transparent",
            hover_color=Theme.PRIMARY_HOVER[0] if self.mode == "auto" else Theme.BG_HOVER,
            text_color="#FFFFFF" if self.mode == "auto" else Theme.TEXT_PRIMARY,
            font=Theme.bold_font(13),
            command=lambda: self._set_mode("auto")
        )
        self.auto_btn.grid(row=0, column=0, padx=8, pady=8, sticky="ew")

        self.manual_btn = ctk.CTkButton(
            top_bar,
            text=f"✍️ {t('mode_manual')}",
            height=42,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.PRIMARY[0] if self.mode == "manual" else "transparent",
            hover_color=Theme.PRIMARY_HOVER[0] if self.mode == "manual" else Theme.BG_HOVER,
            text_color="#FFFFFF" if self.mode == "manual" else Theme.TEXT_PRIMARY,
            font=Theme.bold_font(13),
            command=lambda: self._set_mode("manual")
        )
        self.manual_btn.grid(row=0, column=1, padx=8, pady=8, sticky="ew")

        # Main Selection Container
        if self.mode == "auto":
            self._render_auto_mode()
        else:
            self._render_manual_mode()

    def _set_mode(self, mode: str):
        self.mode = mode
        self.wizard_state["selection_mode"] = mode
        self._build_ui()

    def _render_auto_mode(self):
        container = Card(self)
        container.grid(row=1, column=0, padx=20, pady=(0, 10), sticky="nsew")
        container.grid_columnconfigure(0, weight=1)
        container.grid_rowconfigure(2, weight=1)

        # Header
        h_box = ctk.CTkFrame(container, fg_color="transparent")
        h_box.grid(row=0, column=0, padx=16, pady=(14, 4), sticky="ew")
        
        ctk.CTkLabel(h_box, text=t("mode_auto_desc"), font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY, wraplength=600, justify="right").pack(side="left")

        # Refresh / Regenerate button
        regen_btn = OutlineButton(h_box, text="🔄 إعادة توليد التشكيلة", width=150, command=self._do_auto_selection)
        regen_btn.pack(side="right")

        # Live Questions List
        if not self.selected_q_ids:
            self._do_auto_selection(render=False)

        q_list_frame = ctk.CTkScrollableFrame(container, fg_color="transparent")
        q_list_frame.grid(row=2, column=0, padx=16, pady=8, sticky="nsew")
        q_list_frame.grid_columnconfigure(0, weight=1)

        selected_questions = [q for q in self.all_questions if q["id"] in self.selected_q_ids]
        
        target = self.wizard_state.get("total_questions", 15)
        count_lbl = ctk.CTkLabel(container, text=f"تم انتقاء ({len(selected_questions)}) سؤال تلقائياً يطابق المواصفات", font=Theme.bold_font(12), text_color=Theme.PRIMARY[0])
        count_lbl.grid(row=1, column=0, padx=16, pady=2, sticky="w")

        for idx, q in enumerate(selected_questions):
            self._render_question_card(q_list_frame, q, idx + 1, is_checkable=False)

    def _do_auto_selection(self, render: bool = True):
        target = self.wizard_state.get("total_questions", 15)
        type_quotas = {
            "mcq": self.wizard_state.get("mcq_count", 10),
            "essay": self.wizard_state.get("essay_count", 3),
            "true_false": self.wizard_state.get("tf_count", 2)
        }
        diff_quotas = {
            "easy": self.wizard_state.get("easy_count", 5),
            "medium": self.wizard_state.get("medium_count", 7),
            "hard": self.wizard_state.get("hard_count", 3)
        }
        chaps = self.wizard_state.get("selected_chapters", [])

        picked = QuestionService.auto_select_questions(target, type_quotas, diff_quotas, chaps)
        self.selected_q_ids = set(q["id"] for q in picked)
        if render:
            self._build_ui()

    def _render_manual_mode(self):
        container = Card(self)
        container.grid(row=1, column=0, padx=20, pady=(0, 10), sticky="nsew")
        container.grid_columnconfigure(0, weight=1)
        container.grid_rowconfigure(2, weight=1)

        # Top filter bar
        f_box = ctk.CTkFrame(container, fg_color="transparent")
        f_box.grid(row=0, column=0, padx=16, pady=12, sticky="ew")

        target = self.wizard_state.get("total_questions", 15)
        self.manual_count_lbl = ctk.CTkLabel(
            f_box,
            text=f"تم تحديد: {len(self.selected_q_ids)} من {target} سؤال مطلوب",
            font=Theme.bold_font(13),
            text_color=Theme.PRIMARY[0]
        )
        self.manual_count_lbl.pack(side="left")

        # Search and filter controls
        search_box = ctk.CTkFrame(f_box, fg_color="transparent")
        search_box.pack(side="right", padx=(0, 8))
        
        self.search_entry = ctk.CTkEntry(
            search_box,
            placeholder_text="🔍 بحث في الأسئلة...",
            width=200,
            height=28,
            corner_radius=Theme.CORNER_RADIUS_SM,
            fg_color=Theme.BG_INPUT,
            font=Theme.body_font(11)
        )
        self.search_entry.pack(side="left", padx=(0, 4))
        self.search_entry.bind("<KeyRelease>", lambda e: self._filter_questions())
        self.search_entry.bind("<Return>", lambda e: self._filter_questions())

        # Search Button
        search_btn = PrimaryButton(
            search_box,
            text="🔍 بحث",
            width=65,
            height=28,
            command=self._filter_questions
        )
        search_btn.pack(side="left", padx=(0, 6))

        # Chapter filter
        self.chapters = QuestionService.get_distinct_chapters()
        self.chapter_filter = ctk.CTkOptionMenu(
            search_box,
            values=["جميع الفصول"] + self.chapters,
            command=lambda v: self._filter_questions(),
            width=120,
            height=28,
            corner_radius=Theme.CORNER_RADIUS_SM,
            fg_color=Theme.BG_INPUT,
            font=Theme.body_font(11)
        )
        self.chapter_filter.pack(side="left")

        # Select All / Clear All
        btn_box = ctk.CTkFrame(f_box, fg_color="transparent")
        btn_box.pack(side="right")
        
        ctk.CTkButton(btn_box, text="تحديد الكل", width=80, height=28, fg_color="transparent", text_color=Theme.PRIMARY[0], command=self._select_all).pack(side="left", padx=2)
        ctk.CTkButton(btn_box, text="إلغاء التحديد", width=80, height=28, fg_color="transparent", text_color=Theme.DANGER[0], command=self._clear_all).pack(side="left", padx=2)

        # Questions Scroll List
        self.q_list_frame = ctk.CTkScrollableFrame(container, fg_color="transparent")
        self.q_list_frame.grid(row=2, column=0, padx=16, pady=8, sticky="nsew")
        self.q_list_frame.grid_columnconfigure(0, weight=1)

        self._render_filtered_questions()

    def _filter_questions(self):
        self._render_filtered_questions()

    def _render_filtered_questions(self):
        # Clear existing questions
        for w in self.q_list_frame.winfo_children():
            w.destroy()

        search_term = self.search_entry.get().lower() if hasattr(self, "search_entry") else ""
        chapter_filter = self.chapter_filter.get() if hasattr(self, "chapter_filter") else "جميع الفصول"

        filtered_questions = []
        for q in self.all_questions:
            # Apply search filter
            if search_term and search_term not in q["text"].lower():
                continue
            
            # Apply chapter filter
            if chapter_filter != "جميع الفصول" and q["chapter"] != chapter_filter:
                continue
            
            filtered_questions.append(q)

        for idx, q in enumerate(filtered_questions):
            self._render_question_card(self.q_list_frame, q, idx + 1, is_checkable=True)

    def _render_question_card(self, master, q: Dict[str, Any], num: int, is_checkable: bool = False):
        card = ctk.CTkFrame(master, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_SM)
        card.pack(fill="x", pady=4)
        card.grid_columnconfigure(1, weight=1)

        if is_checkable:
            var = ctk.BooleanVar(value=(q["id"] in self.selected_q_ids))
            cb = ctk.CTkCheckBox(
                card,
                text="",
                variable=var,
                width=24,
                command=lambda qid=q["id"], v=var: self._toggle_question(qid, v)
            )
            cb.grid(row=0, column=0, padx=(10, 4), pady=10)
            self.q_check_vars[q["id"]] = var
        else:
            num_lbl = ctk.CTkLabel(card, text=f"#{num}", font=Theme.bold_font(11), text_color=Theme.PRIMARY[0], width=30)
            num_lbl.grid(row=0, column=0, padx=(10, 4), pady=10)

        # Text and badges
        info_box = ctk.CTkFrame(card, fg_color="transparent")
        info_box.grid(row=0, column=1, padx=6, pady=8, sticky="ew")

        # Badges row
        b_row = ctk.CTkFrame(info_box, fg_color="transparent")
        b_row.pack(fill="x", pady=(0, 4))
        
        type_labels = {"mcq": "MCQ", "essay": "مقالي", "true_false": "صح/خطأ"}
        Badge(b_row, text=type_labels.get(q["question_type"], q["question_type"]), bg_color="#EFF6FF", text_color="#1E40AF", size="small").pack(side="left", padx=2)

        diff_colors = {"easy": ("#ECFDF5", "#065F46", "سهل"), "medium": ("#FFFBEB", "#92400E", "متوسط"), "hard": ("#FEF2F2", "#991B1B", "صعب")}
        d_bg, d_fg, d_name = diff_colors.get(q["difficulty"], ("#EFF6FF", "#1E40AF", q["difficulty"]))
        Badge(b_row, text=d_name, bg_color=d_bg, text_color=d_fg, size="small").pack(side="left", padx=2)

        Badge(b_row, text=q.get("chapter", "")[:28] + "...", bg_color="#F1F5F9", text_color="#475569", size="small").pack(side="left", padx=2)

        # Statement
        stmt = ctk.CTkLabel(info_box, text=q.get("text", ""), font=Theme.body_font(12), text_color=Theme.TEXT_PRIMARY, wraplength=600, justify="right", anchor="w")
        stmt.pack(fill="x")

    def _toggle_question(self, qid: int, var: ctk.BooleanVar):
        if var.get():
            self.selected_q_ids.add(qid)
        else:
            self.selected_q_ids.discard(qid)
        
        target = self.wizard_state.get("total_questions", 15)
        if hasattr(self, "manual_count_lbl"):
            self.manual_count_lbl.configure(text=f"تم تحديد: {len(self.selected_q_ids)} من {target} سؤال مطلوب")

    def _select_all(self):
        # Get currently filtered questions
        search_term = self.search_entry.get().lower() if hasattr(self, "search_entry") else ""
        chapter_filter = self.chapter_filter.get() if hasattr(self, "chapter_filter") else "جميع الفصول"
        
        for q in self.all_questions:
            # Apply same filters as _render_filtered_questions
            if search_term and search_term not in q["text"].lower():
                continue
            if chapter_filter != "جميع الفصول" and q["chapter"] != chapter_filter:
                continue
            
            self.selected_q_ids.add(q["id"])
        
        # Re-render to update checkboxes
        self._render_filtered_questions()
        
        target = self.wizard_state.get("total_questions", 15)
        if hasattr(self, "manual_count_lbl"):
            self.manual_count_lbl.configure(text=f"تم تحديد: {len(self.selected_q_ids)} من {target} سؤال مطلوب")

    def _clear_all(self):
        # Clear only currently filtered questions
        search_term = self.search_entry.get().lower() if hasattr(self, "search_entry") else ""
        chapter_filter = self.chapter_filter.get() if hasattr(self, "chapter_filter") else "جميع الفصول"
        
        for q in self.all_questions:
            # Apply same filters as _render_filtered_questions
            if search_term and search_term not in q["text"].lower():
                continue
            if chapter_filter != "جميع الفصول" and q["chapter"] != chapter_filter:
                continue
            
            self.selected_q_ids.discard(q["id"])
        
        # Re-render to update checkboxes
        self._render_filtered_questions()
        
        target = self.wizard_state.get("total_questions", 15)
        if hasattr(self, "manual_count_lbl"):
            self.manual_count_lbl.configure(text=f"تم تحديد: {len(self.selected_q_ids)} من {target} سؤال مطلوب")

    def save_state(self):
        self.wizard_state["selected_question_ids"] = list(self.selected_q_ids)

    def validate(self) -> bool:
        return len(self.selected_q_ids) > 0
