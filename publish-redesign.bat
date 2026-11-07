@echo off
REM Publishes the Dolphin Apps design refresh. Double-click to run.
cd /d "%~dp0"
setlocal

echo.
echo === Publishing the website (git push to Vercel) ===
set FILES=index.html src/components/app-launcher.tsx src/components/confirm-delete-dialog.tsx src/components/mission-graphic.tsx src/components/navigation.tsx src/components/notification-menu.tsx src/components/page-heading.tsx src/components/sop-view.tsx src/components/ui/badge.tsx src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/dropdown-menu.tsx src/components/ui/input.tsx src/components/ui/select.tsx src/components/ui/skeleton.tsx src/components/ui/tabs.tsx src/components/ui/textarea.tsx src/components/user-menu.tsx src/index.css src/lib/role-access.ts src/main.tsx src/pages/admin-badges.tsx src/pages/admin-lms.tsx src/pages/admin-people.tsx src/pages/admin.tsx src/pages/auth.tsx src/pages/badge-awards.tsx src/pages/badge-editor.tsx src/pages/badges.tsx src/pages/batteries.tsx src/pages/dashboard.tsx src/pages/equipment-detail.tsx src/pages/home.tsx src/pages/learning-home.tsx src/pages/learning-manage.tsx src/pages/learning-signoffs.tsx src/pages/learning-skill.tsx src/pages/learning-team.tsx src/pages/learning-track-editor.tsx src/pages/management-placeholder.tsx src/pages/parts-app.tsx src/pages/profile.tsx src/pages/reviews.tsx src/pages/shop-attendance.tsx src/pages/sop-editor.tsx src/pages/tool-readers.tsx src/pages/tool-sign-offs.tsx src/pages/tools.tsx src/routes/root-layout.tsx  publish-redesign.bat
git add -- %FILES% || goto :fail
git commit -m "Design refresh: shared design system, clearer headlines, loading states, CTA accent" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mTBTCS7mKxxBcXjbu" -- %FILES%
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
