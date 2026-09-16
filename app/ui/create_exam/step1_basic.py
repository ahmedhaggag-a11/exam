# Step 1: Basic Information
import customtkinter as ctk
from typing import Dict, Any
from app.config.theme import Theme
from app.config.i18n import t
from app.config.settings import TeacherProfile
from app.ui.components import FormEntry, FormDropdown, FormTextArea, Card

class Step1BasicInfo(ctk.CTkFrame):
    def __init__(self, master, wizard_state: Dict[str, Any], **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self.wizard_state = wizard_state
        self.grid_columnconfigure(0, weight=1)

        self._build_ui()

    def _build_ui(self):
        card = Card(self)
        card.pack(fill="both", expand=True, padx=20, pady=10)
        card.grid_columnconfigure(0, weight=1)

        # Title & Subtitle
        ctk.CTkLabel(card, text=t("step1_title"), font=Theme.title_font(16), text_color=Theme.TEXT_PRIMARY, anchor="w").pack(padx=20, pady=(16, 2), fill="x")
        ctk.CTkLabel(card, text=t("step1_subtitle"), font=Theme.body_font(12), text_color=Theme.TEXT_SECONDARY, anchor="w").pack(padx=20, pady=(0, 16), fill="x")

        # Row 1: Exam Name
        self.name_input = FormEntry(
            card,
            label=t("field_exam_name"),
            placeholder=t("field_exam_name_ph"),
            initial_value=self.wizard_state.get("name", "اختبار فيزياء شامل - الثانوية العامة"),
            required=True
        )
        self.name_input.pack(fill="x", padx=20, pady=(0, 12))

        # Row 2: Subject & Grade
        r2 = ctk.CTkFrame(card, fg_color="transparent")
        r2.pack(fill="x", padx=20, pady=(0, 12))
        r2.grid_columnconfigure((0, 1), weight=1)

        self.subject_input = FormDropdown(
            r2,
            label=t("field_subject"),
            values=["الفيزياء", "الفيزياء (لغات)", "الفيزياء المتقدمة"],
            default_value=self.wizard_state.get("subject", TeacherProfile.SUBJECT_AR)
        )
        self.subject_input.grid(row=0, column=0, padx=(0, 8), sticky="ew")

        self.grade_input = FormDropdown(
            r2,
            label=t("field_grade"),
            values=["الصف الثالث الثانوي (العام والأزهر)", "الصف الثاني الثانوي", "الصف الأول الثانوي"],
            default_value=self.wizard_state.get("grade", TeacherProfile.GRADE_AR)
        )
        self.grade_input.grid(row=0, column=1, padx=(8, 0), sticky="ew")

        # Row 3: Duration & Date
        r3 = ctk.CTkFrame(card, fg_color="transparent")
        r3.pack(fill="x", padx=20, pady=(0, 12))
        r3.grid_columnconfigure((0, 1), weight=1)

        self.duration_input = FormDropdown(
            r3,
            label=t("field_duration"),
            values=["45 دقيقة", "60 دقيقة", "90 دقيقة", "120 دقيقة", "180 دقيقة (3 ساعات)"],
            default_value=self.wizard_state.get("duration", "90 دقيقة")
        )
        self.duration_input.grid(row=0, column=0, padx=(0, 8), sticky="ew")

        self.date_input = FormEntry(
            r3,
            label=t("field_exam_date"),
            initial_value=self.wizard_state.get("exam_date", "2026-08-30")
        )
        self.date_input.grid(row=0, column=1, padx=(8, 0), sticky="ew")

        # Row 3.5: Exam Language (controls RTL/LTR direction of the paper)
        r35 = ctk.CTkFrame(card, fg_color="transparent")
        r35.pack(fill="x", padx=20, pady=(0, 12))
        r35.grid_columnconfigure((0, 1), weight=1)

        lang_default_key = self.wizard_state.get("language", "ar")
        if lang_default_key == "en":
            lang_default_value = t("lang_en")
        elif lang_default_key == "auto":
            lang_default_value = t("lang_auto")
        else:
            lang_default_value = t("lang_ar_auto")

        self.language_input = FormDropdown(
            r35,
            label=t("field_exam_language"),
            values=[t("lang_ar_auto"), t("lang_en"), t("lang_auto")],
            default_value=lang_default_value
        )
        self.language_input.grid(row=0, column=0, padx=(0, 8), sticky="ew")

        # Row 4: Student Instructions
        default_inst = "1. أجب عن جميع الأسئلة بدقة.\n2. ظلل دائرة واحدة فقط لكل سؤال في ورقة الإجابة (بابل شيت).\n3. يسمح باستخدام الآلة الحاسبة غير المبرمجة."
        self.instructions_input = FormTextArea(
            card,
            label=t("field_instructions"),
            initial_value=self.wizard_state.get("instructions", default_inst),
            height=85
        )
        self.instructions_input.pack(fill="x", padx=20, pady=(0, 12))

        # Row 5: Per-exam notification settings
        self.notify_on_create_var = ctk.BooleanVar(value=self.wizard_state.get("notify_on_create", True))
        ctk.CTkCheckBox(
            card,
            text="إظهار تنبيه بعد إنشاء هذا الاختبار",
            variable=self.notify_on_create_var,
            font=Theme.body_font(12),
            fg_color=Theme.PRIMARY[0],
        ).pack(anchor="w", padx=20, pady=(0, 6))

        default_notification = "تم إنشاء الاختبار بنجاح! الأسئلة محفوظة وجاهزة للطباعة."
        self.notification_input = FormTextArea(
            card,
            label="رسالة التنبيه المخصصة",
            initial_value=self.wizard_state.get("custom_notification", default_notification),
            height=60
        )
        self.notification_input.pack(fill="x", padx=20, pady=(0, 16))

    def _resolve_language_key(self, label_value: str) -> str:
        if label_value == t("lang_en"):
            return "en"
        if label_value == t("lang_auto"):
            return "auto"
        return "ar"

    def save_state(self):
        self.wizard_state["name"] = self.name_input.get()
        self.wizard_state["subject"] = self.subject_input.get()
        self.wizard_state["grade"] = self.grade_input.get()
        self.wizard_state["duration"] = self.duration_input.get()
        self.wizard_state["exam_date"] = self.date_input.get()
        self.wizard_state["language"] = self._resolve_language_key(self.language_input.get())
        self.wizard_state["instructions"] = self.instructions_input.get()
        self.wizard_state["custom_notification"] = self.notification_input.get()
        self.wizard_state["notify_on_create"] = self.notify_on_create_var.get()

    def validate(self) -> bool:
        return bool(self.name_input.get().strip())
