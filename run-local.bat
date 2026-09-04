@echo off
setlocal

REM ===========================================================================
REM  Vindeshi Express - run the site locally, with real content
REM ===========================================================================
REM
REM  WHY THIS EXISTS
REM
REM  The Vercel deployment shows almost nothing, and that is by design, not a
REM  fault: production has NO route content. Phase 5 decided routes are
REM  researched and reviewed before they are seeded, so production is empty and
REM  the landing page, search and sign-in are the only pages with anything to
REM  show. Everything else - the Road, a step, My Journey, Changes, the shadow
REM  comparison - needs a route to exist.
REM
REM  The Neon "test" branch has ~359 routes on it from integration runs. This
REM  script points a local dev server at that branch so the whole product is
REM  visible and reviewable.
REM
REM  IT NEVER TOUCHES PRODUCTION. It reads .env.test.local only.
REM ===========================================================================

cd /d "%~dp0"

echo.
echo  ============================================================
echo   Vindeshi Express - local run against the TEST database
echo  ============================================================
echo.

if not exist ".env.test.local" (
  echo  [X] .env.test.local not found.
  echo.
  echo      This file holds the connection string for the Neon "test" branch.
  echo      It is gitignored, so it only exists on a machine that has been
  echo      set up. Run "neon link" or copy it from your other machine.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  [1/4] Installing dependencies ^(first run only^)...
  call npm ci
  if errorlevel 1 goto :failed
) else (
  echo  [1/4] Dependencies present.
)

echo.
echo  [2/4] Waking the Neon compute...
echo        Neon scales to zero; a cold branch takes 25-30 seconds to accept
echo        connections. This is normal and only happens on the first run.
call npx dotenv -e .env.test.local -- node scripts/db/wake.mjs --unpooled
if errorlevel 1 goto :dbfailed

echo.
echo  [3/4] Applying any pending migrations to the TEST branch...
echo        The test branch is currently one migration behind (Phase 11).
echo        Without this the route pages fail with:
echo          "The column routes.mergedAt does not exist"
echo        This is the same additive migration you will later apply to
echo        production. It creates two tables and three nullable columns.
echo.
call npx dotenv -e .env.test.local -- npx prisma migrate deploy
if errorlevel 1 goto :failed

echo.
call npx dotenv -e .env.test.local -- npx prisma migrate status

echo.
echo  [4/4] Starting the dev server...
echo.
echo   ------------------------------------------------------------
echo    Open these once it says "Ready":
echo.
echo      Landing            http://localhost:3000/en
echo      Search / ribbons   http://localhost:3000/en/routes
echo      Create a route     http://localhost:3000/en/routes/new
echo      Sign in            http://localhost:3000/en/signin
echo.
echo    Then open any route from the search results to reach the
echo    Road, a step, My Journey, Changes and History.
echo.
echo    Press Ctrl+C in this window to stop the server.
echo   ------------------------------------------------------------
echo.

call npx dotenv -e .env.test.local -- npm run dev
goto :eof

:dbfailed
echo.
echo  [X] Could not reach the database.
echo.
echo      Neon computes sleep, and the first connect after a long idle can
echo      time out even though nothing is wrong. Try running this script
echo      again - it usually connects on the second attempt.
echo.
pause
exit /b 1

:failed
echo.
echo  [X] A step failed. The message above says which.
echo.
pause
exit /b 1
