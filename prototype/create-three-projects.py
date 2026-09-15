"""Create disposable Remote-SSH fixtures without replacing existing files."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent / "results" / "three-projects"
for name in ("shared", "third"):
    folder = root / name
    folder.mkdir(parents=True, exist_ok=True)
    document = folder / "README.md"
    if not document.exists():
        document.write_text(f"# FSP prototype: {name}\n", encoding="utf-8")
for name in "ABC":
    workspace = root / f"FSP-{name}.code-workspace"
    if not workspace.exists():
        workspace.write_text(json.dumps({
            "folders": [{"path": "third" if name == "C" else "shared"}],
            "settings": {"window.title": f"FSP-{name} Prototype"},
        }, indent=2) + "\n", encoding="utf-8")
    print(workspace)
