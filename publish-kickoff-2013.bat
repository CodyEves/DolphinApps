@echo off
REM Publishes the 2013 ULTIMATE ASCENT mock kickoff page and its rules-quiz skill. Double-click to run.
cd /d "%~dp0"
setlocal

echo.
echo === 1/3  Checking the build ===
call bun run build || goto :fail

echo.
echo === 2/3  Deploying the backend (Convex) ===
call bunx convex deploy -y || goto :fail

echo.
echo === 3/3  Publishing the website (git push to Vercel) ===
set FILES=src/pages/kickoff-2013.tsx src/main.tsx convex/lib/kickoff2013.ts convex/lib/learningSeed.ts publish-kickoff-2013.bat
git add -- %FILES% || goto :fail
git commit -m "Add 2013 Ultimate Ascent mock kickoff cheat sheet and rules quiz skill" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5o8qwhgfsjqfDReK4m" -- %FILES% || goto :fail
git push || goto :fail

echo.
echo ==================================================
echo  Done!  Give Vercel about 2 minutes to rebuild.
echo  Page: https://apps.robotdolphins.org/training/kickoff/2013
echo.
echo  To turn on score saving: open Learning, Manage, and click
echo  Load starter skills once.
echo ==================================================
echo.
pause
exit /b 0

:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
