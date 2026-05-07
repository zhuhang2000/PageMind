Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
bridgeDir = root & "\bridge"
logFile = bridgeDir & "\bridge.log"

shell.CurrentDirectory = bridgeDir
shell.Run "cmd /c echo.>> """ & logFile & """ & echo ==================================================>> """ & logFile & """ & echo Bridge start: %date% %time%>> """ & logFile & """ & node server.js >> """ & logFile & """ 2>>&1", 0, False
