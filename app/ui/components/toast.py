# Non-blocking Floating Toast Notification System
import customtkinter as ctk
from typing import Optional
from app.config.theme import Theme

class ToastNotification:
    _active_toast = None

    @classmethod
    def show(
        cls,
        master,
        message: str,
        toast_type: str = "success",  # "success", "error", "warning", "info"
        duration_ms: int = 3500
    ):
        if cls._active_toast:
            try:
                cls._active_toast.destroy()
            except Exception:
                pass

        color_map = {
            "success": (Theme.SUCCESS[0], "#FFFFFF", "✓"),
            "error": (Theme.DANGER[0], "#FFFFFF", "✕"),
            "warning": (Theme.WARNING[0], "#FFFFFF", "⚠"),
            "info": (Theme.INFO[0], "#FFFFFF", "ℹ")
        }
        bg_col, text_col, icon = color_map.get(toast_type, color_map["info"])

        toast = ctk.CTkFrame(
            master,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=bg_col,
            border_width=0
        )
        toast.place(relx=0.5, rely=0.08, anchor="center")

        content_box = ctk.CTkFrame(toast, fg_color="transparent")
        content_box.pack(padx=20, pady=10)

        icon_lbl = ctk.CTkLabel(
            content_box,
            text=icon,
            font=Theme.bold_font(14),
            text_color=text_col
        )
        icon_lbl.pack(side="left", padx=(0, 10))

        msg_lbl = ctk.CTkLabel(
            content_box,
            text=message,
            font=Theme.bold_font(13),
            text_color=text_col
        )
        msg_lbl.pack(side="left")

        cls._active_toast = toast
        master.after(duration_ms, lambda: cls._dismiss(toast))

    @classmethod
    def _dismiss(cls, toast):
        if cls._active_toast == toast:
            try:
                toast.destroy()
                cls._active_toast = None
            except Exception:
                pass
