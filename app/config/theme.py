# ExamForge Modern Design System Tokens & Theme
from typing import Tuple

class Theme:
    # Mode
    current_mode = "light"  # "light" or "dark"

    # Core Brand Palette (Tuple: (Light, Dark))
    PRIMARY = ("#2563EB", "#3B82F6")           # Vibrant Royal Blue
    PRIMARY_HOVER = ("#1D4ED8", "#2563EB")     # Deep Blue
    PRIMARY_LIGHT = ("#EFF6FF", "#1E293B")     # Soft Tint
    PRIMARY_TEXT = ("#1E40AF", "#93C5FD")

    SECONDARY = ("#0D9488", "#14B8A6")         # Emerald Teal
    SECONDARY_HOVER = ("#0F766E", "#0D9488")
    SECONDARY_LIGHT = ("#F0FDFA", "#134E4A")

    ACCENT = ("#7C3AED", "#8B5CF6")            # Modern Purple
    ACCENT_LIGHT = ("#F5F3FF", "#2E1065")

    # Status Colors
    SUCCESS = ("#10B981", "#34D399")
    SUCCESS_LIGHT = ("#ECFDF5", "#064E3B")
    SUCCESS_TEXT = ("#065F46", "#A7F3D0")

    WARNING = ("#F59E0B", "#FBBF24")
    WARNING_LIGHT = ("#FFFBEB", "#78350F")
    WARNING_TEXT = ("#92400E", "#FDE68A")

    DANGER = ("#EF4444", "#F87171")
    DANGER_HOVER = ("#DC2626", "#EF4444")
    DANGER_LIGHT = ("#FEF2F2", "#7F1D1D")
    DANGER_TEXT = ("#991B1B", "#FECACA")

    INFO = ("#0284C7", "#38BDF8")
    INFO_LIGHT = ("#F0F9FF", "#0C4A6E")
    INFO_TEXT = ("#075985", "#BAE6FD")

    # Backgrounds & Surfaces
    BG_ROOT = ("#F8FAFC", "#0F172A")           # Slate 50 / Slate 900
    BG_SIDEBAR = ("#FFFFFF", "#1E293B")        # Pure White / Slate 800
    BG_HEADER = ("#FFFFFF", "#1E293B")
    BG_CARD = ("#FFFFFF", "#1E293B")
    BG_CARD_ALT = ("#F1F5F9", "#334155")
    BG_INPUT = ("#FFFFFF", "#0F172A")
    BG_HOVER = ("#F1F5F9", "#334155")
    BG_ACTIVE = ("#E2E8F0", "#475569")
    BG_PAPER = ("#FFFFFF", "#1E293B")

    # Borders & Dividers
    BORDER = ("#E2E8F0", "#334155")            # Slate 200 / Slate 700
    BORDER_LIGHT = ("#F1F5F9", "#1E293B")
    BORDER_FOCUS = ("#3B82F6", "#60A5FA")

    # Typography Colors
    TEXT_PRIMARY = ("#0F172A", "#F8FAFC")      # Slate 900 / Slate 50
    TEXT_SECONDARY = ("#475569", "#94A3B8")    # Slate 600 / Slate 400
    TEXT_MUTED = ("#94A3B8", "#64748B")        # Slate 400 / Slate 500
    TEXT_WHITE = "#FFFFFF"

    # Visual Layout Metrics
    CORNER_RADIUS_SM = 6
    CORNER_RADIUS_MD = 10
    CORNER_RADIUS_LG = 14
    CORNER_RADIUS_XL = 20
    CORNER_RADIUS_PILL = 999

    SIDEBAR_WIDTH = 260
    HEADER_HEIGHT = 70

    # Fonts
    FONT_FAMILY = "Segoe UI"
    FONT_FAMILY_AR = "Segoe UI"

    @classmethod
    def get_font(cls, size: int = 13, weight: str = "normal") -> Tuple[str, int, str]:
        return (cls.FONT_FAMILY, size, weight)

    @classmethod
    def title_font(cls, size: int = 20) -> Tuple[str, int, str]:
        return (cls.FONT_FAMILY, size, "bold")

    @classmethod
    def subtitle_font(cls, size: int = 15) -> Tuple[str, int, str]:
        return (cls.FONT_FAMILY, size, "bold")

    @classmethod
    def body_font(cls, size: int = 13) -> Tuple[str, int, str]:
        return (cls.FONT_FAMILY, size, "normal")

    @classmethod
    def bold_font(cls, size: int = 13) -> Tuple[str, int, str]:
        return (cls.FONT_FAMILY, size, "bold")

    @classmethod
    def small_font(cls, size: int = 11) -> Tuple[str, int, str]:
        return (cls.FONT_FAMILY, size, "normal")

    @classmethod
    def mono_font(cls, size: int = 12) -> Tuple[str, int, str]:
        return ("Consolas", size, "normal")
