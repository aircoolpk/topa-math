# Windows Frontend Validation Guide

## Why Stop Dev Server First
On Windows, the Next.js dev server can keep files open under `.next` while it compiles routes on demand. Running `npm run lint` or `npm run build` at the same time can read a half-mutated `.next` tree or fail to write `.next\trace`.

Observed failures:
- `npm run lint` reported missing `.next/types/**/*.ts` files.
- `npm run build` failed with `EPERM: operation not permitted, open '.next\trace'`.
- The same lint/build commands passed after stopping the dev server.

## Safe Validation Command
From the project root:

```powershell
cd "D:\web app\4-craft.com"
powershell -ExecutionPolicy Bypass -File ".\scripts\validate-web.ps1"
```

If port 3000 is busy, the script stops and prints the process IDs. Stop the dev server manually, or run:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\validate-web.ps1" -ForceStopPort3000
```

Use `-ForceStopPort3000` only when you are sure the port 3000 process is the local Next.js dev server you want to stop.

## What The Script Does
The script:
- Checks whether anything is listening on port 3000.
- Shows the owning process and command line.
- Stops port 3000 only when `-ForceStopPort3000` is passed.
- Uses portable Node 20 when available at `D:\web app\4-craft.com\.tools\node-v20.20.2-win-x64`.
- Changes directory to `D:\web app\4-craft.com\apps\web`.
- Removes `.next`.
- Runs `npm run lint`.
- Runs `npm run build`.
- Prints a PASS/FAIL summary.

## Node 20 Portable Runtime
The expected runtime is:

```powershell
D:\web app\4-craft.com\.tools\node-v20.20.2-win-x64
```

The validation script prepends that directory to `PATH` automatically when `node.exe` and `npm.cmd` are present.

Manual check:

```powershell
$env:PATH = "D:\web app\4-craft.com\.tools\node-v20.20.2-win-x64;$env:PATH"
node -v
npm -v
```

Expected:

```text
v20.20.2
10.8.2
```

## Restart Dev Server After Validation
After validation passes:

```powershell
cd "D:\web app\4-craft.com\apps\web"
$env:PATH = "D:\web app\4-craft.com\.tools\node-v20.20.2-win-x64;$env:PATH"
npm run dev
```

Then open:

```text
http://127.0.0.1:3000
```

## What Not To Do
- Do not run `npm run build` while `npm run dev` is active on port 3000.
- Do not run `npm run lint` while `.next` is being generated or mutated by dev/build.
- Do not use system Node 24 for this Next.js 14 app unless you are specifically testing Node 24 compatibility.
- Do not manually delete random files inside `.next` while the dev server is running.
- Do not force-kill port 3000 without checking the process first.

## Manual Fallback
If you do not use the script:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F

cd "D:\web app\4-craft.com\apps\web"
$env:PATH = "D:\web app\4-craft.com\.tools\node-v20.20.2-win-x64;$env:PATH"
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run lint
npm run build
```
