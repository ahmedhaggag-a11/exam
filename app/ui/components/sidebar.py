# Modern Application Sidebar Navigation
import customtkinter as ctk
from typing import Callable, Dict, Any, List
from app.config.theme import Theme
from app.config.i18n import t, is_rtl
from app.config.settings import TeacherProfile, LicenseConfig, AppConfig
from app.utils.icon_manager import IconManager
from app.ui.components.cards import Badge

class Sidebar(ctk.CTkFrame):
    def __init__(
        self,
        master,
        current_route: str = "dashboard",
        on_navigate: Callable[[str], None] = None,
        **kwargs
    ):
        super().__init__(
            master,
            width=Theme.SIDEBAR_WIDTH,
            corner_radius=0,
            fg_color=Theme.BG_SIDEBAR,
            border_color=Theme.BORDER,
            border_width=1,
            **kwargs
        )
        self.current_route = current_route
        self.on_navigate = on_navigate
        self.nav_buttons: Dict[str, ctk.CTkButton] = {}

        self.grid_propagate(False)
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._build_header()
        self._build_nav_items()
        self._build_footer()

    def _build_header(self):
        # Logo & App Title Frame
        header_frame = ctk.CTkFrame(self, fg_color="transparent", height=80)
        header_frame.grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 8))
        header_frame.grid_columnconfigure(1, weight=1)

        text_align = "e" if is_rtl() else "w"
        text_sticky = "e" if is_rtl() else "w"
        logo_col = 0 if is_rtl() else 0
        title_col = 1 if is_rtl() else 1
        logo_padx = (10, 0) if is_rtl() else (0, 10)
        logo_sticky = "e" if is_rtl() else "w"

        logo_img = IconManager.create_logo_image(size=38, bg_color=Theme.PRIMARY[0])
        logo_lbl = ctk.CTkLabel(header_frame, text="", image=logo_img)

        # RTL: Logo on the right side
        if is_rtl():
            header_frame.grid_columnconfigure(0, weight=1)
            logo_lbl.grid(row=0, column=1, rowspan=2, padx=logo_padx, sticky=logo_sticky)
        else:
            logo_lbl.grid(row=0, column=0, rowspan=2, padx=logo_padx, sticky=logo_sticky)

        title_lbl = ctk.CTkLabel(
            header_frame,
            text=AppConfig.APP_NAME,
            font=Theme.title_font(17),
            text_color=Theme.TEXT_PRIMARY,
            anchor=text_align
        )
        # RTL: Title on the left of logo
        if is_rtl():
            title_lbl.grid(row=0, column=0, sticky=text_sticky)
        else:
            title_lbl.grid(row=0, column=1, sticky=text_sticky)

        tag_lbl = ctk.CTkLabel(
            header_frame,
            text="PRO TEACHER SUITE",
            font=Theme.bold_font(9),
            text_color=Theme.PRIMARY[0],
            anchor=text_align
        )
        if is_rtl():
            tag_lbl.grid(row=1, column=0, sticky=text_sticky)
        else:
            tag_lbl.grid(row=1, column=1, sticky=text_sticky)

        # Divider
        divider = ctk.CTkFrame(self, height=1, fg_color=Theme.BORDER)
        divider.grid(row=1, column=0, sticky="ew", padx=16, pady=4)

    def _build_nav_items(self):
        self.nav_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", corner_radius=0)
        self.nav_frame.grid(row=2, column=0, sticky="nsew", padx=10, pady=8)
        self.nav_frame.grid_columnconfigure(0, weight=1)

        items = [
            ("dashboard", "nav_dashboard", "dashboard"),
            ("create_exam", "nav_create_exam", "create_exam"),
            ("question_bank", "nav_question_bank", "question_bank"),
            ("exams", "nav_exams", "exams"),
            ("templates", "nav_templates", "templates"),
            ("sources", "nav_sources", "sources"),
            ("settings", "nav_settings", "settings"),
        ]

        for route_key, label_key, icon_key in items:
            is_active = (route_key == self.current_route)
            btn = self._create_nav_button(route_key, t(label_key), icon_key, is_active)
            btn.pack(fill="x", pady=2)
            self.nav_buttons[route_key] = btn

    def _create_nav_button(self, route_key: str, label: str, icon_key: str, is_active: bool) -> ctk.CTkButton:
        icon_sym = IconManager.get_symbol_icon(icon_key)
        # RTL: Label first, then icon (reversed order)
        if is_rtl():
            btn_text = f"{label}   {icon_sym}  "
        else:
            btn_text = f"  {icon_sym}   {label}"

        nav_anchor = "e" if is_rtl() else "w"

        btn = ctk.CTkButton(
            self.nav_frame,
            text=btn_text,
            height=42,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.PRIMARY[0] if is_active else "transparent",
            hover_color=Theme.PRIMARY_HOVER[0] if is_active else Theme.BG_HOVER,
            text_color="#FFFFFF" if is_active else Theme.TEXT_PRIMARY,
            font=Theme.bold_font(13) if is_active else Theme.body_font(13),
            anchor=nav_anchor,
            command=lambda r=route_key: self._on_btn_click(r)
        )
        return btn

    def _on_btn_click(self, route_key: str):
        self.set_active_route(route_key)
        if self.on_navigate:
            self.on_navigate(route_key)

    def set_active_route(self, route_key: str):
        self.current_route = route_key
        for r_key, btn in self.nav_buttons.items():
            is_active = (r_key == route_key)
            btn.configure(
                fg_color=Theme.PRIMARY[0] if is_active else "transparent",
                hover_color=Theme.PRIMARY_HOVER[0] if is_active else Theme.BG_HOVER,
                text_color="#FFFFFF" if is_active else Theme.TEXT_PRIMARY,
                font=Theme.bold_font(13) if is_active else Theme.body_font(13)
            )

    def _build_footer(self):
        footer_frame = ctk.CTkFrame(self, fg_color="transparent")
        footer_frame.grid(row=3, column=0, sticky="ew", padx=12, pady=12)
        footer_frame.grid_columnconfigure(0, weight=1)

        text_align = "e" if is_rtl() else "w"
        text_sticky = "e" if is_rtl() else "w"

        # License Card
        lic_card = ctk.CTkFrame(
            footer_frame,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_CARD_ALT,
            border_color=Theme.BORDER,
            border_width=1
        )
        lic_card.pack(fill="x", pady=(0, 10))
        lic_card.grid_columnconfigure(1, weight=1)

        # Status badge
        badge = Badge(lic_card, text=f"● {LicenseConfig.STATUS_AR}", bg_color="#ECFDF5", text_color="#065F46", size="small")
        badge.grid(row=0, column=0, columnspan=2, padx=10, pady=(10, 4), sticky=text_sticky)

        # Teacher name
        name_lbl = ctk.CTkLabel(
            lic_card,
            text=TeacherProfile.NAME_AR,
            font=Theme.bold_font(12),
            text_color=Theme.TEXT_PRIMARY,
            anchor=text_align
        )
        name_lbl.grid(row=1, column=0, columnspan=2, padx=10, pady=0, sticky=text_sticky)

        # Valid until
        # valid_lbl = ctk.CTkLabel(
        #     lic_card,
        #     text=f"{t('license_valid_until')}: {LicenseConfig.EXPIRATION_DATE}",
        #     font=Theme.small_font(10),
        #     text_color=Theme.TEXT_MUTED,
        #     anchor=text_align
        # )
        # valid_lbl.grid(row=2, column=0, columnspan=2, padx=10, pady=(0, 10), sticky=text_sticky)

        # App Version & Lock notice
        v_lbl = ctk.CTkLabel(
            footer_frame,
            text=f"{AppConfig.APP_NAME} v{AppConfig.VERSION} • 🔒 معتمد",
            font=Theme.small_font(10),
            text_color=Theme.TEXT_MUTED
        )
        v_lbl.pack()
