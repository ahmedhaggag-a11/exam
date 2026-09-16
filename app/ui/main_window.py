# ExamForge Main Window Application Shell
import customtkinter as ctk
from typing import Dict, Any, Optional
from app.config.settings import AppConfig, TeacherProfile
from app.config.theme import Theme
from app.config.i18n import t, is_rtl, set_language, get_language
from app.ui.components import Sidebar, Header, ToastNotification
from app.ui.dashboard.dashboard_view import DashboardView
from app.ui.create_exam.wizard_view import ExamWizardView
from app.ui.questions.question_bank_view import QuestionBankView
from app.ui.exams.exams_view import ExamsView
from app.ui.templates.templates_view import TemplatesView
from app.ui.sources.sources_view import SourcesView
from app.ui.settings.settings_view import SettingsView

class MainWindow(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Window Metadata
        self.title(AppConfig.APP_TITLE_AR if is_rtl() else AppConfig.APP_TITLE_EN)
        self.geometry("1280x820")
        self.minsize(1080, 700)

        # Set default appearance
        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")
        self.configure(fg_color=Theme.BG_ROOT)

        self.current_route = "dashboard"
        self.current_view_widget = None

        self._init_layout()
        self._setup_global_scroll()
        self.navigate_to("dashboard")

    def _init_layout(self):
        # Configure layout columns (RTL: Sidebar on right or left depending on mode)
        self.grid_rowconfigure(0, weight=1)
        
        # Sidebar placement
        # In Arabic RTL: sidebar on column 1, main area on column 0
        # In English LTR: sidebar on column 0, main area on column 1
        if is_rtl():
            self.grid_columnconfigure(0, weight=1) # Main Content
            self.grid_columnconfigure(1, weight=0) # Sidebar
            sidebar_col = 1
            content_col = 0
        else:
            self.grid_columnconfigure(0, weight=0) # Sidebar
            self.grid_columnconfigure(1, weight=1) # Main Content
            sidebar_col = 0
            content_col = 1

        self.sidebar = Sidebar(
            self,
            current_route=self.current_route,
            on_navigate=self.navigate_to
        )
        self.sidebar.grid(row=0, column=sidebar_col, sticky="nsew")

        # Main Content Container (Header + View)
        self.content_container = ctk.CTkFrame(self, fg_color="transparent", corner_radius=0)
        self.content_container.grid(row=0, column=content_col, sticky="nsew")
        self.content_container.grid_columnconfigure(0, weight=1)
        self.content_container.grid_rowconfigure(1, weight=1)

        # Header
        self.header = Header(
            self.content_container,
            title="لوحة التحكم",
            subtitle="نظرة عامة على الاختبارات وبنك الأسئلة",
            on_search=self._handle_global_search,
            on_theme_toggle=self.toggle_theme,
            on_notify_click=self._show_notifications_summary
        )
        self.header.grid(row=0, column=0, sticky="ew")

        # View Host Frame
        self.view_host = ctk.CTkFrame(self.content_container, fg_color="transparent", corner_radius=0)
        self.view_host.grid(row=1, column=0, sticky="nsew")
        self.view_host.grid_columnconfigure(0, weight=1)
        self.view_host.grid_rowconfigure(0, weight=1)

    def navigate_to(self, route: str):
        self.current_route = route
        self.sidebar.set_active_route(route)

        # Clear existing view
        for child in self.view_host.winfo_children():
            child.destroy()

        route_titles = {
            "dashboard": (t("nav_dashboard"), "نظرة عامة وإحصائيات الورقة الامتحانية وبنك الأسئلة"),
            "create_exam": (t("nav_create_exam"), "معالج إنشاء اختبار متوازن بنماذج متعددة"),
            "question_bank": (t("nav_question_bank"), "استعراض وتصفية وإدارة بنك الأسئلة المعتمد"),
            "exams": (t("nav_exams"), "سجل الاختبارات المنشأة والنماذج المجهزة للتصدير"),
            "templates": (t("nav_templates"), "قوالب الاختبارات المعتمدة المخصصة لعلامتك التعليمية"),
            "sources": (t("nav_sources"), "المصادر والمراجع التعليمية الرسمية المربوطة"),
            "settings": (t("nav_settings"), "تفضيلات العرض، بيانات المعلم، ومعلومات الترخيص")
        }
        title, subtitle = route_titles.get(route, ("ExamForge", ""))
        self.header.set_titles(title, subtitle)

        # Instantiate View
        if route == "dashboard":
            view = DashboardView(
                self.view_host,
                on_navigate=self.navigate_to,
                on_notify=self.show_toast
            )
        elif route == "create_exam":
            view = ExamWizardView(
                self.view_host,
                on_navigate=self.navigate_to,
                on_notify=self.show_toast
            )
        elif route == "question_bank":
            view = QuestionBankView(
                self.view_host,
                on_notify=self.show_toast
            )
        elif route == "exams":
            view = ExamsView(
                self.view_host,
                on_navigate=self.navigate_to,
                on_notify=self.show_toast
            )
        elif route == "templates":
            view = TemplatesView(
                self.view_host,
                on_notify=self.show_toast
            )
        elif route == "sources":
            view = SourcesView(
                self.view_host,
                on_notify=self.show_toast
            )
        elif route == "settings":
            view = SettingsView(
                self.view_host,
                on_notify=self.show_toast,
                on_theme_changed=self.toggle_theme
            )
        else:
            view = DashboardView(self.view_host, on_navigate=self.navigate_to, on_notify=self.show_toast)

        view.grid(row=0, column=0, sticky="nsew")
        self.current_view_widget = view

    def toggle_theme(self):
        current = ctk.get_appearance_mode()
        new_mode = "dark" if current.lower() == "light" else "light"
        ctk.set_appearance_mode(new_mode)
        self.show_toast(f"تم تغيير المظهر إلى الوضع {'الداكن' if new_mode == 'dark' else 'الفاتح'}", "info")

    def show_toast(self, message: str, toast_type: str = "success"):
        ToastNotification.show(self, message=message, toast_type=toast_type)

    def _handle_global_search(self, term: str):
        if term and self.current_route != "question_bank":
            self.navigate_to("question_bank")
            if hasattr(self.current_view_widget, "search_entry"):
                self.current_view_widget.search_entry.insert(0, term)
                self.current_view_widget.refresh()

    def _show_notifications_summary(self):
        self.show_toast("النظام متصل وقاعدة البيانات محدثة ولا توجد تنبيهات معلقة.", "info")

    def _setup_global_scroll(self):
        self.bind_all("<MouseWheel>", self._on_global_mousewheel, add="+")

    def _on_global_mousewheel(self, event):
        try:
            x, y = self.winfo_pointerx(), self.winfo_pointery()
            widget = self.winfo_containing(x, y)

            delta = event.delta
            if delta == 0:
                return

            step = -1 if delta > 0 else 1
            if abs(delta) >= 120:
                scroll_units = int(-1 * (delta / 120) * 3)
            else:
                scroll_units = step

            while widget:
                if hasattr(widget, "_parent_canvas"):
                    widget._parent_canvas.yview_scroll(scroll_units, "units")
                    break
                elif isinstance(widget, ctk.CTkScrollableFrame):
                    widget._parent_canvas.yview_scroll(scroll_units, "units")
                    break
                elif isinstance(widget, ctk.CTkCanvas):
                    widget.yview_scroll(scroll_units, "units")
                    break
                widget = getattr(widget, "master", None)
        except Exception:
            pass
