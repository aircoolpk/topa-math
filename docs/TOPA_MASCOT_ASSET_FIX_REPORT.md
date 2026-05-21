# TOPA Mascot Asset Fix Report

Date: 2026-05-15

## Summary

Replaced the incorrect placeholder/generic TOPA mascot asset reference with the provided mascot image:

- New public image path: `/brand/topa-mascot.png`
- Source file: `apps/web/public/brand/topa-mascot.png`

No app logic, API calls, auth/register/login logic, quiz/test scoring logic, backend code, or Stripe code was changed.

## Files Changed

- `apps/web/src/components/brand/TopaBrand.tsx`
- `apps/web/public/topa-mascot.svg` removed

## Old Image Paths Replaced

- Replaced `/topa-mascot.svg`
- Removed the generated placeholder SVG file at `apps/web/public/topa-mascot.svg`
- Removed the generic fallback text mascot from `TopaMascot`

## New Image Path Used

The shared `TopaMascot` component now renders:

```tsx
src="/brand/topa-mascot.png"
```

Because the site uses this shared component, the provided mascot is used anywhere `TopaMascot` or `TopaBrandMark` appears.

## Mascot Usage Confirmed In Source

- Homepage hero section: `apps/web/src/app/page.tsx`
- Homepage navigation/footer brand mark: `apps/web/src/app/page.tsx`
- Register page mascot area: `apps/web/src/app/register/page.tsx`
- Login page mascot area: `apps/web/src/app/login/page.tsx`
- Dashboard brand/welcome/coming-soon areas: `apps/web/src/app/dashboard/page.tsx`
- Lessons Coming Soon cards: `apps/web/src/app/lessons/page.tsx`
- Child dashboard brand mark: `apps/web/src/app/children/[childId]/page.tsx`
- Billing/pricing brand marks where already using TOPA branding

## Pages Verified

Clean frontend validation was run on `http://localhost:3001` because `http://localhost:3000` was already held by an existing `node.exe` process that this session could not terminate.

Checked routes on the clean frontend instance:

- `/` returned `200`, mascot path present in rendered HTML
- `/register` returned `200`, mascot path present in rendered HTML
- `/login` returned `200`, mascot path present in rendered HTML
- `/dashboard` returned `200`, no HTTP 500
- `/lessons` returned `200`, no HTTP 500
- `/brand/topa-mascot.png` returned `200`

Asset integrity check:

- Served `/brand/topa-mascot.png` SHA256 matched the source file SHA256
- Confirmed no remaining source references to `/topa-mascot.svg` or `/topa-mascot.png`
- Confirmed no broken image source path from the shared mascot component

## Validation Notes

- `npm run lint` passed (`tsc --noEmit`)
- The in-app browser backend was unavailable in this session, so route checks were performed with local HTTP requests and source verification.
- `npm run build` was attempted but hit a stale `.next` chunk error while the old locked port-3000 Node process was still running. The clean dev server on port 3001 served the updated app successfully.

## Port 3000 Operational Note

Port 3000 was occupied by an existing `node.exe` process, PID `6664`, and returned HTTP 500 after the stale cache state. Attempts to stop that process from this session were denied by Windows.

Before closed Beta use on the standard URL, manually stop/restart that old frontend process and start the frontend again on port 3000.

## App Logic Confirmation

- Register/login logic was not changed.
- Auth logic was not changed.
- API calls were not changed.
- Quiz/test scoring logic was not changed.
- Backend code was not changed.
- Stripe code was not changed.

## Remaining Branding Issues

Known old credential strings remain from the prior branding report and were not changed because they may be tied to QA/test accounts:

- `demo@4-craft.com`
- `admin@4-craft.com`
- `admin@4-craft.local`
- JWT fallback secret string containing `4-craft`
