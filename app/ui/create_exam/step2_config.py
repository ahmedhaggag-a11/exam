# Step 2: Question Configuration & Live Balance Matrix
import customtkinter as ctk
from typing import Dict, Any, List
from app.config.theme import Theme
from app.config.i18n import t
from app.services import QuestionService
from app.ui.components import Card, FormSpinBox, Badge

class Step2QuestionConfig(ctk.CTkFrame):
    def __init__(self, master, wizard_state: Dict[str, Any], **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.wizard_state = wizard_state
        self.chapters_list = QuestionService.get_distinct_chapters()
        self.chapter_checkboxes = {}

        self.grid_columnconfigure(0, weight=3)
        self.grid_columnconfigure(1, weight=2)

        self._build_ui()

    def _build_ui(self):
        # Left Side: Inputs & Chapter Selection
        left_box = ctk.CTkFrame(self, fg_color="transparent")
        left_box.grid(row=0, column=0, padx=(20, 10), pady=10, sticky="nsew")

        # 1. Question Types Section
        types_card = Card(left_box)
        types_card.pack(fill="x", pady=(0, 10))
        types_card.grid_columnconfigure((0, 1, 2), weight=1)

        ctk.CTkLabel(
            types_card,
            text=f"🔢 {t('section_question_types')}",
            font=Theme.title_font(14),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).grid(row=0, column=0, columnspan=3, padx=16, pady=(12, 8), sticky="w")

        # MCQ SpinBox
        self.mcq_spin = FormSpinBox(
            types_card,
            label=t("type_mcq"),
            initial_value=self.wizard_state.get("mcq_count", 15),
            min_value=0,
            max_value=100,
            on_change=lambda val: self._update_summary()
        )
        self.mcq_spin.grid(row=1, column=0, padx=12, pady=(0, 14), sticky="ew")

        # Essay SpinBox
        self.essay_spin = FormSpinBox(
            types_card,
            label=t("type_essay"),
            initial_value=self.wizard_state.get("essay_count", 3),
            min_value=0,
            max_value=50,
            on_change=lambda val: self._update_summary()
        )
        self.essay_spin.grid(row=1, column=1, padx=6, pady=(0, 14), sticky="ew")

        # True/False SpinBox
        self.tf_spin = FormSpinBox(
            types_card,
            label=t("type_true_false"),
            initial_value=self.wizard_state.get("tf_count", 2),
            min_value=0,
            max_value=50,
            on_change=lambda val: self._update_summary()
        )
        self.tf_spin.grid(row=1, column=2, padx=12, pady=(0, 14), sticky="ew")

        # 2. Difficulty Section
        diff_card = Card(left_box)
        diff_card.pack(fill="x", pady=(0, 10))
        diff_card.grid_columnconfigure((0, 1, 2), weight=1)

        ctk.CTkLabel(
            diff_card,
            text=f"⚖️ {t('section_difficulty')}",
            font=Theme.title_font(14),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).grid(row=0, column=0, columnspan=3, padx=16, pady=(12, 8), sticky="w")

        self.easy_spin = FormSpinBox(
            diff_card,
            label="سهل (Easy)",
            initial_value=self.wizard_state.get("easy_count", 6),
            min_value=0,
            max_value=100,
            on_change=lambda val: self._update_summary()
        )
        self.easy_spin.grid(row=1, column=0, padx=12, pady=(0, 14), sticky="ew")

        self.medium_spin = FormSpinBox(
            diff_card,
            label="متوسط (Medium)",
            initial_value=self.wizard_state.get("medium_count", 10),
            min_value=0,
            max_value=100,
            on_change=lambda val: self._update_summary()
        )
        self.medium_spin.grid(row=1, column=1, padx=6, pady=(0, 14), sticky="ew")

        self.hard_spin = FormSpinBox(
            diff_card,
            label="صعب (Hard)",
            initial_value=self.wizard_state.get("hard_count", 4),
            min_value=0,
            max_value=100,
            on_change=lambda val: self._update_summary()
        )
        self.hard_spin.grid(row=1, column=2, padx=12, pady=(0, 14), sticky="ew")

        # 3. Chapters Selection Card
        chap_card = Card(left_box)
        chap_card.pack(fill="both", expand=True)

        ctk.CTkLabel(
            chap_card,
            text=f"📖 {t('section_chapters')}",
            font=Theme.title_font(14),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(fill="x", padx=16, pady=(12, 6))

        selected_ch = self.wizard_state.get("selected_chapters", self.chapters_list)
        for ch in self.chapters_list:
            var = ctk.BooleanVar(value=(ch in selected_ch))
            cb = ctk.CTkCheckBox(
                chap_card,
                text=ch,
                variable=var,
                font=Theme.body_font(12),
                fg_color=Theme.PRIMARY[0],
                hover_color=Theme.PRIMARY_HOVER[0],
                command=self._update_summary
            )
            cb.pack(fill="x", padx=20, pady=4)
            self.chapter_checkboxes[ch] = var

        # Right Side: Live Summary Card
        right_box = Card(self)
        right_box.grid(row=0, column=1, padx=(10, 20), pady=10, sticky="nsew")

        s_inner = ctk.CTkFrame(right_box, fg_color="transparent")
        s_inner.pack(fill="both", expand=True, padx=16, pady=16)

        ctk.CTkLabel(
            s_inner,
            text=f"📋 {t('card_live_summary')}",
            font=Theme.title_font(15),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(fill="x", pady=(0, 12))

        # Total Questions Display Box
        t_box = ctk.CTkFrame(s_inner, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_MD)
        t_box.pack(fill="x", pady=(0, 12))
        
        ctk.CTkLabel(t_box, text=t("summary_total_questions"), font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY).pack(pady=(10, 0))
        self.total_q_lbl = ctk.CTkLabel(t_box, text="20 سؤال", font=Theme.title_font(24), text_color=Theme.PRIMARY[0])
        self.total_q_lbl.pack(pady=(0, 10))

        # Types summary
        ctk.CTkLabel(s_inner, text="توزيع الأنواع:", font=Theme.bold_font(12), text_color=Theme.TEXT_PRIMARY, anchor="w").pack(fill="x", pady=(4, 2))
        self.types_summary_lbl = ctk.CTkLabel(s_inner, text="MCQ: 15  •  مقالي: 3  •  صح/خطأ: 2", font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY, anchor="w")
        self.types_summary_lbl.pack(fill="x", pady=(0, 10))

        # Difficulty summary
        ctk.CTkLabel(s_inner, text="توزيع الصعوبة:", font=Theme.bold_font(12), text_color=Theme.TEXT_PRIMARY, anchor="w").pack(fill="x", pady=(4, 2))
        self.diff_summary_lbl = ctk.CTkLabel(s_inner, text="سهل: 6  •  متوسط: 10  •  صعب: 4", font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY, anchor="w")
        self.diff_summary_lbl.pack(fill="x", pady=(0, 10))

        # Selected chapters count
        ctk.CTkLabel(s_inner, text="الفصول المحددة:", font=Theme.bold_font(12), text_color=Theme.TEXT_PRIMARY, anchor="w").pack(fill="x", pady=(4, 2))
        self.chap_summary_lbl = ctk.CTkLabel(s_inner, text=f"{len(self.chapters_list)} فصول مختارة", font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY, anchor="w")
        self.chap_summary_lbl.pack(fill="x", pady=(0, 14))

        # Status badge
        self.status_badge = Badge(s_inner, text="✓ المواصفات متوازنة وجاهزة", bg_color="#ECFDF5", text_color="#065F46")
        self.status_badge.pack(fill="x", pady=6)

        self._update_summary()

    def _update_summary(self):
        mcq = self.mcq_spin.get()
        essay = self.essay_spin.get()
        tf = self.tf_spin.get()
        total_type = mcq + essay + tf

        easy = self.easy_spin.get()
        med = self.medium_spin.get()
        hard = self.hard_spin.get()
        total_diff = easy + med + hard

        sel_chaps = [ch for ch, var in self.chapter_checkboxes.items() if var.get()]

        self.total_q_lbl.configure(text=f"{total_type} سؤال")
        self.types_summary_lbl.configure(text=f"MCQ: {mcq}  •  مقالي: {essay}  •  صح/خطأ: {tf}")
        self.diff_summary_lbl.configure(text=f"سهل: {easy}  •  متوسط: {med}  •  صعب: {hard}")
        self.chap_summary_lbl.configure(text=f"{len(sel_chaps)} فصول مختارة")

        if total_type != total_diff:
            self.status_badge.label.configure(text="⚠️ تنبيه: مجموع الصعوبة لا يساوي مجموع الأسئلة!")
            self.status_badge.configure(fg_color="#FEF2F2")
            self.status_badge.label.configure(text_color="#991B1B")
        elif len(sel_chaps) == 0:
            self.status_badge.label.configure(text="⚠️ تنبيه: يرجى اختيار فصل دراسي واحد على الأقل!")
            self.status_badge.configure(fg_color="#FFFBEB")
            self.status_badge.label.configure(text_color="#92400E")
        else:
            self.status_badge.label.configure(text="✓ المواصفات متوازنة وجاهزة للتوليد")
            self.status_badge.configure(fg_color="#ECFDF5")
            self.status_badge.label.configure(text_color="#065F46")

    def save_state(self):
        self.wizard_state["mcq_count"] = self.mcq_spin.get()
        self.wizard_state["essay_count"] = self.essay_spin.get()
        self.wizard_state["tf_count"] = self.tf_spin.get()
        self.wizard_state["total_questions"] = self.mcq_spin.get() + self.essay_spin.get() + self.tf_spin.get()
        self.wizard_state["easy_count"] = self.easy_spin.get()
        self.wizard_state["medium_count"] = self.medium_spin.get()
        self.wizard_state["hard_count"] = self.hard_spin.get()
        self.wizard_state["selected_chapters"] = [ch for ch, var in self.chapter_checkboxes.items() if var.get()]

    def validate(self) -> bool:
        total_type = self.mcq_spin.get() + self.essay_spin.get() + self.tf_spin.get()
        total_diff = self.easy_spin.get() + self.medium_spin.get() + self.hard_spin.get()
        sel_chaps = [ch for ch, var in self.chapter_checkboxes.items() if var.get()]
        return total_type > 0 and total_type == total_diff and len(sel_chaps) > 0
