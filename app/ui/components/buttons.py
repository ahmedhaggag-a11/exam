# Reusable Button System
import customtkinter as ctk
from app.config.theme import Theme

class PrimaryButton(ctk.CTkButton):
    def __init__(self, master, text: str, command=None, width: int = 140, height: int = 38, **kwargs):
        super().__init__(
            master,
            text=text,
            command=command,
            width=width,
            height=height,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.PRIMARY,
            hover_color=Theme.PRIMARY_HOVER,
            text_color="#FFFFFF",
            font=Theme.bold_font(13),
            **kwargs
        )

class SecondaryButton(ctk.CTkButton):
    def __init__(self, master, text: str, command=None, width: int = 130, height: int = 38, **kwargs):
        super().__init__(
            master,
            text=text,
            command=command,
            width=width,
            height=height,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.SECONDARY,
            hover_color=Theme.SECONDARY_HOVER,
            text_color="#FFFFFF",
            font=Theme.bold_font(13),
            **kwargs
        )

class DangerButton(ctk.CTkButton):
    def __init__(self, master, text: str, command=None, width: int = 120, height: int = 38, **kwargs):
        super().__init__(
            master,
            text=text,
            command=command,
            width=width,
            height=height,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.DANGER,
            hover_color=Theme.DANGER_HOVER,
            text_color="#FFFFFF",
            font=Theme.bold_font(13),
            **kwargs
        )

class OutlineButton(ctk.CTkButton):
    def __init__(self, master, text: str, command=None, width: int = 120, height: int = 38, **kwargs):
        super().__init__(
            master,
            text=text,
            command=command,
            width=width,
            height=height,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color="transparent",
            border_color=Theme.BORDER,
            border_width=1,
            hover_color=Theme.BG_HOVER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(13),
            **kwargs
        )

class GhostButton(ctk.CTkButton):
    def __init__(self, master, text: str, command=None, width: int = 90, height: int = 34, **kwargs):
        super().__init__(
            master,
            text=text,
            command=command,
            width=width,
            height=height,
            corner_radius=Theme.CORNER_RADIUS_SM,
            fg_color="transparent",
            hover_color=Theme.BG_HOVER,
            text_color=Theme.TEXT_SECONDARY,
            font=Theme.body_font(12),
            **kwargs
        )
