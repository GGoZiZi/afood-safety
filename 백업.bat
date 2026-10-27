@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 백업합니다. 앱이 켜져 있어도 괜찮습니다.
node scripts\backup.mjs backup || echo 오류가 났습니다. 위 메시지를 캡처해서 보내주세요.
echo.
echo backup 폴더를 USB나 공유폴더에도 복사해 두세요.
pause
