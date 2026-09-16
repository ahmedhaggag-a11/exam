# ExamForge Internationalization (i18n) Engine - Arabic First with RTL Support

CURRENT_LANGUAGE = "ar"  # "ar" or "en"

TRANSLATIONS = {
    "ar": {
        # App & Header
        "app_name": "ExamForge",
        "app_tagline": "منصة صانع الاختبارات الذكية",
        "teacher_name": "الأستاذ / أحمد فؤاد",
        "teacher_subject": "الفيزياء للثانوية العامة",
        "search_placeholder": "بحث سريع في الاختبارات، الأسئلة، أو النماذج...",
        "notifications": "الإشعارات",
        "license_active": "الترخيص: ساري ونشط",
        # "license_valid_until": "صالح حتى",
        "version": "الإصدار",
        "system_locked_badge": "مُدار ومُقفل بواسطة إدارة المنصة",
        "admin_locked_msg": "المصادر والعلامة التجارية وإعدادات الترخيص يتم ضبطها بواسطة مزود الخدمة فقط ولا يمكن تعديلها من قبل المعلم.",

        # Navigation
        "nav_dashboard": "لوحة التحكم",
        "nav_create_exam": "إنشاء اختبار",
        "nav_question_bank": "بنك الأسئلة",
        "nav_exams": "سجل الاختبارات",
        "nav_templates": "النماذج والقوالب",
        "nav_sources": "المصادر والمراجع",
        "nav_settings": "الإعدادات العامة",

        # Dashboard
        "dash_welcome": "مرحباً بك،",
        "dash_welcome_sub": "لديك جاهزية كاملة لإنشاء نماذج اختبارات متوازنة ومتوافقة مع مواصفات الورقة الامتحانية.",
        "stat_total_questions": "إجمالي الأسئلة",
        "stat_total_exams": "الاختبارات المنشأة",
        "stat_total_models": "النماذج المولدة",
        "stat_total_sources": "المصادر المعتمدة",
        "dash_recent_exams": "أحدث الاختبارات المُعدة",
        "dash_view_all_exams": "عرض كل الاختبارات",
        "dash_quick_actions": "إجراءات سريعة",
        "dash_analytics_title": "تحليلات بنك الأسئلة والمحتوى",
        "dash_by_difficulty": "توزيع الأسئلة حسب الصعوبة",
        "dash_by_type": "توزيع الأسئلة حسب النوع",
        "dash_by_chapter": "توزيع الأسئلة حسب الفصول",
        "action_create_exam": "إنشاء اختبار جديد",
        "action_add_question": "إضافة سؤال جديد",
        "action_open_bank": "استعراض بنك الأسئلة",
        "action_manage_templates": "استعراض القوالب",

        # Table Columns & Common
        "col_exam_name": "اسم الاختبار",
        "col_subject": "المادة",
        "col_grade": "الصف",
        "col_date": "تاريخ الإعداد",
        "col_questions_count": "عدد الأسئلة",
        "col_models_count": "عدد النماذج",
        "col_status": "الحالة",
        "col_actions": "الإجراءات",
        "status_ready": "جاهز للاعتماد",
        "status_generated": "تم توليد النماذج",
        "status_draft": "مسودة",
        "btn_open": "فتح",
        "btn_edit": "تعديل",
        "btn_duplicate": "نسخ",
        "btn_delete": "حذف",
        "btn_generate": "توليد النماذج",
        "btn_export_pdf": "تصدير PDF",
        "btn_details": "تفاصيل",
        "btn_save": "حفظ",
        "btn_cancel": "إلغاء",
        "btn_confirm": "تأكيد",
        "btn_back": "السابق",
        "btn_next": "التالي",
        "btn_close": "إغلاق",
        "btn_apply_filters": "تطبيق التصفية",
        "btn_reset_filters": "إعادة ضبط",

        # Create Exam Wizard Steps
        "wizard_step_1": "1. البيانات الأساسية",
        "wizard_step_2": "2. ضبط وتوزيع الأسئلة",
        "wizard_step_3": "3. اختيار الأسئلة",
        "wizard_step_4": "4. إعداد النماذج والخلط",
        "wizard_step_5": "5. اختيار القالب والتصميم",
        "wizard_step_6": "6. المعاينة النهائية والتوليد",

        # Step 1: Basic Info
        "step1_title": "البيانات العامة للاختبار",
        "step1_subtitle": "حدد اسم الاختبار، المادة الدراسية، لغة الامتحان، والزمن المخصص والتعليمات.",
        "field_exam_name": "اسم / عنوان الاختبار",
        "field_exam_name_ph": "مثال: اختبار شامل على الفصل الأول والثاني - فيزياء",
        "field_subject": "المادة الدراسية",
        "field_grade": "الصف الدراسي",
        "field_duration": "المدة الزمنية",
        "field_duration_ph": "مثال: 90 دقيقة",
        "field_exam_date": "تاريخ الاختبار",
        "field_exam_language": "لغة الامتحان (تحدد اتجاه الورقة)",
        "lang_ar_auto": "العربية (RTL - اتجاه من اليمين)",
        "lang_en": "الإنجليزية / لغة أجنبية (LTR - اتجاه من اليسار)",
        "lang_auto": "كشف تلقائي من المحتوى",
        "field_instructions": "تعليمات وتوجيهات للطلاب",
        "field_instructions_default": "1. أجب عن جميع الأسئلة بدقة.\n2. ظلل دائرة واحدة فقط لكل سؤال في ورقة الإجابة (بابل شيت).\n3. يسمح باستخدام الآلة الحاسبة غير المبرمجة.",

        # Step 2: Question Config
        "step2_title": "مواصفات وتوزيع الأسئلة",
        "step2_subtitle": "حدد حصص أنواع الأسئلة، ومستويات الصعوبة، والفصول الدراسية المطلوبة.",
        "section_question_types": "أنواع الأسئلة وأعدادها",
        "type_mcq": "اختيار من متعدد (MCQ)",
        "type_essay": "أسئلة مقالية",
        "type_true_false": "صح أو خطأ",
        "section_difficulty": "توزيع مستويات الصعوبة",
        "diff_easy": "مستوى سهل (تذكر ومباشر)",
        "diff_medium": "مستوى متوسط (فهم وتطبيق)",
        "diff_hard": "مستوى متقدم (تحليل ومهارات عليا)",
        "section_chapters": "تحديد الفصول الدراسية المستهدفة",
        "card_live_summary": "الملخص المباشر لمواصفات الاختبار",
        "summary_total_questions": "إجمالي الأسئلة المحددة",
        "summary_types_breakdown": "توزيع الأنواع",
        "summary_difficulty_breakdown": "توزيع الصعوبة",
        "summary_valid": "المواصفات متوازنة وجاهزة للتوليد",
        "summary_invalid_diff": "تنبيه: مجموع نسب الصعوبة يجب أن يساوي إجمالي الأسئلة المطلوبة!",

        # Step 3: Selection Mode
        "step3_title": "طريقة انتقاء الأسئلة",
        "step3_subtitle": "اختر بين التوليد الآلي الذكي المتوازن أو الاختيار اليدوي المخصص من البنك.",
        "mode_auto": "أ. الاختيار التلقائي الذكي (نوصي به)",
        "mode_auto_desc": "يقوم محرك ExamForge باختيار أفضل الأسئلة تلقائياً بما يطابق مصفوفة الصعوبة والفصول المحددة.",
        "mode_manual": "ب. الاختيار اليدوي المخصص",
        "mode_manual_desc": "استعراض بنك الأسئلة واختيار كل سؤال يدوياً مع إمكانية التبديل والمراجعة.",
        "badge_selected_count": "تم تحديد: {count} من {target} سؤال",

        # Step 4: Models & Shuffling
        "step4_title": "توليد النماذج الامتحانية المتعددة (منع الغش)",
        "step4_subtitle": "حدد عدد النماذج المطلوبة وخيارات خلط وترتيب الأسئلة والبدائل.",
        "field_models_count": "عدد النماذج الامتحانية:",
        "opt_shuffle_questions": "خلط وإعادة ترتيب الأسئلة عشوائياً بين النماذج",
        "opt_shuffle_choices": "خلط ترتيب بدائل الإجابة (أ، ب، ج، د) لأسئلة الاختيار من متعدد",
        "opt_balance_difficulty": "الحفاظ التام على توازن توزيع الصعوبة عبر كل نموذج",
        "opt_balance_chapters": "الحفاظ على توزيع فصول المنهج بالتساوي",
        "models_preview_title": "معاينة توزيع النماذج المتولدة",

        # Step 5: Templates
        "step5_title": "قالب وتصميم الورقة الامتحانية",
        "step5_subtitle": "اختر القالب المعتمد المخصص لعلامتك التعليمية.",
        "btn_preview_template": "معاينة مظهر القالب",

        # Step 6: Final Preview
        "step6_title": "المعاينة التفاعلية والتصدير",
        "step6_subtitle": "معاينة واقعية لورقة الاختبار والترويسة الرسمية قبل الاعتماد النهائي.",
        "btn_generate_exam": "توليد وتثبيت الاختبار",
        # "btn_save_draft": "حفظ كمسودة",

        # Question Bank
        "bank_title": "بنك الأسئلة الذكي",
        "bank_subtitle": "استعراض وتصفية وإدارة الأسئلة المصنفة مع خيارات التعديل والإضافة.",
        "filter_all_subjects": "جميع المواد",
        "filter_all_chapters": "جميع الفصول",
        "filter_all_types": "جميع الأنواع",
        "filter_all_difficulties": "جميع المستويات",
        "filter_all_sources": "جميع المصادر",
        "col_question_text": "نص السؤال",
        "col_type": "النوع",
        "col_chapter": "الفصل / الوحدة",
        "col_difficulty": "الصعوبة",
        "col_source": "المصدر التعليمي",
        "btn_add_new_question": "إضافة سؤال جديد",

        # Add/Edit Question Modal
        "modal_add_question_title": "إضافة سؤال جديد إلى البنك",
        "modal_edit_question_title": "تعديل السؤال في البنك",
        "field_q_text": "نص السؤال الكامل",
        "field_q_text_ph": "اكتب نص السؤال هنا بدقة ووضوح...",
        "field_q_type": "نوع السؤال",
        "field_q_diff": "مستوى الصعوبة",
        "field_q_chapter": "الفصل / الوحدة",
        "field_q_source": "المصدر التعليمي",
        "field_q_tags": "الوسوم والكلمات الدلالية",
        "field_q_tags_ph": "مثال: قانون أوم، مقاومة نوعية، تيار كهربي",
        "field_mcq_choices": "خيارات وبدائل الإجابة (حدد الإجابة الصحيحة):",
        "choice_a": "الخيار (أ)",
        "choice_b": "الخيار (ب)",
        "choice_c": "الخيار (ج)",
        "choice_d": "الخيار (د)",
        "correct_answer_label": "الإجابة النموذجية الصحيحة",
        "field_model_answer": "الإجابة النموذجية المقترحة / معايير التوزيع",
        "field_model_answer_ph": "اكتب خطوات الحل النموذجية وتوزيع الدرجات...",

        # Templates Screen
        "templates_title": "قوالب ونماذج الاختبارات",
        "templates_subtitle": "قوالب جاهزة ومعتمدة ومصممة بأعلى معايير الطباعة والوضوح لعلامتك التعليمية.",
        "template_active_badge": "القالب الافتراضي المعتمد",
        "template_select_btn": "تعيين كافتراضي",

        # Sources Screen
        "sources_title": "المصادر والمراجع التعليمية المعتمدة",
        "sources_subtitle": "المصادر الرسمية والكتب الدراسية المعتمدة والمربوطة ببنك الأسئلة.",
        "col_source_name": "اسم المصدر / الكتاب",
        "col_chapters_count": "عدد الفصول",
        "col_questions_count": "عدد الأسئلة المرتبطة",
        "col_last_updated": "آخر تحديث للمحتوى",

        # Settings Screen
        "settings_title": "الإعدادات العامة وتفضيلات المعلم",
        "settings_subtitle": "إدارة الملف الشخصي للمعلم، تفضيلات العرض واللغة، والإشعارات.",
        "section_teacher_profile": "الملف الشخصي للمعلم (للعرض في الترويسة)",
        "field_teacher_name": "اسم المعلم الكامل",
        "field_teacher_title": "المسمى الأكاديمي والصفة",
        "field_center_name": "اسم المدرسة / الأكاديمية / المركز",
        "field_phone": "رقم الهاتف والتواصل",
        "field_email": "البريد الإلكتروني المهني",
        "section_preferences": "تفضيلات الواجهة والتطبيق",
        "pref_language": "لغة واجهة التطبيق",
        "pref_theme": "المظهر العام (الوضع الداكن / الفاتح)",
        "theme_light": "الوضع الفاتح (الافتراضي)",
        "theme_dark": "الوضع الداكن المريح للعين",
        "theme_system": "حسب مظهر النظام",
        "pref_notifications": "تفعيل التنبيهات وإشعارات الحفظ التلقائي",
        "section_license_info": "بيانات الترخيص والنظام (حساب المعلم)",
        "btn_save_preferences": "حفظ التفضيلات",

        # Alerts & Validation Messages
        "msg_saved_success": "تم حفظ البيانات بنجاح!",
        "msg_question_added": "تمت إضافة السؤال الجديد إلى بنك الأسئلة بنجاح.",
        "msg_question_updated": "تم تحديث بيانات السؤال بنجاح.",
        "msg_question_deleted": "تم حذف السؤال من بنك الأسئلة.",
        "msg_exam_created": "تم إنشاء الاختبار وتوليد النماذج بنجاح!",
        "msg_pdf_exported": "تم تصدير ملفات PDF للنماذج بنجاح في مجلد الإخراج.",
        "msg_confirm_delete_q": "هل أنت متأكد من رغبتك في حذف هذا السؤال نهائياً؟",
        "msg_confirm_delete_exam": "هل أنت متأكد من حذف هذا الاختبار؟",
        "err_exam_name_required": "يرجى إدخال اسم أو عنوان الاختبار للمتابعة.",
        "err_question_text_required": "يرجى كتابة نص السؤال.",
        "err_not_enough_questions": "لا يتوفر عدد كافٍ من الأسئلة في بنك الأسئلة يطابق هذه المواصفات.",
        "err_choices_required": "يرجى ملء جميع خيارات السؤال واختيار الإجابة الصحيحة.",
    },
    "en": {
        # App & Header
        "app_name": "ExamForge",
        "app_tagline": "Smart Exam Authoring & Management",
        "teacher_name": "Mr. Ahmed Fouad",
        "teacher_subject": "Physics for High School",
        "search_placeholder": "Quick search exams, questions, or templates...",
        "notifications": "Notifications",
        "license_active": "License: Active",
        "license_valid_until": "Valid Until",
        "version": "Version",
        "system_locked_badge": "Managed & Locked by Administration",
        "admin_locked_msg": "Educational sources, core branding, and license settings are administered exclusively by the provider.",

        # Navigation
        "nav_dashboard": "Dashboard",
        "nav_create_exam": "Create Exam",
        "nav_question_bank": "Question Bank",
        "nav_exams": "Exams",
        "nav_templates": "Templates",
        "nav_sources": "Sources",
        "nav_settings": "Settings",

        # Dashboard
        "dash_welcome": "Welcome back,",
        "dash_welcome_sub": "You are ready to generate balanced, multi-model exams compliant with curriculum standards.",
        "stat_total_questions": "Total Questions",
        "stat_total_exams": "Exams Created",
        "stat_total_models": "Models Generated",
        "stat_total_sources": "Approved Sources",
        "dash_recent_exams": "Recent Exams",
        "dash_view_all_exams": "View All Exams",
        "dash_quick_actions": "Quick Actions",
        "dash_analytics_title": "Question Bank Analytics",
        "dash_by_difficulty": "Questions by Difficulty",
        "dash_by_type": "Questions by Type",
        "dash_by_chapter": "Questions by Chapter",
        "action_create_exam": "Create New Exam",
        "action_add_question": "Add Question",
        "action_open_bank": "Open Question Bank",
        "action_manage_templates": "Manage Templates",

        # Table Columns & Common
        "col_exam_name": "Exam Name",
        "col_subject": "Subject",
        "col_grade": "Grade",
        "col_date": "Date Created",
        "col_questions_count": "Questions",
        "col_models_count": "Models",
        "col_status": "Status",
        "col_actions": "Actions",
        "status_ready": "Ready",
        "status_generated": "Models Generated",
        "status_draft": "Draft",
        "btn_open": "Open",
        "btn_edit": "Edit",
        "btn_duplicate": "Duplicate",
        "btn_delete": "Delete",
        "btn_generate": "Generate Models",
        "btn_export_pdf": "Export PDF",
        "btn_details": "Details",
        "btn_save": "Save",
        "btn_cancel": "Cancel",
        "btn_confirm": "Confirm",
        "btn_back": "Back",
        "btn_next": "Next",
        "btn_close": "Close",
        "btn_apply_filters": "Apply Filters",
        "btn_reset_filters": "Reset",

        # Create Exam Wizard Steps
        "wizard_step_1": "1. Basic Info",
        "wizard_step_2": "2. Configuration",
        "wizard_step_3": "3. Question Selection",
        "wizard_step_4": "4. Models & Shuffling",
        "wizard_step_5": "5. Template Design",
        "wizard_step_6": "6. Preview & Finalize",

        # Step 1: Basic Info
        "step1_title": "Basic Exam Information",
        "step1_subtitle": "Specify the exam title, subject, exam language, grade level, time duration, and student instructions.",
        "field_exam_name": "Exam Title",
        "field_exam_name_ph": "e.g., Comprehensive Exam on Chapters 1 & 2 - Physics",
        "field_subject": "Subject",
        "field_grade": "Grade Level",
        "field_duration": "Duration",
        "field_duration_ph": "e.g., 90 minutes",
        "field_exam_date": "Exam Date",
        "field_exam_language": "Exam Language (controls paper direction)",
        "lang_ar_auto": "Arabic (RTL - Right-to-Left)",
        "lang_en": "English / Foreign Language (LTR - Left-to-Right)",
        "lang_auto": "Auto-detect from content",
        "field_instructions": "Instructions for Students",
        "field_instructions_default": "1. Answer all questions carefully.\n2. Shade only one bubble per question on the answer sheet.\n3. Non-programmable scientific calculators are permitted.",

        # Step 2: Question Config
        "step2_title": "Question Distribution & Quotas",
        "step2_subtitle": "Define question types, target difficulty breakdown, and syllabus chapters.",
        "section_question_types": "Question Types & Counts",
        "type_mcq": "Multiple Choice (MCQ)",
        "type_essay": "Essay / Problem Solving",
        "type_true_false": "True / False",
        "section_difficulty": "Difficulty Distribution",
        "diff_easy": "Easy (Direct Recall)",
        "diff_medium": "Medium (Application)",
        "diff_hard": "Hard (Higher-order Analysis)",
        "section_chapters": "Select Curriculum Chapters",
        "card_live_summary": "Live Exam Specification Summary",
        "summary_total_questions": "Total Target Questions",
        "summary_types_breakdown": "Type Distribution",
        "summary_difficulty_breakdown": "Difficulty Distribution",
        "summary_valid": "Specifications are balanced and ready",
        "summary_invalid_diff": "Warning: Difficulty sum must match total question target!",

        # Step 3: Selection Mode
        "step3_title": "Question Selection Strategy",
        "step3_subtitle": "Choose intelligent automated balancing or hand-pick questions from the bank.",
        "mode_auto": "A. Automatic Smart Selection (Recommended)",
        "mode_auto_desc": "ExamForge AI engine selects balanced questions conforming strictly to difficulty and chapter quotas.",
        "mode_manual": "B. Manual Custom Selection",
        "mode_manual_desc": "Browse the verified question bank and pick individual items with instant preview.",
        "badge_selected_count": "Selected: {count} of {target} questions",

        # Step 4: Models & Shuffling
        "step4_title": "Multi-Model Exam Generation (Anti-Cheat)",
        "step4_subtitle": "Generate multiple balanced exam variants with intelligent shuffling.",
        "field_models_count": "Number of Exam Models:",
        "opt_shuffle_questions": "Shuffle question sequence across models",
        "opt_shuffle_choices": "Shuffle answer choice positions (A, B, C, D) for MCQs",
        "opt_balance_difficulty": "Strictly preserve difficulty balance across all models",
        "opt_balance_chapters": "Keep chapter distributions uniform",
        "models_preview_title": "Generated Model Distribution Preview",

        # Step 5: Templates
        "step5_title": "Exam Template & Layout",
        "step5_subtitle": "Select a certified template customized for your branding.",
        "btn_preview_template": "Preview Template Layout",

        # Step 6: Final Preview
        "step6_title": "Interactive Exam Paper Preview",
        "step6_subtitle": "Inspect realistic rendered exam sheets and branding headers prior to generation.",
        "btn_generate_exam": "Generate & Finalize Exam",
        "btn_save_draft": "Save as Draft",

        # Question Bank
        "bank_title": "Question Bank",
        "bank_subtitle": "Search, filter, and manage verified curriculum questions.",
        "filter_all_subjects": "All Subjects",
        "filter_all_chapters": "All Chapters",
        "filter_all_types": "All Types",
        "filter_all_difficulties": "All Difficulties",
        "filter_all_sources": "All Sources",
        "col_question_text": "Question Text",
        "col_type": "Type",
        "col_chapter": "Chapter",
        "col_difficulty": "Difficulty",
        "col_source": "Source",
        "btn_add_new_question": "Add New Question",

        # Add/Edit Question Modal
        "modal_add_question_title": "Add New Question to Bank",
        "modal_edit_question_title": "Edit Question",
        "field_q_text": "Question Statement",
        "field_q_text_ph": "Enter the complete question text clearly...",
        "field_q_type": "Question Type",
        "field_q_diff": "Difficulty Level",
        "field_q_chapter": "Curriculum Chapter",
        "field_q_source": "Educational Source",
        "field_q_tags": "Tags & Keywords",
        "field_q_tags_ph": "e.g., Ohm's Law, Resistivity, Electric Current",
        "field_mcq_choices": "Choices & Alternatives (Select correct answer):",
        "choice_a": "Choice (A)",
        "choice_b": "Choice (B)",
        "choice_c": "Choice (C)",
        "choice_d": "Choice (D)",
        "correct_answer_label": "Correct Answer",
        "field_model_answer": "Model Answer / Grading Rubric",
        "field_model_answer_ph": "Detail the full solution steps and mark allocation...",

        # Templates Screen
        "templates_title": "Exam Templates Catalog",
        "templates_subtitle": "Certified high-clarity printable exam formats tailored for your academy.",
        "template_active_badge": "Default Certified Template",
        "template_select_btn": "Set as Default",

        # Sources Screen
        "sources_title": "Approved Educational Sources",
        "sources_subtitle": "Official textbooks and ministry question banks linked to your edition.",
        "col_source_name": "Source / Book Title",
        "col_chapters_count": "Chapters",
        "col_questions_count": "Linked Questions",
        "col_last_updated": "Last Synchronized",

        # Settings Screen
        "settings_title": "General Settings & Preferences",
        "settings_subtitle": "Manage teacher profile preview, display language, theme, and notifications.",
        "section_teacher_profile": "Teacher Profile (Rendered in Headers)",
        "field_teacher_name": "Full Teacher Name",
        "field_teacher_title": "Academic Title",
        "field_center_name": "School / Academy Name",
        "field_phone": "Contact Phone",
        "field_email": "Professional Email",
        "section_preferences": "Interface & Application Preferences",
        "pref_language": "Application Language",
        "pref_theme": "Color Theme",
        "theme_light": "Light Theme (Default)",
        "theme_dark": "Dark Theme (Eye-comfort)",
        "theme_system": "System Default",
        "pref_notifications": "Enable toasts and auto-save notifications",
        "section_license_info": "System & License Information",
        "btn_save_preferences": "Save Preferences",

        # Alerts & Validation Messages
        "msg_saved_success": "Changes saved successfully!",
        "msg_question_added": "New question added to the Question Bank successfully.",
        "msg_question_updated": "Question details updated successfully.",
        "msg_question_deleted": "Question removed from Question Bank.",
        "msg_exam_created": "Exam and multi-models generated successfully!",
        "msg_pdf_exported": "PDF files exported successfully to the output folder.",
        "msg_confirm_delete_q": "Are you sure you want to permanently delete this question?",
        "msg_confirm_delete_exam": "Are you sure you want to delete this exam?",
        "err_exam_name_required": "Please enter the exam name to proceed.",
        "err_question_text_required": "Question text is required.",
        "err_not_enough_questions": "Not enough questions in the bank matching this configuration.",
        "err_choices_required": "Please fill all choices and designate the correct answer.",
    }
}

def t(key: str, **kwargs) -> str:
    """Translate key for current language with string formatting support"""
    lang_dict = TRANSLATIONS.get(CURRENT_LANGUAGE, TRANSLATIONS["ar"])
    text = lang_dict.get(key, TRANSLATIONS["ar"].get(key, key))
    if kwargs:
        try:
            return text.format(**kwargs)
        except Exception:
            return text
    return text

def set_language(lang: str):
    global CURRENT_LANGUAGE
    if lang in TRANSLATIONS:
        CURRENT_LANGUAGE = lang

def get_language() -> str:
    return CURRENT_LANGUAGE

def is_rtl() -> bool:
    return CURRENT_LANGUAGE == "ar"
