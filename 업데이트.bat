@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 최신 버전을 받습니다...
git pull || goto :error
call npm install || goto :error
call npm run build || goto :error
echo 업데이트 완료. 시작.bat 으로 다시 켜세요.
pause
goto :eof
:error
echo 오류가 났습니다. 위 메시지를 캡처해서 보내주세요.
pause
