# ExamForge Application Entrypoint
import sys
from app.database.connection import init_db
from app.ui.main_window import MainWindow

def run_app():
    # Set Windows High-DPI Awareness for smooth rendering
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(2)  # Per-monitor DPI aware
        except Exception:
            try:
                import ctypes
                ctypes.windll.shcore.SetProcessDpiAwareness(1)
            except Exception:
                pass

    # 1. Initialize Database Schema & Seed Data
    init_db()

    # 2. Launch Main CustomTkinter Application
    app = MainWindow()
    app.mainloop()

if __name__ == "__main__":
    run_app()
