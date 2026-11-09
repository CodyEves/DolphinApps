@echo off
REM Publishes the read-only mentor interview schedule (/interviews/mentor). Double-click to run.
cd /d "%~dp0"
setlocal
set FILES=src/pages/interview-mentor-schedule.tsx src/pages/interviews.tsx src/main.tsx src/components/navigation.tsx publish-interview-mentor-view.bat
git add -- %FILES% || goto :fail
git commit -m "Interviews: read-only mentor schedule with full names and application links" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mWRBRM7bXJWVn7hur" -- %FILES%
git push || goto :fail
echo.
echo ==================================================
echo  Done!  Give Vercel about 2 minutes to rebuild.
echo  Mentor schedule: /interviews/mentor  (same mentor link key)
echo ==================================================
pause
exit /b 0
:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
