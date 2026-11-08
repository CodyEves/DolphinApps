@echo off
REM Publishes three more interactive lessons. Double-click to run.
cd /d "%~dp0"
setlocal

echo.
echo === 1/2  Deploying the backend (Convex) ===
call bunx convex deploy -y || goto :fail

echo.
echo === 2/2  Publishing the website (git push to Vercel) ===
set FILES=convex/lib/learningSeed.ts src/components/learning/lesson-shell.tsx src/pages/learning-skill.tsx src/pages/lesson-motor-ratio.tsx src/pages/lesson-read-lights.tsx src/pages/lesson-prototyping.tsx src/pages/lesson-game-breakdown.tsx src/main.tsx publish-more-lessons.bat
git add -- %FILES% || goto :fail
git commit -m "Add interactive lessons: Read the lights, Prototype like a scientist, Break down a game" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mTBTCS7mKxxBcXjbu" -- %FILES%
git push || goto :fail

echo.
echo ==================================================
echo  Done!  Give Vercel about 2 minutes to rebuild.
echo ==================================================
echo.
pause
exit /b 0

:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
