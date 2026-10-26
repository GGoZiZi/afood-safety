@echo off
chcp 65001 > nul
cd /d "%~dp0"
set STAMP=%date:~0,4%%date:~5,2%%date:~8,2%
if not exist backup mkdir backup
copy /Y data\afood.db "backup\afood_%STAMP%.db" > nul && echo backup\afood_%STAMP%.db 에 백업했습니다.
pause
