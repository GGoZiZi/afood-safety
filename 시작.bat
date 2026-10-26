@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 에이푸드 위험성평가 관리 앱을 시작합니다...
if not exist node_modules (
  echo 처음 실행: 필요한 프로그램을 설치합니다. 몇 분 걸릴 수 있습니다.
  call npm install || goto :error
)
if not exist .next (
  echo 앱을 준비합니다...
  call npm run build || goto :error
)
echo.
echo 이 PC에서:      http://localhost:3000
echo 사내 다른 PC/휴대폰: http://(이 PC의 IP주소):3000
echo 이 창을 닫으면 앱이 꺼집니다.
echo.
call npm run start
goto :eof
:error
echo 오류가 났습니다. 위 메시지를 캡처해서 보내주세요.
pause
