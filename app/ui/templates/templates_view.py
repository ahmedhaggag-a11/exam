# Templates Catalog View
import customtkinter as ctk
from typing import Optional, Callable, Dict, Any
from app.config.theme import Theme
from app.config.i18n import t
from app.services import TemplateService
from app.ui.components import Card, Badge, OutlineButton, PrimaryButton, TemplatePreviewModal

class TemplatesView(ctk.CTkFrame):
    def __init__(
        self,
        master,
        on_notify: Optional[Callable[[str, str], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", corner_radius=0, **kwargs)
        self.on_notify = on_notify
        self.templates = TemplateService.get_all_templates()

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        self._build_header_banner()
        self._build_templates_grid()

    def _build_header_banner(self):
        banner = Card(self)
        banner.grid(row=0, column=0, padx=24, pady=(16, 12), sticky="ew")

        inner = ctk.CTkFrame(banner, fg_color="transparent")
        inner.pack(fill="x", padx=16, pady=12)

        ctk.CTkLabel(
            inner,
            text=f"🎨 {t('templates_title')}",
            font=Theme.title_font(16),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(anchor="w")

        ctk.CTkLabel(
            inner,
            text=f"{t('templates_subtitle')} • 🔒 {t('admin_locked_msg')}",
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w",
            wraplength=700
        ).pack(anchor="w", pady=(4, 0))

    def _build_templates_grid(self):
        scroll_grid = ctk.CTkScrollableFrame(self, fg_color="transparent")
        scroll_grid.grid(row=1, column=0, padx=24, pady=(0, 16), sticky="nsew")
        scroll_grid.grid_columnconfigure((0, 1), weight=1)

        for idx, tpl in enumerate(self.templates):
            r = idx // 2
            c = idx % 2
            self._render_card(scroll_grid, tpl, r, c)

    def _render_card(self, master, tpl: Dict[str, Any], row: int, col: int):
        card = Card(master)
        card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
        card.grid_columnconfigure(0, weight=1)

        inner = ctk.CTkFrame(card, fg_color="transparent")
        inner.pack(fill="both", expand=True, padx=16, pady=16)

        # Badge row
        top = ctk.CTkFrame(inner, fg_color="transparent")
        top.pack(fill="x", pady=(0, 8))
        
        Badge(top, text=tpl.get("badge", "معتمد"), bg_color=tpl.get("accent_color", "#2563EB"), text_color="#FFFFFF").pack(side="left")
        
        if tpl.get("is_default"):
            Badge(top, text="★ القالب الافتراضي", bg_color="#ECFDF5", text_color="#065F46").pack(side="right")

        # Name
        ctk.CTkLabel(
            inner,
            text=tpl.get("name_ar", ""),
            font=Theme.title_font(15),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(fill="x", pady=(4, 6))

        # Description
        ctk.CTkLabel(
            inner,
            text=tpl.get("description_ar", ""),
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            wraplength=340,
            justify="right",
            anchor="w"
        ).pack(fill="x", pady=(0, 14))

        # Buttons
        btn_box = ctk.CTkFrame(inner, fg_color="transparent")
        btn_box.pack(fill="x")

        prev_btn = OutlineButton(
            btn_box,
            text="👁️ معاينة التصميم",
            width=130,
            command=lambda tp=tpl: self._open_preview(tp)
        )
        prev_btn.pack(side="left")

        sel_btn = PrimaryButton(
            btn_box,
            text="تعيين كافتراضي",
            width=120,
            command=lambda: self._set_default(tpl)
        )
        sel_btn.pack(side="right")

    def _open_preview(self, tpl: Dict[str, Any]):
        TemplatePreviewModal(self.winfo_toplevel(), template_data=tpl)

    def _set_default(self, tpl: Dict[str, Any]):
        template_id = tpl.get("id")
        if template_id is None or not TemplateService.set_default_template(template_id):
            if self.on_notify:
                self.on_notify("تعذر تعيين القالب الافتراضي.", "error")
            return

        self.templates = TemplateService.get_all_templates()
        self._build_templates_grid()
        if self.on_notify:
            self.on_notify(f"تم تعيين '{tpl.get('name_ar')}' كقالب افتراضي لطباعة الاختبارات.", "success")
