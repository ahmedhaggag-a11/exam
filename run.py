#!/usr/bin/env python3
"""
ExamForge Desktop Application Launcher
"""
import sys
import os

# Add root directory to python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.main import run_app

if __name__ == "__main__":
    run_app()
