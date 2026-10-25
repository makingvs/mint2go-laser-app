@echo off
chcp 65001 >nul
rem Legt eine Verknüpfung im Autostart-Ordner von Windows an,
rem damit der Server nach der Anmeldung automatisch (minimiert) startet.
set "TARGET=%~dp0start.bat"
set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Laser-Zeichen-App.lnk"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LINK%'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
if exist "%LINK%" (
  echo Fertig. Der Server startet jetzt automatisch nach der Anmeldung.
) else (
  echo Das hat nicht geklappt.
)
echo Zum Entfernen die Datei "Laser-Zeichen-App" im Ordner shell:startup loeschen.
pause
