# Modern Application Header Bar
import customtkinter as ctk
from typing import Callable, Optional
from app.config.theme import Theme
from app.config.i18n import t, is_rtl, get_language, set_language
from app.config.settings import TeacherProfile
from app.utils.icon_manager import IconManager
from app.ui.components.buttons import OutlineButton, GhostButton

class Header(ctk.CTkFrame):
    def __init__(
        self,
        master,
        title: str = "لوحة التحكم",
        subtitle: str = "نظرة عامة على الاختبارات وبنك الأسئلة",
        on_search: Optional[Callable[[str], None]] = None,
        on_theme_toggle: Optional[Callable[[], None]] = None,
        on_lang_toggle: Optional[Callable[[], None]] = None,
        on_notify_click: Optional[Callable[[], None]] = None,
        **kwargs
    ):
        super().__init__(
            master,
            height=Theme.HEADER_HEIGHT,
            corner_radius=0,
            fg_color=Theme.BG_HEADER,
            border_color=Theme.BORDER,
            border_width=1,
            **kwargs
        )
        self.on_search = on_search
        self.on_theme_toggle = on_theme_toggle
        self.on_lang_toggle = on_lang_toggle
        self.on_notify_click = on_notify_click

        self.grid_propagate(False)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # Title & Subtitle container
        self.title_box = ctk.CTkFrame(self, fg_color="transparent")
        self.title_box.grid(row=0, column=0, padx=24, pady=12, sticky="w")

        self.title_lbl = ctk.CTkLabel(
            self.title_box,
            text=title,
            font=Theme.title_font(18),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        self.title_lbl.pack(anchor="w")

        self.subtitle_lbl = ctk.CTkLabel(
            self.title_box,
            text=subtitle,
            font=Theme.small_font(11),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w"
        )
        self.subtitle_lbl.pack(anchor="w")

        # Right Controls Box (Search, Toggles, Profile Avatar)
        self.controls_box = ctk.CTkFrame(self, fg_color="transparent")
        self.controls_box.grid(row=0, column=2, padx=20, pady=12, sticky="e")

        # Search Bar
        self.search_entry = ctk.CTkEntry(
            self.controls_box,
            placeholder_text=t("search_placeholder"),
            width=260,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            border_color=Theme.BORDER,
            fg_color=Theme.BG_INPUT,
            font=Theme.body_font(12)
        )
        self.search_entry.pack(side="left", padx=8)
        self.search_entry.bind("<KeyRelease>", self._on_search_input)

        # Notifications Button
        self.notify_btn = ctk.CTkButton(
            self.controls_box,
            text="🔔",
            width=36,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_CARD_ALT,
            hover_color=Theme.BG_HOVER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.bold_font(14),
            command=self._on_notify
        )
        self.notify_btn.pack(side="left", padx=4)

        # Theme Toggle Button
        self.theme_btn = ctk.CTkButton(
            self.controls_box,
            text="🌓",
            width=36,
            height=36,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_CARD_ALT,
            hover_color=Theme.BG_HOVER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.bold_font(14),
            command=self._on_theme
        )
        self.theme_btn.pack(side="left", padx=4)

        # Teacher Profile Badge
        self.profile_pill = ctk.CTkFrame(
            self.controls_box,
            height=38,
            corner_radius=Theme.CORNER_RADIUS_PILL,
            fg_color=Theme.BG_CARD_ALT,
            border_color=Theme.BORDER,
            border_width=1
        )
        self.profile_pill.pack(side="left", padx=(8, 0))

        # Avatar circle
        avatar_lbl = ctk.CTkLabel(
            self.profile_pill,
            text=TeacherProfile.AVATAR_INITIALS,
            width=28,
            height=28,
            corner_radius=14,
            fg_color=Theme.PRIMARY[0],
            text_color="#FFFFFF",
            font=Theme.bold_font(11)
        )
        avatar_lbl.pack(side="left", padx=(4, 6), pady=4)

        teacher_name = ctk.CTkLabel(
            self.profile_pill,
            text=TeacherProfile.NAME_AR,
            font=Theme.bold_font(12),
            text_color=Theme.TEXT_PRIMARY
        )
        teacher_name.pack(side="left", padx=(0, 12), pady=4)

    def set_titles(self, title: str, subtitle: str = ""):
        self.title_lbl.configure(text=title)
        self.subtitle_lbl.configure(text=subtitle)

    def _on_search_input(self, event=None):
        if self.on_search:
            self.on_search(self.search_entry.get().strip())

    def _on_theme(self):
        if self.on_theme_toggle:
            self.on_theme_toggle()

    def _on_notify(self):
        if self.on_notify_click:
            self.on_notify_click()
