@echo off
chcp 65001 >nul
title WLAN-Zugriff fuer die Laser-Zeichen-App einrichten
setlocal

rem Dieses Skript einmalig am Laser-PC ausfuehren. Es oeffnet in der Windows-Firewall den Port
rem der App - nur fuer Geraete im selben Netz (WLAN/LAN), nicht fuer das Internet.

net session >nul 2>&1
if errorlevel 1 (
  echo Es werden Administratorrechte benoetigt.
  echo Bitte im folgenden Fenster mit "Ja" bestaetigen.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set PORT=3000

netsh advfirewall firewall delete rule name="Laser-Zeichen-App" >nul 2>&1
netsh advfirewall firewall add rule name="Laser-Zeichen-App" dir=in action=allow protocol=TCP localport=%PORT% remoteip=localsubnet profile=any >nul
if errorlevel 1 (
  echo Die Firewall-Regel konnte nicht angelegt werden.
  pause
  exit /b 1
)

echo.
echo Fertig: Die Firewall erlaubt jetzt Zugriffe auf Port %PORT% aus dem eigenen Netz.
echo.
echo Adressen dieses PCs:
powershell -NoProfile -Command "Get-NetIPConfiguration | Where-Object { $_.IPv4Address -and $_.IPv4Address.IPAddress -notmatch '^(169\.254|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.)' } | ForEach-Object { '  http://' + $_.IPv4Address.IPAddress + ':%PORT%   (' + $_.InterfaceAlias + ')' }"
echo   oder per Name: http://%COMPUTERNAME%.local:%PORT%
echo.
echo Wichtig:
echo  1. iPad und PC muessen im selben WLAN sein (nicht im Gast-WLAN).
echo  2. Damit sich die Adresse nicht aendert, im Router fuer diesen PC
echo     "immer dieselbe IP-Adresse" vergeben (bei der FRITZ!Box: Heimnetz ^> Netzwerk ^>
echo     Geraet ^> Bearbeiten ^> "Diesem Netzwerkgeraet immer die gleiche IPv4-Adresse zuweisen").
echo  3. Die Energiesparfunktion des PCs (Standby) ausschalten, solange die App genutzt wird.
echo.
pause
