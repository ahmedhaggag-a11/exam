# Modern Card Components
import customtkinter as ctk
from typing import Optional, Callable
from app.config.theme import Theme
from app.config.i18n import is_rtl

class Card(ctk.CTkFrame):
    def __init__(self, master, corner_radius: int = Theme.CORNER_RADIUS_MD, **kwargs):
        kwargs.setdefault("fg_color", Theme.BG_CARD)
        kwargs.setdefault("border_color", Theme.BORDER)
        kwargs.setdefault("border_width", 1)
        super().__init__(
            master,
            corner_radius=corner_radius,
            **kwargs
        )

class StatCard(ctk.CTkFrame):
    def __init__(
        self,
        master,
        title: str,
        value: str,
        icon_symbol: str = "📊",
        accent_color: str = "#2563EB",
        subtext: Optional[str] = None,
        on_click: Optional[Callable] = None,
        **kwargs
    ):
        kwargs.setdefault("fg_color", Theme.BG_CARD)
        kwargs.setdefault("border_color", Theme.BORDER)
        kwargs.setdefault("border_width", 1)
        super().__init__(
            master,
            corner_radius=Theme.CORNER_RADIUS_MD,
            **kwargs
        )
        self.on_click = on_click

        text_align = "e" if is_rtl() else "w"
        text_sticky = "e" if is_rtl() else "w"

        # Internal layout: RTL swaps columns
        # LTR: Icon col=0, Text col=1
        # RTL: Text col=0, Icon col=1
        if is_rtl():
            self.grid_columnconfigure(0, weight=1)
            icon_col = 1
            text_col = 0
            icon_padx = (12, 16)
            text_padx = (16, 0)
        else:
            self.grid_columnconfigure(1, weight=1)
            icon_col = 0
            text_col = 1
            icon_padx = (16, 12)
            text_padx = (0, 16)
        self.grid_rowconfigure(0, weight=1)

        # Icon box
        self.icon_frame = ctk.CTkFrame(
            self,
            width=48,
            height=48,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=accent_color
        )
        self.icon_frame.grid(row=0, column=icon_col, rowspan=2, padx=icon_padx, pady=16, sticky="nsew")
        self.icon_frame.grid_propagate(False)

        self.icon_label = ctk.CTkLabel(
            self.icon_frame,
            text=icon_symbol,
            font=("Segoe UI", 20),
            text_color="#FFFFFF"
        )
        self.icon_label.place(relx=0.5, rely=0.5, anchor="center")

        # Value label
        self.value_label = ctk.CTkLabel(
            self,
            text=value,
            font=Theme.title_font(22),
            text_color=Theme.TEXT_PRIMARY,
            anchor=text_align
        )
        self.value_label.grid(row=0, column=text_col, padx=text_padx, pady=(14, 0), sticky=text_sticky)

        # Title label
        title_text = title if not subtext else f"{title} • {subtext}"
        self.title_label = ctk.CTkLabel(
            self,
            text=title_text,
            font=Theme.small_font(11),
            text_color=Theme.TEXT_SECONDARY,
            anchor=text_align
        )
        self.title_label.grid(row=1, column=text_col, padx=text_padx, pady=(0, 14), sticky=text_sticky)

        if on_click:
            self.bind("<Button-1>", lambda e: on_click())
            self.value_label.bind("<Button-1>", lambda e: on_click())
            self.title_label.bind("<Button-1>", lambda e: on_click())
            self.configure(cursor="hand2")

    def update_value(self, new_value: str):
        self.value_label.configure(text=new_value)

class Badge(ctk.CTkFrame):
    def __init__(
        self,
        master,
        text: str,
        bg_color: str = "#EFF6FF",
        text_color: str = "#1E40AF",
        size: str = "normal",
        **kwargs
    ):
        font = Theme.small_font(10) if size == "small" else Theme.bold_font(11)
        padx = 8 if size == "small" else 12
        pady = 2 if size == "small" else 4
        super().__init__(
            master,
            corner_radius=Theme.CORNER_RADIUS_PILL,
            fg_color=bg_color,
            **kwargs
        )
        self.label = ctk.CTkLabel(
            self,
            text=text,
            font=font,
            text_color=text_color
        )
        self.label.pack(padx=padx, pady=pady)
