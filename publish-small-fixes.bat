@echo off
REM Publishes two small fixes: mobile title no longer repeats, home battery note. Double-click to run.
cd /d "%~dp0"
setlocal
set FILES=src/components/navigation.tsx src/pages/home.tsx publish-small-fixes.bat
git add -- %FILES% || goto :fail
git commit -m "Small fixes: single mobile title when page matches app, battery no-reading note on home" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mJ2nxwseurnbbRLXq" -- %FILES%
git push || goto :fail
echo.
echo  Done!  Give Vercel about 2 minutes to rebuild.
pause
exit /b 0
:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
