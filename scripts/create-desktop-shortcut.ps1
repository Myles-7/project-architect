# Project Architect - Desktop Shortcut Generator
# Creates "Project Architect.lnk" on user's Windows Desktop

$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$DesktopFolder = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = "$DesktopFolder\Project Architect.lnk"
$TargetVBS = "$ProjectRoot\scripts\start-silent.vbs"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$Shortcut.Arguments = "`"$TargetVBS`""
$Shortcut.WorkingDirectory = "$ProjectRoot"
$Shortcut.Description = "Project Architect — 本地 AI 项目构思工作台"
$Shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$Shortcut.Save()

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " [OK] Desktop Shortcut successfully created at:" -ForegroundColor Green
Write-Host "      $ShortcutPath" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
