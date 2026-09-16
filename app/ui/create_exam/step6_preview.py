# Step 6: Final Paper Preview & Generation Launcher
import customtkinter as ctk
import re
from typing import Dict, Any, List, Optional, Callable
from app.config.theme import Theme
from app.config.i18n import t
from app.services import QuestionService, ExamService, TemplateService
from app.services import build_exam_output_paths, build_and_open_html_print_preview
from app.ui.components import Card, PrimaryButton, SecondaryButton, OutlineButton, PaperPreviewWidget, ExportSuccessModal, GenerateExamProgressModal, Badge, ToastNotification

class Step6FinalPreview(ctk.CTkFrame):
    def __init__(
        self,
        master,
        wizard_state: Dict[str, Any],
        on_generate_complete: Optional[Callable[[Dict[str, Any]], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", **kwargs)
        import traceback
        try:
            self.wizard_state = wizard_state
            self.on_generate_complete = on_generate_complete

            self.q_ids = list(self.wizard_state.get("selected_question_ids", []))
            try:
                self.all_questions = QuestionService.get_questions(limit=300) or []
            except Exception as qe:
                print(f"[Step6] QuestionService failed: {qe}")
                self.all_questions = []

            if not self.q_ids:
                self._auto_populate_questions()

            self.selected_questions = [q for q in self.all_questions if q["id"] in self.q_ids]

            self.current_model = "A"
            try:
                self.templates_list = TemplateService.get_all_templates() or []
            except Exception as te:
                print(f"[Step6] TemplateService failed: {te}")
                self.templates_list = []

            self.current_template_id = self.wizard_state.get("template_id")
            self.current_template_name = self.wizard_state.get("template_name", "")
            if self.current_template_id:
                for t in self.templates_list:
                    if t["id"] == self.current_template_id:
                        self.current_template_name = t.get("name_ar", self.current_template_name)
                        break
            elif self.current_template_name:
                for t in self.templates_list:
                    if t.get("name_ar") == self.current_template_name:
                        self.current_template_id = t["id"]
                        break
            if (self.current_template_id is None) and self.templates_list:
                default_tpl = next((t for t in self.templates_list if t.get("is_default")), self.templates_list[0])
                self.current_template_id = default_tpl.get("id")
                self.current_template_name = default_tpl.get("name_ar", "")
                self.wizard_state["template_id"] = self.current_template_id
                self.wizard_state["template_name"] = self.current_template_name

            self.grid_columnconfigure(0, weight=1)
            self.grid_rowconfigure(2, weight=1)

            self._build_ui()
        except Exception as e:
            tb = traceback.format_exc()
            print(f"[Step6 INIT ERROR] {e}\n{tb}")
            self._render_init_error(e, tb)

    def _auto_populate_questions(self):
        try:
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
                self.q_ids = [q["id"] for q in picked]
                self.wizard_state["selected_question_ids"] = self.q_ids
        except Exception:
            pass

    def _build_ui(self):
        import traceback
        try:
            for w in self.winfo_children():
                w.destroy()

            if not self.selected_questions:
                self._build_empty_state()
                return

            # Top Control Bar (Model Switcher & Info)
            top_bar = Card(self)
            top_bar.grid(row=0, column=0, padx=20, pady=(10, 8), sticky="ew")
            top_bar.grid_columnconfigure(1, weight=1)
            top_bar.grid_columnconfigure(3, weight=1)
            top_bar.grid_columnconfigure(5, weight=0)

            # Model Selector Pills
            m_box = ctk.CTkFrame(top_bar, fg_color="transparent")
            m_box.grid(row=0, column=0, padx=16, pady=10, sticky="w")

            ctk.CTkLabel(m_box, text="معاينة النموذج:", font=Theme.bold_font(12), text_color=Theme.TEXT_PRIMARY).pack(side="left", padx=(0, 8))

            models_count = self.wizard_state.get("models_count", 4)
            model_letters = ["A", "B", "C", "D"][:models_count]
            
            for code in model_letters:
                is_active = (code == self.current_model)
                btn = ctk.CTkButton(
                    m_box,
                    text=f"النموذج ({code})",
                    width=80,
                    height=30,
                    corner_radius=Theme.CORNER_RADIUS_SM,
                    fg_color=Theme.PRIMARY[0] if is_active else "transparent",
                    hover_color=Theme.PRIMARY_HOVER[0] if is_active else Theme.BG_HOVER,
                    text_color="#FFFFFF" if is_active else Theme.TEXT_PRIMARY,
                    font=Theme.bold_font(11),
                    command=lambda c=code: self._switch_model(c)
                )
                btn.pack(side="left", padx=3)

            # Template Selector
            tpl_box = ctk.CTkFrame(top_bar, fg_color="transparent")
            tpl_box.grid(row=0, column=2, padx=16, pady=10, sticky="e")

            ctk.CTkLabel(tpl_box, text="القالب:", font=Theme.bold_font(12), text_color=Theme.TEXT_PRIMARY).pack(side="left", padx=(0, 8))

            current_tpl = self._get_current_template()
            for tpl in self.templates_list:
                is_active_tpl = (tpl["id"] == self.current_template_id)
                accent = tpl.get("accent_color", Theme.PRIMARY[0])
                btn = ctk.CTkButton(
                    tpl_box,
                    text=tpl.get("name_ar", "")[:16],
                    height=30,
                    corner_radius=Theme.CORNER_RADIUS_SM,
                    fg_color=accent if is_active_tpl else "transparent",
                    hover_color=accent if is_active_tpl else Theme.BG_HOVER,
                    text_color="#FFFFFF" if is_active_tpl else Theme.TEXT_PRIMARY,
                    font=Theme.bold_font(11),
                    command=lambda tid=tpl["id"], tname=tpl.get("name_ar", ""): self._switch_template(tid, tname)
                )
                btn.pack(side="left", padx=3)

            # Print Button
            print_box = ctk.CTkFrame(top_bar, fg_color="transparent")
            print_box.grid(row=0, column=4, padx=16, pady=10, sticky="e")

            print_btn = PrimaryButton(
                print_box,
                text="🖨️ طباعة",
                width=80,
                height=30,
                command=self._handle_print_preview
            )
            print_btn.pack(side="right")

            # Active template badge row
            if current_tpl:
                badge_row = Card(self, fg_color=Theme.BG_CARD_ALT)
                badge_row.grid(row=1, column=0, padx=20, pady=(0, 8), sticky="ew")
                inner = ctk.CTkFrame(badge_row, fg_color="transparent")
                inner.pack(fill="x", padx=16, pady=6)

                acc = current_tpl.get("accent_color", "#2563EB")
                Badge(inner, text=f"♦ {current_tpl.get('name_ar', '')}", bg_color=acc, text_color="#FFFFFF", size="small").pack(side="right")
                desc = current_tpl.get("description_ar", "")
                ctk.CTkLabel(inner, text=desc, font=Theme.body_font(11), text_color=Theme.TEXT_SECONDARY, anchor="w").pack(side="left", fill="x", expand=True)

            # Paper Preview Container
            exam_metadata = {
                "name": self.wizard_state.get("name", "اختبار فيزياء"),
                "subject": self.wizard_state.get("subject", "الفيزياء"),
                "duration": self.wizard_state.get("duration", "90 دقيقة"),
                "instructions": self.wizard_state.get("instructions"),
                "model_name": f"النموذج ({self.current_model})"
            }

            # Render questions in preview (simulating order for model)
            if self.current_model == "A":
                model_q = list(self.selected_questions)
            else:
                model_q = list(reversed(self.selected_questions))

            self.paper = PaperPreviewWidget(
                self,
                exam_data=exam_metadata,
                questions=model_q,
                model_code=self.current_model,
                template=current_tpl
            )
            self.paper.grid(row=2, column=0, padx=20, pady=(0, 10), sticky="nsew")

        except Exception as e:
            tb = traceback.format_exc()
            print(f"[Step6 _build_ui ERROR] {e}\n{tb}")
            for w in self.winfo_children():
                try:
                    w.destroy()
                except Exception:
                    pass
            self._render_init_error(e, tb, title="خطأ أثناء بناء واجهة المعاينة")

    def _build_empty_state(self):
        empty_card = Card(self)
        empty_card.grid(row=0, column=0, padx=40, pady=60, sticky="nsew")

        icon_lbl = ctk.CTkLabel(empty_card, text="⚠️", font=("Segoe UI", 52))
        icon_lbl.pack(pady=(30, 10))

        title_lbl = ctk.CTkLabel(
            empty_card,
            text="لا توجد أسئلة مُحددة للمعاينة",
            font=Theme.title_font(18),
            text_color=Theme.DANGER[0]
        )
        title_lbl.pack(pady=(0, 8))

        total_q = self.wizard_state.get("total_questions", 15)
        all_q_count = len(self.all_questions)
        desc_lbl = ctk.CTkLabel(
            empty_card,
            text=(
                f"لم يتم تحديد أسئلة كافية لإنشاء الامتحان.\n"
                f"المطلوب: {total_q} سؤال  •  المتاح في البنك: {all_q_count} سؤال\n\n"
                "الأسباب المحتملة:\n"
                "• لا توجد أسئلة تطابق معايير النوع والصعوبة والفصول المحددة\n"
                "• بنك الأسئلة فارغ أو يحتاج لإضافة أسئلة جديدة\n"
                "• تم القفز مباشرة إلى هذه الخطوة دون تحديد الأسئلة"
            ),
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            justify="center"
        )
        desc_lbl.pack(pady=(0, 24))

        btn_box = ctk.CTkFrame(empty_card, fg_color="transparent")
        btn_box.pack(pady=(0, 30))

        retry_btn = PrimaryButton(
            btn_box,
            text="🔄 محاولة الملء التلقائي",
            width=180,
            command=self._retry_auto_fill
        )
        retry_btn.pack(side="right", padx=6)

    def _retry_auto_fill(self):
        self._auto_populate_questions()
        self.selected_questions = [q for q in self.all_questions if q["id"] in self.q_ids]
        if self.selected_questions:
            ToastNotification.show(
                self.winfo_toplevel(),
                f"تم ملء {len(self.selected_questions)} سؤال تلقائياً!",
                toast_type="success"
            )
        else:
            ToastNotification.show(
                self.winfo_toplevel(),
                "لا توجد أسئلة متاحة تطابق المعايير المحددة. يرجى تعديل معايير البحث أو إضافة أسئلة للبنك.",
                toast_type="warning"
            )
        self._build_ui()

    def _get_current_template(self) -> Optional[Dict[str, Any]]:
        for t in self.templates_list:
            if t["id"] == self.current_template_id:
                return t
        return self.templates_list[0] if self.templates_list else None

    def _switch_template(self, template_id: int, template_name: str):
        self.current_template_id = template_id
        self.current_template_name = template_name
        self.wizard_state["template_id"] = template_id
        self.wizard_state["template_name"] = template_name
        self._build_ui()

    def _switch_model(self, code: str):
        self.current_model = code
        self._build_ui()

    def _handle_print_preview(self):
        try:
            from app.services import build_and_open_html_print_preview
            from app.config.settings import TeacherProfile
            
            current_tpl = self._get_current_template()
            exam_metadata = {
                "name": self.wizard_state.get("name", "اختبار فيزياء"),
                "subject": self.wizard_state.get("subject", "الفيزياء"),
                "grade": self.wizard_state.get("grade", "الصف الثالث الثانوي"),
                "duration": self.wizard_state.get("duration", "90 دقيقة"),
                "instructions": self.wizard_state.get("instructions", ""),
                "teacher_name": TeacherProfile.NAME_AR
            }
            
            # Get questions for current model
            if self.current_model == "A":
                model_q = list(self.selected_questions)
            else:
                model_q = list(reversed(self.selected_questions))
            
            # Build simple output paths for preview
            output_paths = build_exam_output_paths(exam_metadata["name"], 1)
            
            # Build questions per model dict
            questions_per_model = {
                self.current_model: model_q
            }
            
            # Detect language
            language = self.wizard_state.get("language", "ar")
            if language not in ("ar", "en"):
                language = _auto_detect_exam_lang(exam_metadata, model_q)
            
            # Open print preview
            build_and_open_html_print_preview(
                exam_name=exam_metadata["name"],
                exam_data=exam_metadata,
                questions_per_model=questions_per_model,
                output_paths=output_paths,
                language=language,
                template=current_tpl,
            )
            
            ToastNotification.show(
                self.winfo_toplevel(),
                "تم فتح نافذة معاينة الطباعة!",
                toast_type="success"
            )
        except Exception as e:
            import traceback
            print(f"[PRINT ERROR] {e}\n{traceback.format_exc()}")
            ToastNotification.show(
                self.winfo_toplevel(),
                f"حدث خطأ أثناء فتح معاينة الطباعة: {str(e)}",
                toast_type="error"
            )

    def generate_and_save(self):
        GenerateExamProgressModal(
            self.winfo_toplevel(),
            on_complete=self._do_commit_exam
        )

    def _do_commit_exam(self):
        if not self.q_ids:
            ToastNotification.show(
                self.winfo_toplevel(),
                "لا يمكن إنشاء الاختبار: لا توجد أسئلة محددة. يرجى العودة للخطوة 3.",
                toast_type="error"
            )
            return

        exam_data = {
            "name": self.wizard_state.get("name", "اختبار فيزياء"),
            "subject": self.wizard_state.get("subject", "الفيزياء"),
            "grade": self.wizard_state.get("grade", "الصف الثالث الثانوي"),
            "duration": self.wizard_state.get("duration", "90 دقيقة"),
            "exam_date": self.wizard_state.get("exam_date", "2026-08-30"),
            "instructions": self.wizard_state.get("instructions", ""),
            "language": self.wizard_state.get("language"),
            "template_id": self.current_template_id,
            "template_name": self.current_template_name or self.wizard_state.get("template_name", "الكلاسيكي المعتمد (Standard Ministry)")
        }
        models_config = {
            "models_count": self.wizard_state.get("models_count", 4),
            "shuffle_questions": self.wizard_state.get("shuffle_questions", True),
            "shuffle_choices": self.wizard_state.get("shuffle_choices", True),
            "balance_difficulty": self.wizard_state.get("balance_difficulty", True),
            "balance_chapters": self.wizard_state.get("balance_chapters", True)
        }

        try:
            created = ExamService.create_exam_with_models(exam_data, self.q_ids, models_config)

            exam_id = created.get("id")
            models_count = int(models_config["models_count"])
            output_paths = build_exam_output_paths(exam_data["name"], models_count)

            per_model_questions = ExamService.get_model_question_order(
                exam_id=exam_id,
                question_ids=self.q_ids,
                models_count=models_count,
                shuffle_q=bool(models_config.get("shuffle_questions", True)),
                shuffle_c=bool(models_config.get("shuffle_choices", True)),
            )

            language = exam_data.get("language")
            if language not in ("ar", "en"):
                language = _auto_detect_exam_lang(exam_data, self.selected_questions)

            from app.config.settings import TeacherProfile
            exam_payload = {
                "name": exam_data["name"],
                "subject": exam_data["subject"],
                "grade": exam_data["grade"],
                "duration": exam_data["duration"],
                "instructions": exam_data.get("instructions", ""),
                "teacher_name": TeacherProfile.NAME_AR if language != "en" else TeacherProfile.NAME_EN,
            }

            # Generate the HTML print preview and open print dialog automatically
            build_and_open_html_print_preview(
                exam_name=exam_data["name"],
                exam_data=exam_payload,
                questions_per_model=per_model_questions,
                output_paths=output_paths,
                language=language or "ar",
                template=self._get_current_template(),
            )

            ExportSuccessModal(
                self.winfo_toplevel(),
                exam_name=created.get("name", "Exam"),
                models_count=created.get("models_count", models_count),
                exam_id=exam_id,
                output_paths=output_paths,
                questions_per_model=per_model_questions,
                exam_payload=exam_payload,
                language=language or "ar",
            )

            if self.on_generate_complete:
                self.on_generate_complete(created)
        except Exception as e:
            err_msg = str(e) or "خطأ غير معروف"
            import traceback
            print(f"[GENERATE] {err_msg}\n{traceback.format_exc()}")
            ToastNotification.show(
                self.winfo_toplevel(),
                f"فشل إنشاء الاختبار: {err_msg}",
                toast_type="error"
            )

    def save_state(self):
        pass

    def validate(self) -> bool:
        return len(self.q_ids) > 0

    def _render_init_error(self, exc: Exception, tb: str, title: str = "خطأ أثناء تهيئة الخطوة"):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)

        err_card = Card(self)
        err_card.grid(row=0, column=0, padx=20, pady=20, sticky="nsew")

        icon_lbl = ctk.CTkLabel(err_card, text="🛠️", font=("Segoe UI", 56))
        icon_lbl.pack(pady=(20, 8))

        title_lbl = ctk.CTkLabel(
            err_card,
            text=title,
            font=Theme.title_font(18),
            text_color=Theme.DANGER[0]
        )
        title_lbl.pack(pady=(0, 8))

        msg_lbl = ctk.CTkLabel(
            err_card,
            text=f"{type(exc).__name__}: {str(exc)}",
            font=Theme.bold_font(13),
            text_color=Theme.TEXT_PRIMARY,
            wraplength=700,
            justify="center"
        )
        msg_lbl.pack(pady=(0, 12), padx=20)

        hint_lbl = ctk.CTkLabel(
            err_card,
            text=(
                "إرشادات:\n"
                "• تأكد من وجود أسئلة في بنك الأسئلة\n"
                "• تأكد من وجود قوالب امتحانات في قاعدة البيانات\n"
                "• جرب العودة للخطوة السابقة ثم التقدم مرة أخرى"
            ),
            font=Theme.body_font(12),
            text_color=Theme.TEXT_SECONDARY,
            justify="center"
        )
        hint_lbl.pack(pady=(0, 10))

        tb_frame = ctk.CTkFrame(err_card, fg_color="#0F172A", corner_radius=Theme.CORNER_RADIUS_MD)
        tb_frame.pack(fill="both", expand=True, padx=30, pady=(0, 10))

        tb_lbl = ctk.CTkLabel(
            tb_frame,
            text=tb[-1500:] if len(tb) > 1500 else tb,
            font=("Consolas", 10),
            text_color="#E2E8F0",
            justify="right",
            wraplength=760,
            anchor="ne"
        )
        tb_lbl.pack(padx=16, pady=16, anchor="ne")

        btn_row = ctk.CTkFrame(err_card, fg_color="transparent")
        btn_row.pack(pady=(0, 24))

        retry_btn = PrimaryButton(
            btn_row,
            text="🔄 إعادة المحاولة",
            width=140,
            command=self._safe_rebuild
        )
        retry_btn.pack(side="right", padx=6)

    def _safe_rebuild(self):
        try:
            if not hasattr(self, "all_questions") or not self.all_questions:
                try:
                    self.all_questions = QuestionService.get_questions(limit=300) or []
                except Exception:
                    self.all_questions = []
            if not hasattr(self, "templates_list") or not self.templates_list:
                try:
                    self.templates_list = TemplateService.get_all_templates() or []
                except Exception:
                    self.templates_list = []
            if not self.q_ids:
                self._auto_populate_questions()
            self.selected_questions = [q for q in self.all_questions if q["id"] in self.q_ids]
            self._build_ui()
        except Exception as e:
            import traceback
            self._render_init_error(e, traceback.format_exc(), title="لا تزال هناك مشكلة بعد إعادة المحاولة")


def _auto_detect_exam_lang(exam_data, selected_questions):
    samples = [
        exam_data.get("name", "") or "",
        exam_data.get("subject", "") or "",
        exam_data.get("instructions", "") or "",
    ]
    for q in (selected_questions or []):
        samples.append(str(q.get("text", "") or ""))
        for c in (q.get("choices") or []) or []:
            if isinstance(c, dict):
                samples.append(str(c.get("text", "") or ""))
    combined = " ".join(str(s) for s in samples if s)
    if not combined.strip():
        return "ar"
    ar_chars = len(re.findall(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', combined))
    en_chars = len(re.findall(r'[a-zA-Z]', combined))
    if ar_chars > en_chars:
        return "ar"
    if en_chars > ar_chars:
        return "en"
    return "ar"
