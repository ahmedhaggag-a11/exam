# 6-Step Exam Wizard Stepper
import customtkinter as ctk
from typing import List, Callable, Optional
from app.config.theme import Theme
from app.config.i18n import t

class WizardStepper(ctk.CTkFrame):
    def __init__(
        self,
        master,
        steps: List[str],
        current_step: int = 1,
        on_step_click: Optional[Callable[[int], None]] = None,
        **kwargs
    ):
        super().__init__(
            master,
            height=70,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_CARD,
            border_color=Theme.BORDER,
            border_width=1,
            **kwargs
        )
        self.steps = steps
        self.current_step = current_step
        self.on_step_click = on_step_click
        self.step_widgets = []

        self.grid_rowconfigure(0, weight=1)
        self._render_stepper()

    def _render_stepper(self):
        for w in self.winfo_children():
            w.destroy()
        self.step_widgets.clear()

        total = len(self.steps)
        for i in range(total):
            self.grid_columnconfigure(i, weight=1)

            step_num = i + 1
            is_active = (step_num == self.current_step)
            is_completed = (step_num < self.current_step)

            # Node container
            node_frame = ctk.CTkFrame(self, fg_color="transparent")
            node_frame.grid(row=0, column=i, padx=4, pady=8, sticky="ew")
            node_frame.grid_columnconfigure(0, weight=1)

            # Inner content
            content_box = ctk.CTkFrame(node_frame, fg_color="transparent")
            content_box.pack(anchor="center")

            # Circle indicator
            if is_completed:
                circle_color = Theme.SUCCESS[0]
                text_color = "#FFFFFF"
                circle_text = "✓"
            elif is_active:
                circle_color = Theme.PRIMARY[0]
                text_color = "#FFFFFF"
                circle_text = str(step_num)
            else:
                circle_color = Theme.BORDER[0]
                text_color = Theme.TEXT_MUTED[0]
                circle_text = str(step_num)

            circle = ctk.CTkLabel(
                content_box,
                text=circle_text,
                width=28,
                height=28,
                corner_radius=14,
                fg_color=circle_color,
                text_color=text_color,
                font=Theme.bold_font(12)
            )
            circle.pack(side="left", padx=(0, 8))

            # Step title
            title_color = Theme.PRIMARY[0] if is_active else (Theme.TEXT_PRIMARY[0] if is_completed else Theme.TEXT_MUTED[0])
            title_lbl = ctk.CTkLabel(
                content_box,
                text=self.steps[i],
                font=Theme.bold_font(12) if is_active else Theme.body_font(11),
                text_color=title_color
            )
            title_lbl.pack(side="left")

            if self.on_step_click and is_completed:
                node_frame.bind("<Button-1>", lambda e, s=step_num: self.on_step_click(s))
                title_lbl.bind("<Button-1>", lambda e, s=step_num: self.on_step_click(s))
                node_frame.configure(cursor="hand2")

    def set_step(self, step: int):
        self.current_step = step
        self._render_stepper()
