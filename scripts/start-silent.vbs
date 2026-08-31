' Project Architect Silent Launcher (Zero Console Windows)
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strProjectDir = objFSO.GetParentFolderName(strScriptDir)

' Ensure runtime\logs directory exists
strRuntimeDir = strProjectDir & "\runtime"
strLogsDir = strProjectDir & "\runtime\logs"
If Not objFSO.FolderExists(strRuntimeDir) Then objFSO.CreateFolder(strRuntimeDir)
If Not objFSO.FolderExists(strLogsDir) Then objFSO.CreateFolder(strLogsDir)

' Change working directory to project root
objShell.CurrentDirectory = strProjectDir

' 1. Start Backend REST API Server (Port 3001)
objShell.Run "cmd /c node apps\server\dist\index.js > """ & strLogsDir & "\server.log"" 2>&1", 0, False

' 2. Start Frontend Web Server (Port 5174)
objShell.Run "cmd /c node apps\web\node_modules\vite\bin\vite.js apps\web --host 127.0.0.1 --port 5174 > """ & strLogsDir & "\web.log"" 2>&1", 0, False

' 3. Wait for services to initialize and open default browser
WScript.Sleep 3000
objShell.Run "http://localhost:5174"
