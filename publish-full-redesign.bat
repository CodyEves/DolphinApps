@echo off
REM Publishes the full Dolphin Apps redesign (new colors, fonts, blue top bar, every shared component). Double-click to run.
REM Safe to run even if you skipped earlier publish scripts.
cd /d "%~dp0"
setlocal

echo.
echo === Publishing the website (git push to Vercel) ===
set FILES=index.html src/index.css src/routes/root-layout.tsx src/components/navigation.tsx src/components/page-heading.tsx src/components/theme-mode-toggle.tsx src/components/team-plate.tsx src/components/user-menu.tsx src/components/app-launcher.tsx src/components/learning/lesson-shell.tsx src/pages/interview-schedule.tsx src/pages/home.tsx src/pages/parts-app.tsx src/pages/auth.tsx src/pages/learning-home.tsx src/pages/batteries.tsx src/pages/admin.tsx src/pages/shop-attendance.tsx src/pages/interview-mentor-schedule.tsx src/components/ui/tooltip.tsx src/components/ui/button.tsx src/components/ui/progress.tsx src/components/ui/textarea.tsx src/components/ui/dropdown-menu.tsx src/components/ui/tabs.tsx src/components/ui/checkbox.tsx src/components/ui/badge.tsx src/components/ui/sheet.tsx src/components/ui/sonner.tsx src/components/ui/input.tsx src/components/ui/card.tsx src/components/ui/select.tsx  publish-full-redesign.bat publish-home-refresh.bat publish-inner-pages.bat publish-small-fixes.bat
git add -- %FILES% || goto :fail
git commit -m "Full redesign: robotdolphins.org colors, Poppins + Figtree, blue app bar with page tabs, restyled components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mJ2nxwseurnbbRLXq" -- %FILES%
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
