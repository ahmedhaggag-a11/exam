# Dashboard View
import customtkinter as ctk
from typing import Callable, Dict, Any, Optional
from app.config.theme import Theme
from app.config.i18n import t, is_rtl
from app.config.settings import TeacherProfile
from app.services import QuestionService, ExamService, SourceService
from app.ui.components import (
    Card, StatCard, PrimaryButton, SecondaryButton, OutlineButton,
    DataTable, AddEditQuestionModal, ConfirmDialog, ExportSuccessModal,
    GenerateExamProgressModal
)

class DashboardView(ctk.CTkScrollableFrame):
    def __init__(
        self,
        master,
        on_navigate: Optional[Callable[[str], None]] = None,
        on_notify: Optional[Callable[[str, str], None]] = None,
        **kwargs
    ):
        super().__init__(
            master,
            fg_color="transparent",
            corner_radius=0,
            **kwargs
        )
        self.on_navigate = on_navigate
        self.on_notify = on_notify

        self.grid_columnconfigure(0, weight=1)
        self.refresh()

    def refresh(self):
        for w in self.winfo_children():
            w.destroy()

        # Load fresh data
        q_stats = QuestionService.get_questions_stats()
        e_stats = ExamService.get_exam_stats()
        sources_count = SourceService.get_sources_count()

        # 1. Welcome Section Banner
        self._build_welcome_banner()

        # 2. Stat Cards Grid
        self._build_stat_cards(q_stats, e_stats, sources_count)

        # 3. Quick Actions Row
        self._build_quick_actions()

        # 4. Recent Exams Table & Analytics Grid
        self._build_main_content_split(e_stats, q_stats)

    def _build_welcome_banner(self):
        banner = Card(self, corner_radius=Theme.CORNER_RADIUS_LG)
        banner.pack(fill="x", padx=24, pady=(16, 12))
        banner.grid_columnconfigure(0, weight=1)

        inner = ctk.CTkFrame(banner, fg_color="transparent")
        inner.pack(fill="x", padx=20, pady=16)

        text_anchor = "e" if is_rtl() else "w"

        # Welcome text
        w_title = ctk.CTkLabel(
            inner,
            text=f"{t('dash_welcome')} {TeacherProfile.NAME_AR} 👋",
            font=Theme.title_font(20),
            text_color=Theme.TEXT_PRIMARY,
            anchor=text_anchor
        )
        w_title.pack(anchor=text_anchor)

        w_sub = ctk.CTkLabel(
            inner,
            text=f"{TeacherProfile.TITLE_AR} • {t('dash_welcome_sub')}",
            font=Theme.body_font(13),
            text_color=Theme.TEXT_SECONDARY,
            anchor=text_anchor
        )
        w_sub.pack(anchor=text_anchor, pady=(4, 0))

    def _build_stat_cards(self, q_stats: Dict[str, Any], e_stats: Dict[str, Any], sources_count: int):
        grid = ctk.CTkFrame(self, fg_color="transparent")
        grid.pack(fill="x", padx=24, pady=8)
        grid.grid_columnconfigure((0, 1, 2, 3), weight=1)

        # Stat 1: Total Questions
        s1 = StatCard(
            grid,
            title=t("stat_total_questions"),
            value=str(q_stats.get("total", 0)),
            icon_symbol="📚",
            accent_color="#2563EB",
            on_click=lambda: self._navigate_to("question_bank")
        )
        s1.grid(row=0, column=0, padx=(0, 8), sticky="ew")

        # Stat 2: Total Exams
        s2 = StatCard(
            grid,
            title=t("stat_total_exams"),
            value=str(e_stats.get("total_exams", 0)),
            icon_symbol="📑",
            accent_color="#0D9488",
            on_click=lambda: self._navigate_to("exams")
        )
        s2.grid(row=0, column=1, padx=4, sticky="ew")

        # Stat 3: Total Models Generated
        s3 = StatCard(
            grid,
            title=t("stat_total_models"),
            value=str(e_stats.get("total_models", 0)),
            icon_symbol="🗂️",
            accent_color="#7C3AED"
        )
        s3.grid(row=0, column=2, padx=4, sticky="ew")

        # Stat 4: Approved Sources
        s4 = StatCard(
            grid,
            title=t("stat_total_sources"),
            value=str(sources_count),
            icon_symbol="📖",
            accent_color="#D97706",
            on_click=lambda: self._navigate_to("sources")
        )
        s4.grid(row=0, column=3, padx=(8, 0), sticky="ew")

    def _build_quick_actions(self):
        actions_bar = ctk.CTkFrame(self, fg_color="transparent")
        actions_bar.pack(fill="x", padx=24, pady=8)

        label_side = "right" if is_rtl() else "left"
        btn_side = "right" if is_rtl() else "left"
        label_padx = (12, 0) if is_rtl() else (0, 12)

        lbl = ctk.CTkLabel(
            actions_bar,
            text=f"⚡ {t('dash_quick_actions')}:",
            font=Theme.bold_font(13),
            text_color=Theme.TEXT_SECONDARY
        )
        lbl.pack(side=label_side, padx=label_padx)

        # Action 1: Create Exam (first on the right in RTL)
        btn1 = PrimaryButton(
            actions_bar,
            text=f"✨ {t('action_create_exam')}",
            width=160,
            command=lambda: self._navigate_to("create_exam")
        )
        btn1.pack(side=btn_side, padx=4)

        # Action 2: Add Question
        btn2 = SecondaryButton(
            actions_bar,
            text=f"➕ {t('action_add_question')}",
            width=150,
            command=self._open_add_question_modal
        )
        btn2.pack(side=btn_side, padx=4)

        # Action 3: Open Question Bank
        btn3 = OutlineButton(
            actions_bar,
            text=f"📚 {t('action_open_bank')}",
            width=150,
            command=lambda: self._navigate_to("question_bank")
        )
        btn3.pack(side=btn_side, padx=4)

        # Action 4: Manage Templates
        btn4 = OutlineButton(
            actions_bar,
            text=f"🎨 {t('action_manage_templates')}",
            width=140,
            command=lambda: self._navigate_to("templates")
        )
        btn4.pack(side=btn_side, padx=4)

    def _build_main_content_split(self, e_stats: Dict[str, Any], q_stats: Dict[str, Any]):
        split = ctk.CTkFrame(self, fg_color="transparent")
        split.pack(fill="both", expand=True, padx=24, pady=12)
        # Keep analytics useful but compact, giving the exam table more room.
        split.grid_columnconfigure(0, weight=1)
        split.grid_columnconfigure(1, weight=6)

        # Left Column: Analytics Cards
        left_box = Card(split, corner_radius=Theme.CORNER_RADIUS_MD)
        left_box.grid(row=0, column=0, padx=(0, 10), sticky="nsew")
        
        a_inner = ctk.CTkFrame(left_box, fg_color="transparent")
        a_inner.pack(fill="both", expand=True, padx=12, pady=12)

        text_anchor = "e" if is_rtl() else "w"
        label_side = "right" if is_rtl() else "left"
        btn_side = "left" if is_rtl() else "right"

        ctk.CTkLabel(
            a_inner,
            text=f"📊 {t('dash_analytics_title')}",
            font=Theme.title_font(14),
            text_color=Theme.TEXT_PRIMARY,
            anchor=text_anchor
        ).pack(fill="x", pady=(0, 8))

        # Section 1: Difficulty Breakdown
        self._render_analytics_bar(
            a_inner,
            title=t("dash_by_difficulty"),
            items=[
                ("سهل (Easy)", q_stats.get("difficulty", {}).get("easy", 0), "#10B981"),
                ("متوسط (Medium)", q_stats.get("difficulty", {}).get("medium", 0), "#F59E0B"),
                ("صعب (Hard)", q_stats.get("difficulty", {}).get("hard", 0), "#EF4444")
            ],
            total=q_stats.get("total", 1)
        )

        # Section 2: Question Type Breakdown
        self._render_analytics_bar(
            a_inner,
            title=t("dash_by_type"),
            items=[
                ("اختيار من متعدد (MCQ)", q_stats.get("types", {}).get("mcq", 0), "#2563EB"),
                ("مقالي (Essay)", q_stats.get("types", {}).get("essay", 0), "#0D9488"),
                ("صح أو خطأ (T/F)", q_stats.get("types", {}).get("true_false", 0), "#8B5CF6")
            ],
            total=q_stats.get("total", 1)
        )

        # Right Column: Recent Exams Table (Larger)
        right_box = ctk.CTkFrame(split, fg_color="transparent")
        right_box.grid(row=0, column=1, padx=(10, 0), sticky="nsew")

        r_hdr = ctk.CTkFrame(right_box, fg_color="transparent")
        r_hdr.pack(fill="x", pady=(0, 8))

        ctk.CTkLabel(
            r_hdr,
            text=f"📑 {t('dash_recent_exams')}",
            font=Theme.title_font(15),
            text_color=Theme.TEXT_PRIMARY
        ).pack(side=label_side)

        ctk.CTkButton(
            r_hdr,
            text=f"{t('dash_view_all_exams')} →",
            fg_color="transparent",
            hover_color=Theme.BG_HOVER,
            text_color=Theme.PRIMARY[0],
            font=Theme.bold_font(12),
            command=lambda: self._navigate_to("exams")
        ).pack(side=btn_side)

        # Table
        cols = [
            {"key": "name", "title": t("col_exam_name"), "weight": 3, "max_len": 35},
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
            {"key": "actions", "title": t("col_actions"), "weight": 2, "type": "actions", "align": "right"}
        ]
        actions = [
            {"label": "PDF", "key": "export", "style": "outline", "width": 45},
            {"label": "فتح", "key": "open", "style": "outline", "width": 45}
        ]

        self.table = DataTable(
            right_box,
            columns=cols,
            row_actions=actions,
            on_action=self._handle_table_action,
            empty_message="لا توجد اختبارات منشأة بعد. ابدأ بإنشاء اختبارك الأول!"
        )
        self.table.pack(fill="both", expand=True)
        self.table.set_data(e_stats.get("recent", []))

    def _render_analytics_bar(self, master, title: str, items: list, total: int):
        box = ctk.CTkFrame(master, fg_color="transparent")
        box.pack(fill="x", pady=(0, 8))

        text_anchor = "e" if is_rtl() else "w"
        text_sticky = "e" if is_rtl() else "w"

        ctk.CTkLabel(box, text=title, font=Theme.bold_font(11), text_color=Theme.TEXT_PRIMARY, anchor=text_anchor).pack(fill="x", pady=(0, 4))

        for name, count, color in items:
            row = ctk.CTkFrame(box, fg_color="transparent")
            row.pack(fill="x", pady=1)
            row.grid_columnconfigure(1, weight=1)

            # RTL: Reverse column order - Count on left, Progress middle, Label on right
            if is_rtl():
                # Count label on the left side (col 0)
                ctk.CTkLabel(row, text=str(count), font=Theme.bold_font(10), text_color=Theme.TEXT_PRIMARY, width=24, anchor="w").grid(row=0, column=0, sticky="w")

                # Progress bar in middle (col 1)
                ratio = min(1.0, max(0.0, count / max(1, total)))
                pb = ctk.CTkProgressBar(row, height=6, corner_radius=3, fg_color=Theme.BORDER[0], progress_color=color)
                pb.grid(row=0, column=1, padx=5, sticky="ew")
                pb.set(ratio)

                # Name label on the right side (col 2)
                ctk.CTkLabel(row, text=name, font=Theme.body_font(10), text_color=Theme.TEXT_SECONDARY, width=112, anchor="e").grid(row=0, column=2, sticky="e")
            else:
                # LTR: Name on left, Progress middle, Count on right
                ctk.CTkLabel(row, text=name, font=Theme.body_font(10), text_color=Theme.TEXT_SECONDARY, width=112, anchor="w").grid(row=0, column=0, sticky="w")
                
                # Progress bar
                ratio = min(1.0, max(0.0, count / max(1, total)))
                pb = ctk.CTkProgressBar(row, height=6, corner_radius=3, fg_color=Theme.BORDER[0], progress_color=color)
                pb.grid(row=0, column=1, padx=5, sticky="ew")
                pb.set(ratio)

                ctk.CTkLabel(row, text=str(count), font=Theme.bold_font(10), text_color=Theme.TEXT_PRIMARY, width=24, anchor="e").grid(row=0, column=2, sticky="e")

    def _handle_table_action(self, action_key: str, exam_row: Dict[str, Any]):
        if action_key == "export":
            ExportSuccessModal(self.winfo_toplevel(), exam_name=exam_row.get("name", "exam"), models_count=exam_row.get("models_count", 4))
        elif action_key == "open":
            self._navigate_to("exams")

    def _open_add_question_modal(self):
        chapters = QuestionService.get_distinct_chapters()
        sources = QuestionService.get_distinct_sources()
        AddEditQuestionModal(
            self.winfo_toplevel(),
            chapters=chapters,
            sources=sources,
            on_save=self._on_question_created
        )

    def _on_question_created(self, payload: Dict[str, Any]):
        QuestionService.create_question(payload)
        if self.on_notify:
            self.on_notify("تمت إضافة السؤال بنجاح إلى بنك الأسئلة!", "success")
        self.refresh()

    def _navigate_to(self, route: str):
        if self.on_navigate:
            self.on_navigate(route)
