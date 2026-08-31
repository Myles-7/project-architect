import os
import sys
import ctypes

def get_desktop_paths():
    paths = []
    # 1. User Desktop via CSIDL_DESKTOP (0x0000)
    buf = ctypes.create_unicode_buffer(260)
    ctypes.windll.shell32.SHGetFolderPathW(None, 0x0000, None, 0, buf)
    if buf.value:
        paths.append(buf.value)
    
    # 2. Hardcoded fallback paths
    hardcoded = [r"D:\桌面", os.path.expanduser(r"~\Desktop")]
    for p in hardcoded:
        if os.path.exists(p) and p not in paths:
            paths.append(p)
    return paths

desktop_dirs = get_desktop_paths()
print("Found Desktop directories:", desktop_dirs)

project_root = r"D:\桌面\项目构思"
ico_src = os.path.join(project_root, "assets", "app-icon.png")
ico_path = os.path.join(project_root, "assets", "app-icon-v3.ico")

# Ensure app-icon-v3.ico exists from the latest PNG
from PIL import Image
img = Image.open(ico_src)
sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
img.save(ico_path, format="ICO", sizes=sizes)

vbs_path = os.path.join(project_root, "scripts", "start-silent.vbs")

# VBScript script to create shortcut via WScript.Shell
for d in desktop_dirs:
    shortcut_path = os.path.join(d, "Project Architect.lnk")
    if os.path.exists(shortcut_path):
        try:
            os.remove(shortcut_path)
            print(f"Removed old shortcut at: {shortcut_path}")
        except Exception as e:
            print(f"Warning: could not delete {shortcut_path}: {e}")

    # Generate shortcut via PowerShell/WScript COM
    vbs_content = f'''
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "{shortcut_path}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "C:\\Windows\\System32\\wscript.exe"
oLink.Arguments = """{vbs_path}"""
oLink.WorkingDirectory = "{project_root}"
oLink.IconLocation = "{ico_path},0"
oLink.Description = "Project Architect — 本地 AI 项目构思工作台"
oLink.Save
'''
    temp_vbs = os.path.join(project_root, "temp_create.vbs")
    with open(temp_vbs, "w", encoding="utf-16") as f:
        f.write(vbs_content)
    
    os.system(f'cscript //nologo "{temp_vbs}"')
    if os.path.exists(temp_vbs):
        os.remove(temp_vbs)
    print(f"Successfully created shortcut at: {shortcut_path}")

# Force Windows Explorer Icon Cache Update
SHCNE_ASSOCCHANGED = 0x08000000
SHCNF_IDLIST = 0x0000
ctypes.windll.shell32.SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None)
print("SHChangeNotify called successfully! Icon cache refreshed.")
