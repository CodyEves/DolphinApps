@echo off
REM Publishes the Dolphin Apps home page and sidebar refresh. Double-click to run.
cd /d "%~dp0"
setlocal

echo.
echo === Publishing the website (git push to Vercel) ===
set FILES=src/index.css src/components/team-plate.tsx src/pages/home.tsx src/components/navigation.tsx src/routes/root-layout.tsx src/components/app-launcher.tsx src/components/theme-mode-toggle.tsx publish-home-refresh.bat
git add -- %FILES% || goto :fail
git commit -m "Home page and sidebar refresh: team plate, Right now panel, grouped mentor tools" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mJ2nxwseurnbbRLXq" -- %FILES%
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
