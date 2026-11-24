@echo off
REM Publishes the SOP Book (/SOP): suggestions backend to Convex, then the site to Vercel.
REM Run this from the DolphinApps folder by double-clicking it.
cd /d "%~dp0"
setlocal

echo.
echo  [1/3] Updating the Convex backend (adds the SOP suggestions table)...
call bunx convex deploy -y || goto :fail

set FILES=publish-sop-book.bat .gitignore convex/schema.ts convex/sopSuggestions.ts convex/_generated/api.d.ts src/main.tsx src/components/navigation.tsx src/components/app-launcher.tsx src/pages/home.tsx src/lib/sop-book.ts src/pages/sop-book.tsx src/pages/sop-page.tsx src/pages/sop-suggestions.tsx src/components/sop-book src/sop-content sops

echo.
echo  [2/3] Committing the SOP Book...
git add -- %FILES% || goto :fail
git commit -m "Add the public SOP Book at /SOP with suggest-an-edit" -m "54 SOPs in 11 sections, readable without signing in. Signed-in team members can select text and leave suggestions; mentors review them at /SOP/suggestions and copy accepted ones for Claude. Source lives in sops/source and builds into src/sop-content." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01WEtP5mbGsvMEPLbiauPbPn" -- %FILES% || goto :fail

echo.
echo  [3/3] Pushing...
git push || goto :fail

echo.
echo  Done!  Give Vercel about 2 minutes to rebuild, then open
echo  https://apps.robotdolphins.org/SOP
echo.
pause
exit /b 0

:fail
echo.
echo  Something went wrong above. Nothing after that step ran.
echo  Copy the red text and send it to Claude.
pause
exit /b 1
