@echo off
REM Publishes the Slack branding (banner + wording) and three small website fixes. Double-click to run.
cd /d "%~dp0"
setlocal

echo.
echo === 1/2  Deploying the backend (Convex) so Slack shows the new Home tab ===
call bunx convex deploy -y || goto :fail

echo.
echo === 2/2  Publishing the website (git push to Vercel) ===
set FILES=convex/slackHome.ts convex/batterySlack.ts slack/manifest.json public/slack/home-banner.png src/pages/parts-app.tsx src/pages/profile.tsx src/components/ui/tabs.tsx publish-slack-brand.bat
git add -- %FILES% || goto :fail
git commit -m "Slack Home tab branding (banner, team-blue app color) and small UI fixes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mJ2nxwseurnbbRLXq" -- %FILES%
git push || goto :fail

echo.
echo ==================================================
echo  Done!  Give Vercel about 2 minutes, then reopen
echo  the Dolphin Apps Home tab in Slack.
echo ==================================================
echo.
pause
exit /b 0

:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
