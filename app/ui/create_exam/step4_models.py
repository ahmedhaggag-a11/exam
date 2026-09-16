# Step 4: Multi-Model Exam Generation & Anti-Cheat Shuffling
import customtkinter as ctk
from typing import Dict, Any, List
from app.config.theme import Theme
from app.config.i18n import t
from app.services import ExamService
from app.ui.components import Card, FormSpinBox, Badge

class Step4ModelsConfig(ctk.CTkFrame):
    def __init__(self, master, wizard_state: Dict[str, Any], **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.wizard_state = wizard_state
        self.grid_columnconfigure(0, weight=2)
        self.grid_columnconfigure(1, weight=3)

        self._build_ui()

    def _build_ui(self):
        # Left Side: Controls & Shuffling Options
        left_box = Card(self)
        left_box.grid(row=0, column=0, padx=(20, 10), pady=10, sticky="nsew")

        ctk.CTkLabel(
            left_box,
            text=f"🗂️ {t('step4_title')}",
            font=Theme.title_font(15),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(fill="x", padx=16, pady=(16, 4))

        ctk.CTkLabel(
            left_box,
            text=t("step4_subtitle"),
            font=Theme.body_font(11),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w",
            wraplength=340
        ).pack(fill="x", padx=16, pady=(0, 14))

        # Models Count Spinner
        self.models_spin = FormSpinBox(
            left_box,
            label=t("field_models_count"),
            initial_value=self.wizard_state.get("models_count", 4),
            min_value=1,
            max_value=4,
            on_change=lambda val: self._update_previews()
        )
        self.models_spin.pack(fill="x", padx=16, pady=(0, 14))

        # Shuffling Checkboxes
        ctk.CTkLabel(left_box, text="خيارات الخلط والعدالة الامتحانية:", font=Theme.bold_font(12), text_color=Theme.TEXT_PRIMARY, anchor="w").pack(fill="x", padx=16, pady=(4, 6))

        self.shuffle_q_var = ctk.BooleanVar(value=self.wizard_state.get("shuffle_questions", True))
        self.cb_shuffle_q = ctk.CTkCheckBox(
            left_box,
            text=t("opt_shuffle_questions"),
            variable=self.shuffle_q_var,
            font=Theme.body_font(12),
            fg_color=Theme.PRIMARY[0],
            command=self._update_previews
        )
        self.cb_shuffle_q.pack(fill="x", padx=16, pady=4)

        self.shuffle_c_var = ctk.BooleanVar(value=self.wizard_state.get("shuffle_choices", True))
        self.cb_shuffle_c = ctk.CTkCheckBox(
            left_box,
            text=t("opt_shuffle_choices"),
            variable=self.shuffle_c_var,
            font=Theme.body_font(12),
            fg_color=Theme.PRIMARY[0],
            command=self._update_previews
        )
        self.cb_shuffle_c.pack(fill="x", padx=16, pady=4)

        self.bal_diff_var = ctk.BooleanVar(value=self.wizard_state.get("balance_difficulty", True))
        self.cb_bal_diff = ctk.CTkCheckBox(
            left_box,
            text=t("opt_balance_difficulty"),
            variable=self.bal_diff_var,
            font=Theme.body_font(12),
            fg_color=Theme.PRIMARY[0]
        )
        self.cb_bal_diff.pack(fill="x", padx=16, pady=4)

        self.bal_chap_var = ctk.BooleanVar(value=self.wizard_state.get("balance_chapters", True))
        self.cb_bal_chap = ctk.CTkCheckBox(
            left_box,
            text=t("opt_balance_chapters"),
            variable=self.bal_chap_var,
            font=Theme.body_font(12),
            fg_color=Theme.PRIMARY[0]
        )
        self.cb_bal_chap.pack(fill="x", padx=16, pady=4)

        # Right Side: Live Models Preview Cards
        right_box = Card(self)
        right_box.grid(row=0, column=1, padx=(10, 20), pady=10, sticky="nsew")
        right_box.grid_columnconfigure(0, weight=1)
        right_box.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(
            right_box,
            text=f"👁️ {t('models_preview_title')}",
            font=Theme.title_font(15),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).grid(row=0, column=0, padx=16, pady=(16, 8), sticky="w")

        self.preview_scroll = ctk.CTkScrollableFrame(right_box, fg_color="transparent")
        self.preview_scroll.grid(row=1, column=0, padx=16, pady=(0, 16), sticky="nsew")
        self.preview_scroll.grid_columnconfigure(0, weight=1)

        self._update_previews()

    def _update_previews(self):
        for w in self.preview_scroll.winfo_children():
            w.destroy()

        q_ids = self.wizard_state.get("selected_question_ids", [])
        m_count = self.models_spin.get()
        shuffle_q = self.shuffle_q_var.get()

        previews = ExamService.preview_models(q_ids, models_count=m_count, shuffle_q=shuffle_q)
        colors = ["#2563EB", "#0D9488", "#7C3AED", "#D97706"]

        for idx, prev in enumerate(previews):
            m_card = ctk.CTkFrame(self.preview_scroll, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_SM)
            m_card.pack(fill="x", pady=6)
            m_card.grid_columnconfigure(1, weight=1)

            # Badge code
            c_badge = Badge(m_card, text=prev["model_name"], bg_color=colors[idx % 4], text_color="#FFFFFF")
            c_badge.grid(row=0, column=0, padx=12, pady=10, sticky="w")

            info_lbl = ctk.CTkLabel(
                m_card,
                text=f"إجمالي: {len(q_ids)} سؤال • خلط بترتيب مخصص",
                font=Theme.bold_font(11),
                text_color=Theme.TEXT_SECONDARY
            )
            info_lbl.grid(row=0, column=1, padx=8, pady=10, sticky="w")

            # Sequence snippets
            seq_box = ctk.CTkFrame(m_card, fg_color="transparent")
            seq_box.grid(row=1, column=0, columnspan=2, padx=12, pady=(0, 10), sticky="ew")

            for s_idx, sample_txt in enumerate(prev.get("sample_sequence", [])):
                lbl = ctk.CTkLabel(
                    seq_box,
                    text=f"  {s_idx + 1}. {sample_txt}",
                    font=Theme.small_font(10),
                    text_color=Theme.TEXT_PRIMARY,
                    anchor="w"
                )
                lbl.pack(fill="x", pady=1)

    def save_state(self):
        self.wizard_state["models_count"] = self.models_spin.get()
        self.wizard_state["shuffle_questions"] = self.shuffle_q_var.get()
        self.wizard_state["shuffle_choices"] = self.shuffle_c_var.get()
        self.wizard_state["balance_difficulty"] = self.bal_diff_var.get()
        self.wizard_state["balance_chapters"] = self.bal_chap_var.get()

    def validate(self) -> bool:
        return self.models_spin.get() >= 1
