@echo off
REM Publishes the interview board update (students free on the selected day sort first). Double-click to run.
cd /d "%~dp0"
setlocal
set FILES=src/pages/interviews.tsx publish-interview-sort.bat
git add -- %FILES% || goto :fail
git commit -m "Interviews: sort students free on the selected day to the top" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mWRBRM7bXJWVn7hur" -- %FILES%
git push || goto :fail
echo.
echo ==================================================
echo  Done!  Give Vercel about 2 minutes to rebuild.
echo ==================================================
pause
exit /b 0
:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
