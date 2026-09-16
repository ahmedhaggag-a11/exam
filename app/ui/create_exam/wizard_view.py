# Exam Creation Wizard Container
import customtkinter as ctk
from typing import Dict, Any, Optional, Callable
from app.config.theme import Theme
from app.config.i18n import t
from app.ui.components import WizardStepper, PrimaryButton, SecondaryButton, OutlineButton, ToastNotification
from app.ui.create_exam.step1_basic import Step1BasicInfo
from app.ui.create_exam.step2_config import Step2QuestionConfig
from app.ui.create_exam.step3_select import Step3QuestionSelect
from app.ui.create_exam.step4_models import Step4ModelsConfig
from app.ui.create_exam.step5_template import Step5TemplateSelect
from app.ui.create_exam.step6_preview import Step6FinalPreview

class ExamWizardView(ctk.CTkFrame):
    def __init__(
        self,
        master,
        on_navigate: Optional[Callable[[str], None]] = None,
        on_notify: Optional[Callable[[str, str], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", corner_radius=0, **kwargs)
        self.on_navigate = on_navigate
        self.on_notify = on_notify

        self.current_step = 1
        self.wizard_state: Dict[str, Any] = {
            "name": "الاختبار الشامل على الفصول الأولى - مادة الفيزياء",
            "subject": "الفيزياء",
            "grade": "الصف الثالث الثانوي (العام والأزهر)",
            "duration": "90 دقيقة",
            "exam_date": "2026-08-30",
            "instructions": "1. أجب عن جميع الأسئلة بدقة.\n2. ظلل دائرة واحدة فقط لكل سؤال في ورقة الإجابة (بابل شيت).\n3. يسمح باستخدام الآلة الحاسبة غير المبرمجة.",
            "notify_on_create": True,
            "custom_notification": "تم إنشاء الاختبار بنجاح! الأسئلة محفوظة وجاهزة للطباعة.",
            "language": "ar",
            "mcq_count": 12,
            "essay_count": 2,
            "tf_count": 1,
            "total_questions": 15,
            "easy_count": 5,
            "medium_count": 7,
            "hard_count": 3,
            "selected_chapters": [],
            "selection_mode": "auto",
            "selected_question_ids": [],
            "models_count": 4,
            "shuffle_questions": True,
            "shuffle_choices": True,
            "balance_difficulty": True,
            "balance_chapters": True,
            "template_id": None,
            "template_name": "الكلاسيكي المعتمد (Standard Ministry)"
        }

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # 1. Top Stepper
        self.step_labels = [
            t("wizard_step_1"),
            t("wizard_step_2"),
            t("wizard_step_3"),
            t("wizard_step_4"),
            t("wizard_step_5"),
            t("wizard_step_6")
        ]
        self.stepper = WizardStepper(
            self,
            steps=self.step_labels,
            current_step=self.current_step,
            on_step_click=self._on_stepper_click
        )
        self.stepper.grid(row=0, column=0, padx=20, pady=(16, 8), sticky="ew")

        # 2. Step View Host Container (Scrollable)
        self.step_container = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.step_container.grid(row=1, column=0, sticky="nsew")
        self.step_container.grid_columnconfigure(0, weight=1)

        # 3. Bottom Action Bar
        self.action_bar = ctk.CTkFrame(self, height=60, corner_radius=Theme.CORNER_RADIUS_MD, fg_color=Theme.BG_CARD, border_color=Theme.BORDER, border_width=1)
        self.action_bar.grid(row=2, column=0, padx=20, pady=(8, 16), sticky="ew")
        self.action_bar.grid_columnconfigure(1, weight=1)

        self._build_action_buttons()
        self._load_current_step()

    def _build_action_buttons(self):
        for w in self.action_bar.winfo_children():
            w.destroy()

        # Left button: Back
        self.back_btn = OutlineButton(
            self.action_bar,
            text=f"← {t('btn_back')}",
            width=110,
            command=self._go_back
        )
        self.back_btn.pack(side="left", padx=16, pady=10)

        # Right buttons: Next / Generate / Draft
        if self.current_step < 6:
            self.next_btn = PrimaryButton(
                self.action_bar,
                text=f"{t('btn_next')} →",
                width=130,
                command=self._go_next
            )
            self.next_btn.pack(side="right", padx=16, pady=10)
        else:
            # Step 6 final actions
            gen_btn = PrimaryButton(
                self.action_bar,
                text=f"🚀 {t('btn_generate_exam')}",
                width=180,
                command=self._handle_generate_final
            )
            gen_btn.pack(side="right", padx=16, pady=10)

            # draft_btn = OutlineButton(
            #     self.action_bar,
            #     text=f"💾 {t('btn_save_draft')}",
            #     width=130,
            #     command=self._handle_save_draft
            # )
            # draft_btn.pack(side="right", padx=6, pady=10)

        # Update back button state
        if self.current_step == 1:
            self.back_btn.configure(state="disabled", fg_color="transparent", text_color=Theme.TEXT_MUTED[0])
        else:
            self.back_btn.configure(state="normal", text_color=Theme.TEXT_PRIMARY)

    def _load_current_step(self):
        import traceback
        for w in self.step_container.winfo_children():
            w.destroy()

        self.stepper.set_step(self.current_step)

        try:
            if self.current_step == 1:
                self.current_step_widget = Step1BasicInfo(self.step_container, self.wizard_state)
            elif self.current_step == 2:
                self.current_step_widget = Step2QuestionConfig(self.step_container, self.wizard_state)
            elif self.current_step == 3:
                self.current_step_widget = Step3QuestionSelect(self.step_container, self.wizard_state)
            elif self.current_step == 4:
                self.current_step_widget = Step4ModelsConfig(self.step_container, self.wizard_state)
            elif self.current_step == 5:
                self.current_step_widget = Step5TemplateSelect(self.step_container, self.wizard_state)
            elif self.current_step == 6:
                self.current_step_widget = Step6FinalPreview(
                    self.step_container,
                    self.wizard_state,
                    on_generate_complete=self._on_exam_generated
                )

            self.current_step_widget.pack(fill="both", expand=True)
        except Exception as e:
            err_tb = traceback.format_exc()
            print(f"[WIZARD ERROR] step {self.current_step}: {e}")
            print(err_tb)
            self._render_step_error(self.current_step, e, err_tb)

        try:
            self._build_action_buttons()
        except Exception as e2:
            print(f"[WIZARD ERROR] build_action_buttons: {e2}")

    def _render_step_error(self, step: int, exc: Exception, tb: str):
        from app.ui.components import Card, PrimaryButton
        err_box = Card(self.step_container)
        err_box.pack(fill="both", expand=True, padx=20, pady=20)

        icon_lbl = ctk.CTkLabel(err_box, text="🚨", font=("Segoe UI", 56))
        icon_lbl.pack(pady=(20, 8))

        title_lbl = ctk.CTkLabel(
            err_box,
            text=f"خطأ أثناء تحميل الخطوة {step}",
            font=Theme.title_font(18),
            text_color=Theme.DANGER[0]
        )
        title_lbl.pack(pady=(0, 8))

        msg_lbl = ctk.CTkLabel(
            err_box,
            text=f"{type(exc).__name__}: {str(exc)}",
            font=Theme.bold_font(13),
            text_color=Theme.TEXT_PRIMARY,
            wraplength=700,
            justify="center"
        )
        msg_lbl.pack(pady=(0, 12), padx=20)

        tb_frame = ctk.CTkFrame(err_box, fg_color="#0F172A", corner_radius=Theme.CORNER_RADIUS_MD)
        tb_frame.pack(fill="both", expand=True, padx=30, pady=(0, 10))

        tb_lbl = ctk.CTkLabel(
            tb_frame,
            text=tb[-1800:] if len(tb) > 1800 else tb,
            font=("Consolas", 10),
            text_color="#E2E8F0",
            justify="right",
            wraplength=760,
            anchor="ne"
        )
        tb_lbl.pack(padx=16, pady=16, anchor="ne")

        btn_row = ctk.CTkFrame(err_box, fg_color="transparent")
        btn_row.pack(pady=(0, 24))

        retry_btn = PrimaryButton(
            btn_row,
            text="🔄 إعادة المحاولة",
            width=140,
            command=lambda: self._load_current_step()
        )
        retry_btn.pack(side="right", padx=6)

        back_btn = ctk.CTkButton(
            btn_row,
            text="← العودة للخلف",
            width=140,
            height=34,
            corner_radius=Theme.CORNER_RADIUS_MD,
            fg_color="transparent",
            hover_color=Theme.BG_HOVER,
            text_color=Theme.TEXT_PRIMARY,
            border_color=Theme.BORDER[0] if isinstance(Theme.BORDER, list) else Theme.BORDER,
            border_width=1,
            font=Theme.bold_font(12),
            command=self._go_back
        )
        back_btn.pack(side="right", padx=6)

    def _go_next(self):
        if hasattr(self, "current_step_widget"):
            if not self.current_step_widget.validate():
                if self.current_step == 1:
                    ToastNotification.show(self.winfo_toplevel(), t("err_exam_name_required"), toast_type="warning")
                elif self.current_step == 2:
                    ToastNotification.show(self.winfo_toplevel(), t("summary_invalid_diff"), toast_type="warning")
                elif self.current_step == 3:
                    ToastNotification.show(self.winfo_toplevel(), "يرجى تحديد سؤال واحد على الأقل للمتابعة.", toast_type="warning")
                return

            self.current_step_widget.save_state()

        if self.current_step < 6:
            self.current_step += 1
            self._load_current_step()

    def _go_back(self):
        if hasattr(self, "current_step_widget"):
            self.current_step_widget.save_state()

        if self.current_step > 1:
            self.current_step -= 1
            self._load_current_step()

    def _on_stepper_click(self, step: int):
        if hasattr(self, "current_step_widget"):
            if not self.current_step_widget.validate():
                if self.current_step == 1:
                    ToastNotification.show(self.winfo_toplevel(), t("err_exam_name_required"), toast_type="warning")
                elif self.current_step == 2:
                    ToastNotification.show(self.winfo_toplevel(), t("summary_invalid_diff"), toast_type="warning")
                elif self.current_step == 3:
                    ToastNotification.show(self.winfo_toplevel(), "يرجى تحديد سؤال واحد على الأقل للمتابعة.", toast_type="warning")
                return
            self.current_step_widget.save_state()

        if step > self.current_step + 1:
            for s in range(self.current_step + 1, step):
                if not self._ensure_step_prerequisites(s):
                    ToastNotification.show(
                        self.winfo_toplevel(),
                        f"يرجى استكمال الخطوة {s} أولاً قبل الانتقال.",
                        toast_type="warning"
                    )
                    self.current_step = s
                    self._load_current_step()
                    return

        self.current_step = step
        self._load_current_step()

    def _ensure_step_prerequisites(self, step: int) -> bool:
        if step == 3:
            from app.services import QuestionService
            if not self.wizard_state.get("selected_question_ids"):
                target = self.wizard_state.get("total_questions", 15)
                type_quotas = {
                    "mcq": self.wizard_state.get("mcq_count", 10),
                    "essay": self.wizard_state.get("essay_count", 3),
                    "true_false": self.wizard_state.get("tf_count", 2)
                }
                diff_quotas = {
                    "easy": self.wizard_state.get("easy_count", 5),
                    "medium": self.wizard_state.get("medium_count", 7),
                    "hard": self.wizard_state.get("hard_count", 3)
                }
                chaps = self.wizard_state.get("selected_chapters", [])
                picked = QuestionService.auto_select_questions(target, type_quotas, diff_quotas, chaps)
                if picked:
                    self.wizard_state["selected_question_ids"] = [q["id"] for q in picked]
                    return True
                return False
        return True

    def _handle_generate_final(self):
        if hasattr(self, "current_step_widget") and isinstance(self.current_step_widget, Step6FinalPreview):
            if not self.current_step_widget.validate():
                ToastNotification.show(
                    self.winfo_toplevel(),
                    "لا يمكن توليد الاختبار: لم يتم تحديد أي أسئلة. يرجى العودة للخطوة 3 وتحديد الأسئلة.",
                    toast_type="warning"
                )
                return
            self.current_step_widget.generate_and_save()

    def _handle_save_draft(self):
        # Validate that we have at least some questions
        question_ids = self.wizard_state.get("selected_question_ids", [])
        if not question_ids:
            ToastNotification.show(
                self.winfo_toplevel(),
                "لا يمكن حفظ مسودة بدون أسئلة. يرجى تحديد أسئلة أولاً.",
                toast_type="warning"
            )
            return

        exam_data = {
            "name": self.wizard_state.get("name", "مسودة اختبار فيزياء"),
            "subject": self.wizard_state.get("subject", "الفيزياء"),
            "grade": self.wizard_state.get("grade", "الصف الثالث الثانوي"),
            "duration": self.wizard_state.get("duration", "90 دقيقة"),
            "exam_date": self.wizard_state.get("exam_date", "2026-08-30"),
            "instructions": self.wizard_state.get("instructions", ""),
            "language": self.wizard_state.get("language"),
            "template_id": self.wizard_state.get("template_id"),
            "template_name": self.wizard_state.get("template_name", "الكلاسيكي المعتمد (Standard Ministry)")
        }
        models_config = {
            "models_count": self.wizard_state.get("models_count", 4),
            "shuffle_questions": self.wizard_state.get("shuffle_questions", True),
            "shuffle_choices": self.wizard_state.get("shuffle_choices", True),
            "balance_difficulty": self.wizard_state.get("balance_difficulty", True),
            "balance_chapters": self.wizard_state.get("balance_chapters", True)
        }
        
        try:
            ExamService.save_draft(
                exam_data,
                question_ids,
                models_config
            )
            draft_message = self.wizard_state.get("custom_notification", "").strip()
            if self.on_notify and self.wizard_state.get("notify_on_create", True):
                self.on_notify(draft_message or "تم حفظ مسودة الاختبار بنجاح!", "success")
            else:
                ToastNotification.show(self.winfo_toplevel(), "تم حفظ مسودة الاختبار بنجاح!", toast_type="success")
            if self.on_navigate:
                self.on_navigate("exams")
        except Exception as e:
            import traceback
            error_msg = str(e) or "خطأ غير معروف"
            print(f"[SAVE DRAFT ERROR] {error_msg}\n{traceback.format_exc()}")
            ToastNotification.show(
                self.winfo_toplevel(),
                f"فشل حفظ المسودة: {error_msg}",
                toast_type="error"
            )

    def _on_exam_generated(self, exam_data: Dict[str, Any]):
        custom_msg = self.wizard_state.get("custom_notification")
        notification_message = custom_msg if custom_msg else t("msg_exam_created")
        
        if self.on_notify and self.wizard_state.get("notify_on_create", True):
            self.on_notify(notification_message, "success")
        if self.on_navigate:
            self.on_navigate("exams")
