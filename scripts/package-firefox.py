from pathlib import Path
import json
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SOURCE = DIST / "firefox"
ARTIFACTS = DIST / "firefox-artifacts"

subprocess.run(
    ["node", str(ROOT / "scripts" / "prepare-firefox.mjs")],
    cwd=ROOT,
    check=True,
)

manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]

ARTIFACTS.mkdir(parents=True, exist_ok=True)
output = ARTIFACTS / f"CurioGems-Firefox-v{version}.zip"
if output.exists():
    output.unlink()

with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(SOURCE.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(SOURCE))

with zipfile.ZipFile(output, "r") as archive:
    names = set(archive.namelist())
    if "manifest.json" not in names:
        raise RuntimeError("Firefox package is missing manifest.json at the ZIP root.")
    if any(name.startswith("firefox/") for name in names):
        raise RuntimeError("Firefox package contains an extra top-level directory.")

print(f"Created Firefox package: {output}")
