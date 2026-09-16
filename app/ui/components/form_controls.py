# Reusable Form Controls
import customtkinter as ctk
from typing import Optional, List, Callable, Any
from app.config.theme import Theme
from app.utils.rtl_helper import get_align

class FormEntry(ctk.CTkFrame):
    def __init__(
        self,
        master,
        label: str,
        placeholder: str = "",
        initial_value: str = "",
        required: bool = False,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.grid_columnconfigure(0, weight=1)

        req_text = " *" if required else ""
        self.label_widget = ctk.CTkLabel(
            self,
            text=f"{label}{req_text}",
            font=Theme.bold_font(12),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        self.label_widget.grid(row=0, column=0, sticky="w", pady=(0, 4))

        self.entry = ctk.CTkEntry(
            self,
            placeholder_text=placeholder,
            height=38,
            corner_radius=Theme.CORNER_RADIUS_MD,
            border_color=Theme.BORDER,
            border_width=1,
            fg_color=Theme.BG_INPUT,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(13)
        )
        self.entry.grid(row=1, column=0, sticky="ew")
        
        if initial_value:
            self.entry.insert(0, initial_value)

    def get(self) -> str:
        return self.entry.get().strip()

    def set(self, value: str):
        self.entry.delete(0, "end")
        self.entry.insert(0, str(value))

class FormDropdown(ctk.CTkFrame):
    def __init__(
        self,
        master,
        label: str,
        values: List[str],
        default_value: Optional[str] = None,
        command: Optional[Callable[[str], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.grid_columnconfigure(0, weight=1)

        self.label_widget = ctk.CTkLabel(
            self,
            text=label,
            font=Theme.bold_font(12),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        self.label_widget.grid(row=0, column=0, sticky="w", pady=(0, 4))

        self.option_menu = ctk.CTkOptionMenu(
            self,
            values=values if values else ["---"],
            command=command,
            height=38,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_INPUT,
            button_color=Theme.BORDER,
            button_hover_color=Theme.PRIMARY,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(13),
            dropdown_font=Theme.body_font(13)
        )
        self.option_menu.grid(row=1, column=0, sticky="ew")

        if default_value and default_value in values:
            self.option_menu.set(default_value)
        elif values:
            self.option_menu.set(values[0])

    def get(self) -> str:
        return self.option_menu.get()

    def set(self, value: str):
        self.option_menu.set(value)

    def configure_values(self, values: List[str]):
        self.option_menu.configure(values=values)
        if values:
            self.option_menu.set(values[0])

class FormSpinBox(ctk.CTkFrame):
    def __init__(
        self,
        master,
        label: str,
        initial_value: int = 10,
        min_value: int = 0,
        max_value: int = 200,
        step: int = 1,
        on_change: Optional[Callable[[int], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.min_value = min_value
        self.max_value = max_value
        self.step = step
        self.current_value = initial_value
        self.on_change = on_change

        self.grid_columnconfigure(0, weight=1)

        self.label_widget = ctk.CTkLabel(
            self,
            text=label,
            font=Theme.bold_font(12),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        self.label_widget.grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 4))

        # Controls container
        self.controls_box = ctk.CTkFrame(
            self,
            height=38,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_INPUT,
            border_color=Theme.BORDER,
            border_width=1
        )
        self.controls_box.grid(row=1, column=0, columnspan=3, sticky="ew")
        self.controls_box.grid_columnconfigure(1, weight=1)

        self.btn_minus = ctk.CTkButton(
            self.controls_box,
            text="−",
            width=36,
            height=34,
            corner_radius=Theme.CORNER_RADIUS_SM,
            fg_color="transparent",
            hover_color=Theme.BG_HOVER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.bold_font(16),
            command=self._decrement
        )
        self.btn_minus.grid(row=0, column=0, padx=2, pady=2)

        self.val_label = ctk.CTkLabel(
            self.controls_box,
            text=str(self.current_value),
            font=Theme.bold_font(14),
            text_color=Theme.TEXT_PRIMARY
        )
        self.val_label.grid(row=0, column=1, sticky="ew")

        self.btn_plus = ctk.CTkButton(
            self.controls_box,
            text="+",
            width=36,
            height=34,
            corner_radius=Theme.CORNER_RADIUS_SM,
            fg_color="transparent",
            hover_color=Theme.BG_HOVER,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.bold_font(16),
            command=self._increment
        )
        self.btn_plus.grid(row=0, column=2, padx=2, pady=2)

    def _increment(self):
        if self.current_value + self.step <= self.max_value:
            self.current_value += self.step
            self.val_label.configure(text=str(self.current_value))
            if self.on_change:
                self.on_change(self.current_value)

    def _decrement(self):
        if self.current_value - self.step >= self.min_value:
            self.current_value -= self.step
            self.val_label.configure(text=str(self.current_value))
            if self.on_change:
                self.on_change(self.current_value)

    def get(self) -> int:
        return self.current_value

    def set(self, val: int):
        self.current_value = max(self.min_value, min(self.max_value, val))
        self.val_label.configure(text=str(self.current_value))
        if self.on_change:
            self.on_change(self.current_value)

class FormTextArea(ctk.CTkFrame):
    def __init__(
        self,
        master,
        label: str,
        initial_value: str = "",
        height: int = 100,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.grid_columnconfigure(0, weight=1)

        self.label_widget = ctk.CTkLabel(
            self,
            text=label,
            font=Theme.bold_font(12),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        )
        self.label_widget.grid(row=0, column=0, sticky="w", pady=(0, 4))

        self.textbox = ctk.CTkTextbox(
            self,
            height=height,
            corner_radius=Theme.CORNER_RADIUS_MD,
            border_color=Theme.BORDER,
            border_width=1,
            fg_color=Theme.BG_INPUT,
            text_color=Theme.TEXT_PRIMARY,
            font=Theme.body_font(13)
        )
        self.textbox.grid(row=1, column=0, sticky="ew")

        if initial_value:
            self.textbox.insert("1.0", initial_value)

    def get(self) -> str:
        return self.textbox.get("1.0", "end-1c").strip()

    def set(self, value: str):
        self.textbox.delete("1.0", "end")
        self.textbox.insert("1.0", value)
