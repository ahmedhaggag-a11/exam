# Responsive Data Table Component
import customtkinter as ctk
from typing import List, Dict, Any, Optional, Callable
from app.config.theme import Theme
from app.ui.components.cards import Badge
from app.ui.components.buttons import OutlineButton, DangerButton, GhostButton

class DataTable(ctk.CTkFrame):
    def __init__(
        self,
        master,
        columns: List[Dict[str, Any]],  # [{"key": "name", "title": "...", "width": 200, "type": "text/badge/actions"}]
        row_actions: Optional[List[Dict[str, Any]]] = None, # [{"label": "Edit", "key": "edit", "style": "primary/danger"}]
        on_action: Optional[Callable[[str, Dict[str, Any]], None]] = None,
        on_cell_click: Optional[Callable[[Dict[str, Any], Dict[str, Any]], None]] = None,
        empty_message: str = "لا توجد بيانات متاحة حالياً",
        **kwargs
    ):
        super().__init__(
            master,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color=Theme.BG_CARD,
            border_color=Theme.BORDER,
            border_width=1,
            **kwargs
        )
        self.columns = columns
        self.row_actions = row_actions or []
        self.on_action = on_action
        self.on_cell_click = on_cell_click
        self.empty_message = empty_message
        self.rows_data = []

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # Header Frame
        self.header_frame = ctk.CTkFrame(
            self,
            height=44,
            corner_radius=0,
            fg_color=Theme.BG_CARD_ALT,
            border_width=0
        )
        self.header_frame.grid(row=0, column=0, sticky="ew")
        self.header_frame.grid_propagate(False)

        # Configure header columns
        for idx, col in enumerate(self.columns):
            self.header_frame.grid_columnconfigure(
                idx,
                weight=col.get("weight", 1)
            )
            lbl = ctk.CTkLabel(
                self.header_frame,
                text=col["title"],
                font=Theme.bold_font(12),
                text_color=Theme.TEXT_SECONDARY,
                anchor="w"
            )
            lbl.grid(row=0, column=idx, padx=12, pady=10, sticky="w")

        # Scrollable body
        self.body_frame = ctk.CTkScrollableFrame(
            self,
            fg_color="transparent",
            corner_radius=0
        )
        self.body_frame.grid(row=1, column=0, sticky="nsew")
        self.body_frame.grid_columnconfigure(0, weight=1)

    def set_data(self, data: List[Dict[str, Any]]):
        self.rows_data = data
        for widget in self.body_frame.winfo_children():
            widget.destroy()

        if not data:
            empty_box = ctk.CTkFrame(self.body_frame, fg_color="transparent")
            empty_box.pack(fill="both", expand=True, pady=40)
            lbl = ctk.CTkLabel(
                empty_box,
                text=f"📂 {self.empty_message}",
                font=Theme.body_font(14),
                text_color=Theme.TEXT_MUTED
            )
            lbl.pack()
            return

        for r_idx, row_item in enumerate(data):
            row_bg = Theme.BG_CARD if r_idx % 2 == 0 else Theme.BG_CARD_ALT
            row_frame = ctk.CTkFrame(
                self.body_frame,
                height=52,
                corner_radius=Theme.CORNER_RADIUS_SM,
                fg_color=row_bg
            )
            row_frame.pack(fill="x", padx=4, pady=3)

            for c_idx, col in enumerate(self.columns):
                row_frame.grid_columnconfigure(
                    c_idx,
                    weight=col.get("weight", 1)
                )
                val = row_item.get(col["key"], "")
                col_type = col.get("type", "text")

                if col_type == "badge":
                    # Status/Type Badge
                    badge_color = col.get("color_map", {}).get(val, ("#EFF6FF", "#1E40AF"))
                    badge = Badge(row_frame, text=str(val), bg_color=badge_color[0], text_color=badge_color[1], size="small")
                    badge.grid(row=0, column=c_idx, padx=12, pady=8, sticky="w")

                elif col_type == "actions":
                    actions_box = ctk.CTkFrame(row_frame, fg_color="transparent")
                    actions_box.grid(row=0, column=c_idx, padx=12, pady=6, sticky="e")

                    for act in self.row_actions:
                        btn_text = act.get("label", "")
                        action_key = act.get("key", "")
                        style = act.get("style", "outline")

                        if style == "danger":
                            btn = DangerButton(
                                actions_box,
                                text=btn_text,
                                width=act.get("width", 60),
                                height=28,
                                command=lambda ak=action_key, ri=row_item: self._trigger_action(ak, ri)
                            )
                        elif style == "ghost":
                            btn = GhostButton(
                                actions_box,
                                text=btn_text,
                                width=act.get("width", 60),
                                height=28,
                                command=lambda ak=action_key, ri=row_item: self._trigger_action(ak, ri)
                            )
                        else:
                            btn = OutlineButton(
                                actions_box,
                                text=btn_text,
                                width=act.get("width", 60),
                                height=28,
                                command=lambda ak=action_key, ri=row_item: self._trigger_action(ak, ri)
                            )
                        btn.pack(side="right" if col.get("align") == "right" else "left", padx=3)

                else:
                    # Plain text
                    text_str = str(val)
                    max_len = col.get("max_len")
                    if max_len and len(text_str) > max_len:
                        text_str = text_str[:max_len] + "..."
                    
                    lbl = ctk.CTkLabel(
                        row_frame,
                        text=text_str,
                        font=Theme.body_font(12),
                        text_color=Theme.TEXT_PRIMARY,
                        anchor="w",
                        justify="left",
                        wraplength=col.get("wraplength", 260)
                    )
                    lbl.grid(row=0, column=c_idx, padx=12, pady=12, sticky="w")
                    if col.get("clickable") and self.on_cell_click:
                        lbl.configure(cursor="hand2", text_color=Theme.PRIMARY[0])
                        lbl.bind(
                            "<Button-1>",
                            lambda event, current_col=col, current_row=row_item: self.on_cell_click(current_col, current_row)
                        )

    def _trigger_action(self, action_key: str, row_item: Dict[str, Any]):
        if self.on_action:
            self.on_action(action_key, row_item)
