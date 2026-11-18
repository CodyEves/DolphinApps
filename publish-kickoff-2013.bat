@echo off
REM Publishes the 2013 ULTIMATE ASCENT mock kickoff page (cheat sheet, quiz saving, drive-time simulator). Double-click to run.
cd /d "%~dp0"
setlocal

echo.
echo === 1/2  Checking the build ===
call bun run build || goto :fail

echo.
echo === 2/2  Publishing the website (git push to Vercel) ===
set FILES=src/pages/kickoff-2013.tsx src/components/learning/field-2013.tsx src/components/learning/drive-sim-2013.tsx src/components/learning/swerve-options.ts publish-kickoff-2013.bat
git add -- %FILES% || goto :fail
git commit -m "Kickoff 2013: drive-time simulator with swerve module picker, quiz score saving, phone layout" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5o8qwhgfsjqfDReK4m" -- %FILES% || goto :fail
git push || goto :fail

echo.
echo ==================================================
echo  Done!  Give Vercel about 2 minutes to rebuild.
echo  Page: https://apps.robotdolphins.org/training/kickoff/2013#drive
echo ==================================================
echo.
pause
exit /b 0

:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
