# Educational Sources View (Read-Only Provider)
import customtkinter as ctk
from typing import Optional, Callable, Dict, Any
from app.config.theme import Theme
from app.config.i18n import t
from app.services import SourceService, QuestionService
from app.ui.components import Card, Badge, DataTable, SecondaryButton, ImportPDFQuestionsModal

class SourcesView(ctk.CTkFrame):
    def __init__(
        self,
        master,
        on_notify: Optional[Callable[[str, str], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", corner_radius=0, **kwargs)
        self.on_notify = on_notify
        self.sources = SourceService.get_all_sources()

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        self._build_header_banner()
        self._build_sources_table()

    def _build_header_banner(self):
        banner = Card(self)
        banner.grid(row=0, column=0, padx=24, pady=(16, 12), sticky="ew")

        inner = ctk.CTkFrame(banner, fg_color="transparent")
        inner.pack(fill="x", padx=16, pady=12)

        actions = ctk.CTkFrame(inner, fg_color="transparent")
        actions.pack(side="right", padx=(12, 0))
        SecondaryButton(
            actions,
            text="📥 استيراد مصدر PDF",
            width=170,
            command=self._open_import_pdf_modal
        ).pack()

        ctk.CTkLabel(
            inner,
            text=f"📖 {t('sources_title')}",
            font=Theme.title_font(16),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(anchor="w")

        ctk.CTkLabel(
            inner,
            text=f"{t('sources_subtitle')} • 🔒 {t('admin_locked_msg')}",
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w",
            wraplength=700
        ).pack(anchor="w", pady=(4, 0))

    def _open_import_pdf_modal(self):
        chapters = [
            chapter for chapter in QuestionService.get_distinct_chapters()
            if chapter
        ]
        ImportPDFQuestionsModal(
            self.winfo_toplevel(),
            chapters=chapters or ["الباب الأول", "الباب الثاني", "الباب الثالث"],
            sources=[source.get("name_ar", "") for source in self.sources if source.get("name_ar")],
            on_import_complete=self._on_import_complete
        )

    def _on_import_complete(self, count: int):
        self.sources = SourceService.get_all_sources()
        self._build_sources_table()
        if self.on_notify:
            self.on_notify(f"تم استيراد المصدر وإضافة ({count}) سؤالاً بنجاح.", "success")

    def _build_sources_table(self):
        for child in self.grid_slaves(row=1, column=0):
            child.destroy()

        cols = [
            {"key": "name_ar", "title": t("col_source_name"), "weight": 4, "max_len": 55},
            {"key": "subject", "title": t("col_subject"), "weight": 1},
            {"key": "chapter_count", "title": t("col_chapters_count"), "weight": 1},
            {"key": "question_count", "title": t("col_questions_count"), "weight": 1},
            {
                "key": "status_ar",
                "title": t("col_status"),
                "weight": 1,
                "type": "badge",
                "color_map": {
                    "معتمد رسمياً": ("#ECFDF5", "#065F46"),
                    "حصري للمعلم": ("#EFF6FF", "#1E40AF")
                }
            },
            {"key": "last_updated", "title": t("col_last_updated"), "weight": 1}
        ]

        table = DataTable(
            self,
            columns=cols,
            row_actions=[],
            empty_message="لا توجد مصادر تعليمية متاحة."
        )
        table.grid(row=1, column=0, padx=24, pady=(0, 16), sticky="nsew")
        table.set_data(self.sources)
