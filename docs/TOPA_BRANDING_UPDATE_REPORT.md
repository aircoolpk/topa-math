# TOPA Branding Update Report

Date: 2026-05-15

## Summary

Updated the frontend visible branding to **TOPA Math** and refreshed primary landing copy to:

- **TOPA Math**
- **เรียนเลขให้สนุก เข้าใจง่าย มั่นใจทุกโจทย์**
- **แพลตฟอร์มเรียนคณิตสำหรับเด็กประถม ที่ช่วยให้เรียนอย่างเป็นขั้นตอน ฝึกคิดแบบเห็นภาพ ทำแบบทดสอบได้ และพัฒนาความมั่นใจในคณิตศาสตร์ทุกวัน**

No auth logic, quiz/test scoring logic, backend answer checking logic, Stripe logic, or routing behavior was intentionally changed for this branding pass.

## Files Changed

- `apps/web/src/components/brand/TopaBrand.tsx`
- `apps/web/public/topa-mascot.svg`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/register/page.tsx`
- `apps/web/src/app/lessons/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/children/[childId]/page.tsx`
- `apps/web/src/app/pricing/page.tsx`
- `apps/web/src/app/billing/page.tsx`
- `apps/web/src/app/billing/success/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/components/profile/ProfileHero.tsx`

## Branding Updated

- Site metadata title and description now use TOPA Math branding.
- Homepage navigation, hero, supporting copy, footer, contact email, and copyright were updated.
- Login and register headers were updated to TOPA Math and the new Thai slogan.
- Dashboard, lessons, child dashboard, pricing, billing, and admin headers were updated where visible old branding appeared.
- Billing success support email was updated to `support@topamath.com`.
- Shared child avatar copy now uses `topamath.com` instead of the old domain.

## Mascot Usage

The repo did not contain an uploaded mascot image file at the time of this update, so a local TOPA mascot SVG fallback was added at:

- `apps/web/public/topa-mascot.svg`

The shared `TopaMascot` component is used in:

- Homepage hero section
- Login header
- Register header
- Dashboard header and coming-soon state
- Lessons header and Grade 4-6 coming-soon cards
- Child dashboard header
- Pricing and billing headers through the shared brand mark
- Billing success page

If a final provided mascot image should replace the placeholder, place it in `apps/web/public/topa-mascot.svg` or update `TopaBrand.tsx` to point to the final asset path.

## Remaining Old Branding References

Remaining old-name/domain strings are intentionally not changed because they are not regular public branding copy or could affect environment/test behavior:

- `apps/web/src/lib/auth.ts` contains the fallback secret string `4-craft-secret-key-change-in-production`.
- `apps/web/src/app/login/page.tsx` still shows QA credential hints using `demo@4-craft.com` and `admin@4-craft.com`.
- `apps/web/src/app/admin/generated-content/page.tsx` still shows `admin@4-craft.local` as an admin test credential.

These can be renamed later if the test accounts and auth configuration are also intentionally renamed.

## Validation Results

- `node -v`: `v24.14.0`
- `npm -v`: `11.9.0`
- `npm run lint`: passed (`tsc --noEmit`)
- `npm run build`: passed and generated all routes successfully

Build note: Next.js printed an existing ESLint configuration warning:

`ESLint: Invalid Options: - Unknown options: useEslintrc, extensions - 'extensions' has been removed.`

The build command still exited successfully.

## Scope Confirmation

- Quiz/test scoring logic was not modified.
- Backend auth logic was not modified.
- Stripe logic was not modified.
- Routing and application business logic were not intentionally changed.
