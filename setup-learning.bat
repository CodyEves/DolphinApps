@echo off
REM Publishes the new Learning tab. Double-click to run.
REM Safe to run again.
cd /d "%~dp0"
setlocal

echo.
echo === 1/2  Deploying the backend (Convex) ===
call bunx convex deploy -y || goto :fail

echo.
echo === 2/2  Publishing the website (git push to Vercel) ===
set FILES=README.md convex/_generated/api.d.ts convex/notifications.ts convex/schema.ts convex/learning.ts convex/lib/learningDomain.ts convex/lib/learningSeed.ts src/components/navigation.tsx src/components/notification-menu.tsx src/components/learning/learning-ui.tsx src/lib/role-access.ts src/main.tsx src/pages/admin.tsx src/pages/dashboard.tsx src/pages/learning-home.tsx src/pages/learning-manage.tsx src/pages/learning-signoffs.tsx src/pages/learning-skill.tsx src/pages/learning-team.tsx setup-learning.bat
git add -- %FILES% || goto :fail
git commit -m "Rebuild Learning tab around skills (self-check, quiz, mentor sign-off)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mTBTCS7mKxxBcXjbu" -- %FILES%
git push || goto :fail

echo.
echo ==================================================
echo  Done!  Give Vercel about 2 minutes to rebuild.
echo  Then open Learning and click "Load starter skills".
echo ==================================================
echo.
pause
exit /b 0

:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
