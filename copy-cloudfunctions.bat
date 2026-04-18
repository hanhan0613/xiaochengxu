@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   复制云函数到编译目录
echo ========================================
echo.

set "SRC=%~dp0cloudfunctions"
set "DEST=%~dp0unpackage\dist\dev\mp-weixin\cloudfunctions"

if not exist "%SRC%" (
    echo [错误] 源目录不存在: %SRC%
    pause
    exit /b 1
)

if not exist "%~dp0unpackage\dist\dev\mp-weixin" (
    echo [错误] 编译目录不存在，请先在HBuilderX中编译项目
    pause
    exit /b 1
)

:: 复制云函数文件夹
xcopy "%SRC%" "%DEST%" /E /I /Y /Q >nul

:: 确保 project.config.json 有 cloudfunctionRoot
set "CONFIG=%~dp0unpackage\dist\dev\mp-weixin\project.config.json"

:: 检查是否已有 cloudfunctionRoot
findstr /C:"cloudfunctionRoot" "%CONFIG%" >nul 2>&1
if errorlevel 1 (
    echo [信息] 正在更新 project.config.json...
    powershell -Command "(Get-Content '%CONFIG%' -Encoding UTF8) -replace '\"editorSetting\"', '\"cloudfunctionRoot\": \"cloudfunctions/\",\"cloud\": true,\"editorSetting\"' | Set-Content '%CONFIG%' -Encoding UTF8"
)

echo.
echo [完成] 云函数已复制到编译目录！
echo [提示] 在微信开发者工具中重新打开项目即可看到云函数
echo.
pause
