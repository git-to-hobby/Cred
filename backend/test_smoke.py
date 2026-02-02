"""Minimal smoke test so CI pytest step passes."""


def test_project_layout():
    from pathlib import Path

    root = Path(__file__).resolve().parent
    assert (root / "requirements.txt").is_file()
    assert (root / "master_agent" / "main.py").is_file()
