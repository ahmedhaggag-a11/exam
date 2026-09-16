# Step 5: Exam Template Selection
import customtkinter as ctk
from typing import Dict, Any, List
from app.config.theme import Theme
from app.config.i18n import t
from app.services import TemplateService
from app.ui.components import Card, Badge, OutlineButton, PrimaryButton, TemplatePreviewModal

class Step5TemplateSelect(ctk.CTkFrame):
    def __init__(self, master, wizard_state: Dict[str, Any], **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.wizard_state = wizard_state
        self.templates = TemplateService.get_all_templates() or []

        # Resolve initial selection: template_id > template_name > first default
        self.selected_tpl_id = wizard_state.get("template_id")
        self.selected_tpl_name = wizard_state.get("template_name", "الكلاسيكي المعتمد (Standard Ministry)")
        if self.selected_tpl_id:
            for t in self.templates:
                if t["id"] == self.selected_tpl_id:
                    self.selected_tpl_name = t["name_ar"]
                    break
        elif self.selected_tpl_name:
            for t in self.templates:
                if t["name_ar"] == self.selected_tpl_name:
                    self.selected_tpl_id = t["id"]
                    break
        if self.selected_tpl_id is None and self.templates:
            default_tpl = next((t for t in self.templates if t.get("is_default")), self.templates[0])
            self.selected_tpl_id = default_tpl["id"]
            self.selected_tpl_name = default_tpl["name_ar"]

        self.template_cards = []

        self.grid_columnconfigure(0, weight=1)
        self._build_ui()

    def _build_ui(self):
        container = Card(self)
        container.pack(fill="both", expand=True, padx=20, pady=10)
        container.grid_columnconfigure(0, weight=1)

        # Header
        ctk.CTkLabel(
            container,
            text=f"🎨 {t('step5_title')}",
            font=Theme.title_font(16),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(fill="x", padx=20, pady=(16, 2))

        ctk.CTkLabel(
            container,
            text=t("step5_subtitle"),
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w"
        ).pack(fill="x", padx=20, pady=(0, 16))

        # Templates Grid
        grid = ctk.CTkScrollableFrame(container, fg_color="transparent")
        grid.pack(fill="both", expand=True, padx=16, pady=(0, 16))
        grid.grid_columnconfigure((0, 1), weight=1)

        for idx, tpl in enumerate(self.templates):
            r = idx // 2
            c = idx % 2
            self._render_template_card(grid, tpl, r, c)

    def _render_template_card(self, master, tpl: Dict[str, Any], row: int, col: int):
        is_selected = (tpl["id"] == self.selected_tpl_id) or (tpl["name_ar"] == self.selected_tpl_name and self.selected_tpl_id is None)
        card = ctk.CTkFrame(
            master,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.PRIMARY_LIGHT if is_selected else Theme.BG_CARD_ALT,
            border_color=Theme.PRIMARY[0] if is_selected else Theme.BORDER,
            border_width=2 if is_selected else 1
        )
        card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
        card.grid_columnconfigure(0, weight=1)

        # Inner content
        c_inner = ctk.CTkFrame(card, fg_color="transparent")
        c_inner.pack(fill="both", expand=True, padx=16, pady=14)

        # Top badge
        top_row = ctk.CTkFrame(c_inner, fg_color="transparent")
        top_row.pack(fill="x", pady=(0, 6))
        
        Badge(top_row, text=tpl.get("badge", "معتمد"), bg_color=tpl.get("accent_color", "#2563EB"), text_color="#FFFFFF", size="small").pack(side="left")

        if is_selected:
            Badge(top_row, text="✓ تم الاختيار", bg_color="#ECFDF5", text_color="#065F46", size="small").pack(side="right")

        # Template Name
        t_name = ctk.CTkLabel(
            c_inner,
            text=tpl.get("name_ar", ""),
            font=Theme.bold_font(14),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        t_name.pack(fill="x", pady=(2, 4))

        # Description
        t_desc = ctk.CTkLabel(
            c_inner,
            text=tpl.get("description_ar", ""),
            font=Theme.body_font(11),
            text_color=Theme.TEXT_SECONDARY,
            wraplength=280,
            justify="right",
            anchor="w"
        )
        t_desc.pack(fill="x", pady=(0, 12))

        # Action Buttons
        btn_box = ctk.CTkFrame(c_inner, fg_color="transparent")
        btn_box.pack(fill="x", pady=(4, 0))

        prev_btn = OutlineButton(
            btn_box,
            text=t("btn_preview_template"),
            width=110,
            height=30,
            command=lambda tp=tpl: self._preview_template(tp)
        )
        prev_btn.pack(side="left", padx=(0, 6))

        sel_btn = PrimaryButton(
            btn_box,
            text="اختيار القالب",
            width=100,
            height=30,
            command=lambda tp=tpl: self._select_template(tp)
        )
        sel_btn.pack(side="right")

    def _select_template(self, tpl: Dict[str, Any]):
        self.selected_tpl_id = tpl["id"]
        self.selected_tpl_name = tpl["name_ar"]
        self.wizard_state["template_id"] = tpl["id"]
        self.wizard_state["template_name"] = tpl["name_ar"]
        self._build_ui()

    def _preview_template(self, tpl: Dict[str, Any]):
        TemplatePreviewModal(self.winfo_toplevel(), template_data=tpl)

    def save_state(self):
        self.wizard_state["template_id"] = self.selected_tpl_id
        self.wizard_state["template_name"] = self.selected_tpl_name

    def validate(self) -> bool:
        return bool(self.selected_tpl_name) or self.selected_tpl_id is not None
