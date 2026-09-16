# Teacher Settings & Preferences View
import customtkinter as ctk
from typing import Optional, Callable, Dict, Any
from app.config.theme import Theme
from app.config.i18n import t, get_language, set_language
from app.config.settings import TeacherProfile, LicenseConfig
from app.ui.components import Card, FormEntry, FormDropdown, PrimaryButton, Badge, ToastNotification

class SettingsView(ctk.CTkScrollableFrame):
    def __init__(
        self,
        master,
        on_notify: Optional[Callable[[str, str], None]] = None,
        on_theme_changed: Optional[Callable[[], None]] = None,
        on_lang_changed: Optional[Callable[[], None]] = None,
        **kwargs
    ):
        super().__init__(master, fg_color="transparent", corner_radius=0, **kwargs)
        self.on_notify = on_notify
        self.on_theme_changed = on_theme_changed
        self.on_lang_changed = on_lang_changed

        self.grid_columnconfigure(0, weight=1)
        self._build_ui()

    def _build_ui(self):
        # 1. Teacher Profile Section
        p_card = Card(self)
        p_card.pack(fill="x", padx=24, pady=(16, 12))
        p_card.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkLabel(
            p_card,
            text=f"👤 {t('section_teacher_profile')}",
            font=Theme.title_font(15),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).grid(row=0, column=0, columnspan=2, padx=16, pady=(16, 4), sticky="w")

        ctk.CTkLabel(
            p_card,
            text="يتم تضمين هذه البيانات تلقائياً في ترويسة أوراق الامتحانات وبابل شيت.",
            font=Theme.body_font(11),
            text_color=Theme.TEXT_SECONDARY,
            anchor="w"
        ).grid(row=1, column=0, columnspan=2, padx=16, pady=(0, 14), sticky="w")

        self.name_entry = FormEntry(p_card, label=t("field_teacher_name"), initial_value=TeacherProfile.NAME_AR)
        self.name_entry.grid(row=2, column=0, padx=16, pady=(0, 10), sticky="ew")

        self.title_entry = FormEntry(p_card, label=t("field_teacher_title"), initial_value=TeacherProfile.TITLE_AR)
        self.title_entry.grid(row=2, column=1, padx=16, pady=(0, 10), sticky="ew")

        self.center_entry = FormEntry(p_card, label=t("field_center_name"), initial_value=TeacherProfile.CENTER_AR)
        self.center_entry.grid(row=3, column=0, padx=16, pady=(0, 10), sticky="ew")

        self.phone_entry = FormEntry(p_card, label=t("field_phone"), initial_value=TeacherProfile.PHONE)
        self.phone_entry.grid(row=3, column=1, padx=16, pady=(0, 10), sticky="ew")

        self.email_entry = FormEntry(p_card, label=t("field_email"), initial_value=TeacherProfile.EMAIL)
        self.email_entry.grid(row=4, column=0, padx=16, pady=(0, 16), sticky="ew")

        # 2. Interface Preferences Section
        pref_card = Card(self)
        pref_card.pack(fill="x", padx=24, pady=(0, 12))
        pref_card.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkLabel(
            pref_card,
            text=f"⚙️ {t('section_preferences')}",
            font=Theme.title_font(15),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).grid(row=0, column=0, columnspan=2, padx=16, pady=(16, 12), sticky="w")

        # Language Dropdown
        self.lang_dd = FormDropdown(
            pref_card,
            label=t("pref_language"),
            values=["العربية (Arabic - RTL)", "English (LTR)"],
            default_value="العربية (Arabic - RTL)" if get_language() == "ar" else "English (LTR)"
        )
        self.lang_dd.grid(row=1, column=0, padx=16, pady=(0, 12), sticky="ew")

        # Theme Dropdown
        self.theme_dd = FormDropdown(
            pref_card,
            label=t("pref_theme"),
            values=[t("theme_light"), t("theme_dark"), t("theme_system")],
            default_value=t("theme_light")
        )
        self.theme_dd.grid(row=1, column=1, padx=16, pady=(0, 12), sticky="ew")

        # Notification switch
        self.notif_var = ctk.BooleanVar(value=True)
        cb = ctk.CTkCheckBox(
            pref_card,
            text=t("pref_notifications"),
            variable=self.notif_var,
            font=Theme.body_font(12),
            fg_color=Theme.PRIMARY[0]
        )
        cb.grid(row=2, column=0, columnspan=2, padx=16, pady=(0, 16), sticky="w")

        # 3. Protected License & Administration Section
        lic_card = Card(self)
        lic_card.pack(fill="x", padx=24, pady=(0, 16))

        l_inner = ctk.CTkFrame(lic_card, fg_color="transparent")
        l_inner.pack(fill="x", padx=16, pady=16)

        ctk.CTkLabel(
            l_inner,
            text=f"🛡️ {t('section_license_info')}",
            font=Theme.title_font(15),
            text_color=Theme.TEXT_PRIMARY,
            anchor="w"
        ).pack(fill="x", pady=(0, 8))

        b_row = ctk.CTkFrame(l_inner, fg_color="transparent")
        b_row.pack(fill="x", pady=(0, 8))

        Badge(b_row, text=f"الترخيص: {LicenseConfig.STATUS_AR}", bg_color="#ECFDF5", text_color="#065F46").pack(side="left", padx=(0, 6))
        Badge(b_row, text=LicenseConfig.TIER_AR, bg_color="#EFF6FF", text_color="#1E40AF").pack(side="left", padx=6)
        Badge(b_row, text=f"صالح حتى: {LicenseConfig.EXPIRATION_DATE}", bg_color="#F1F5F9", text_color="#475569").pack(side="left", padx=6)

        notice_box = ctk.CTkFrame(l_inner, fg_color=Theme.BG_CARD_ALT, corner_radius=Theme.CORNER_RADIUS_SM)
        notice_box.pack(fill="x", pady=8)
        
        ctk.CTkLabel(
            notice_box,
            text=f"🔒 {t('admin_locked_msg')}",
            font=Theme.body_font(12),
            text_color=Theme.TEXT_MUTED,
            wraplength=680,
            justify="right"
        ).pack(padx=12, pady=10, fill="x")

        # Save Button
        save_btn = PrimaryButton(
            self,
            text=f"💾 {t('btn_save_preferences')}",
            width=180,
            command=self._save_preferences
        )
        save_btn.pack(padx=24, pady=(0, 20), anchor="e")

    def _save_preferences(self):
        # Check theme change
        th_val = self.theme_dd.get()
        if t("theme_dark") in th_val:
            ctk.set_appearance_mode("dark")
        elif t("theme_light") in th_val:
            ctk.set_appearance_mode("light")
        else:
            ctk.set_appearance_mode("system")

        if self.on_notify:
            self.on_notify(t("msg_saved_success"), "success")
