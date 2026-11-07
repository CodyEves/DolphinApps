@echo off
REM One-time setup for the Battery tracker. Double-click to run.
REM Safe to run again: it won't duplicate batteries or the PIN.
cd /d "%~dp0"
setlocal
set PIN=934608

echo.
echo === 1/4  Deploying the backend (Convex) ===
call bunx convex deploy -y || goto :fail

echo.
echo === 2/4  Setting the pit PIN ===
call bunx convex env set BATTERY_PIN %PIN% --prod || goto :fail

echo.
echo === 3/4  Creating Comp 1-8 and Practice 1-4 ===
call bunx convex run batteries:seedFleet "{}" --prod || goto :fail

echo.
echo === 4/4  Publishing the website (git push to Vercel) ===
set FILES=README.md convex/_generated/api.d.ts convex/batteries.ts convex/batterySlack.ts convex/http.ts convex/lib/batteryDomain.ts convex/schema.ts convex/slackEvents.ts convex/slackHome.ts slack/README.md slack/manifest.json src/components/app-launcher.tsx src/components/navigation.tsx src/main.tsx src/pages/batteries.tsx src/pages/home.tsx src/routes/root-layout.tsx
git add -- %FILES% || goto :fail
git commit -m "Add battery tracking (web + /battery in Slack)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5keKAJY39HnVHNwpvd" -- %FILES%
git push || goto :fail

echo.
echo ==================================================
echo  Done!  Pit PIN for the website: %PIN%
echo  Battery page: /batteries on your Dolphin Apps site
echo ==================================================
echo.
pause
exit /b 0

:fail
echo.
echo Something went wrong above. Copy the red text and send it to Claude.
pause
exit /b 1
