# Browser Login Flow Fix Report
**Date:** 2026-05-10
**Project:** 4-Craft Adaptive Learning SaaS
**Frontend:** `D:\web app\4-craft.com\apps\web`

---

## Root Cause

Two issues were causing the browser login flow to fail / stay on `/login`:

### Issue 1: `router.push()` fails in Next.js App Router with full-page redirect

The login page's `handleSubmit` used `router.push('/dashboard')` after a successful
login. In Next.js App Router (Next.js 14), `router.push()` performs a client-side
navigation — it updates the Next.js client-side router state and triggers a
hydrate/render cycle. This can race with the `useEffect` execution that fires on
the dashboard page, causing the dashboard to render before auth state is fully
hydrated. With React Strict Mode and Zustand `persist`, the timing is unpredictable.

**Fix:** Replaced `router.push()` with `window.location.href = ...` which performs
a full-page browser navigation (hard redirect). This is more reliable for auth
redirects where the entire page state needs to be reset and the server needs to
see a fresh request with the updated cookie/storage state.

### Issue 2: `checkAuth` removed the token on any API failure (including network errors)

The `auth.ts` store's `checkAuth()` was called on every protected page mount.
When the backend was unreachable (port 8001 not running), `authApi.me()` threw
an error. The old code treated ALL errors as auth failures and deleted the token:

```typescript
// OLD (broken) — removes token even on network failure
catch {
  localStorage.removeItem('access_token')
  set({ token: null, user: null })
}
```

This caused a race: after login succeeds and writes the token, the user is
redirected to `/dashboard`. The dashboard calls `checkAuth()`. If the backend
is slow or unreachable, `checkAuth` deletes the token, the dashboard's auth
guard sees no token and pushes back to `/login`, and the user stays stuck on
the login page.

**Fix:** Only remove the token on HTTP 401 (invalid/expired credential). For
network errors or backend unavailability, keep the token intact so the user
can still use the app when the backend comes back up.

---

## Files Changed

### 1. `apps/web/src/app/login/page.tsx` (line 21)

**Before:**
```typescript
router.push(isAdmin ? '/admin/dashboard' : '/dashboard')
```

**After:**
```typescript
window.location.href = isAdmin ? '/admin/dashboard' : '/dashboard'
```

**Reason:** `router.push()` is a soft navigation that can race with React
hydration and Zustand store rehydration. `window.location.href` is a hard
redirect that always works regardless of client-side state timing.

---

### 2. `apps/web/src/store/auth.ts` (lines 56–73)

**Before:**
```typescript
checkAuth: async () => {
  const token = localStorage.getItem('access_token')
  if (!token) return
  try {
    const user = await authApi.me()
    set({ token, user })
  } catch {
    localStorage.removeItem('access_token')
    set({ token: null, user: null })
  }
},
```

**After:**
```typescript
checkAuth: async () => {
  const token = localStorage.getItem('access_token')
  if (!token) return
  try {
    const user = await authApi.me()
    set({ token, user })
  } catch (err) {
    const status = err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { status?: number } }).response?.status
      : null
    if (status === 401) {
      localStorage.removeItem('access_token')
      set({ token: null, user: null })
    }
    // For network errors / backend down, leave token intact
  }
},
```

**Reason:** Backend unavailability (000 or timeout) should not log the user
out. Only HTTP 401 means the token is invalid — network errors mean the
backend is temporarily down.

---

## Commands Run

```bash
# Build after changes
cd /mnt/d/web\ app/4-craft.com/apps/web
npm run build  # exit 0, 22 pages generated

# Start dev server
npm run dev

# Verify all routes
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/register
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/dashboard
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/admin
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/billing
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/lessons
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/admin/dashboard
```

---

## Route Verification (HTTP Status)

| Route | Status | Notes |
|-------|--------|-------|
| `/` | ✅ 200 | Homepage |
| `/login` | ✅ 200 | Login page renders |
| `/register` | ✅ 200 | Registration page |
| `/dashboard` | ✅ 200 | Dashboard (requires auth at runtime) |
| `/admin` | ✅ 200 | Admin index → redirects to `/admin/dashboard` |
| `/billing` | ✅ 200 | Billing page |
| `/lessons` | ✅ 200 | Lessons listing page |
| `/admin/dashboard` | ✅ 200 | Admin dashboard |

---

## Browser Test Procedure (Manual QA)

Since browser automation requires Chrome/Chromium which is not available in
this environment, manual verification steps:

### Step 1 — Login with demo student
1. Open `http://127.0.0.1:3000/login`
2. Fill email: `demo@4-craft.com`, password: `demo1234`
3. Click **เข้าสู่ระบบ**
4. **Expected:** Full-page redirect to `/dashboard`
5. **Verify:** URL changes to `.../dashboard`, page shows student dashboard

### Step 2 — Login with admin
1. Log out (clear localStorage or click logout)
2. Open `http://127.0.0.1:3000/login`
3. Fill email: `admin@4-craft.com`, password: `admin1234`
4. Click **เข้าสู่ระบบ**
5. **Expected:** Full-page redirect to `/admin/dashboard`
6. **Verify:** URL changes to `.../admin/dashboard`, admin nav sidebar appears

### Step 3 — Lessons after login
1. After logged in as demo student, navigate to `/lessons`
2. **Expected:** Shows lessons listing with lesson cards
3. Click a lesson card → **Expected:** Navigate to `/dashboard/lessons/{lessonId}`

### Step 4 — Protected route behavior
1. Clear localStorage (`access_token`)
2. Navigate to `/dashboard` directly
3. **Expected:** Redirects to `/login`

---

## Auth Flow Summary (After Fix)

```
Browser                    Next.js Frontend           Backend (8001)
  │                               │                         │
  │  POST /login (form submit)    │                         │
  │──────────────────────────────>│                         │
  │                               │  POST /auth/login       │
  │                               │────────────────────────>│
  │                               |                         │
  │                               |<─────────────────────────│ 200 + token
  │                               |                         |
  │  window.location.href =       |                         |
  │  /dashboard (hard redirect)  |                         |
  │<──────────────────────────────│                         |
  │                               |                         |
  │  GET /dashboard (fresh req)   |                         │
  │──────────────────────────────>│                         │
  │                               |  checkAuth → GET /auth/me
  │                               |────────────────────────>│
  │                               |                         |
  │  Dashboard renders with       |<─────────────────────────│
  |  children + lessons data      |                         |
```

---

## Remaining Blockers

| Blocker | Severity | Notes |
|---------|----------|-------|
| Backend not running on port 8001 | **HIGH** | Login API (`POST /auth/login`) will fail; `/dashboard`, `/lessons` will show empty/error state because `childrenApi.list()` and `meApi.getDashboard()` can't reach backend. Start backend with `uvicorn` for full flow test. |
| `admin@4-craft.com` credentials | Medium | Unknown if this admin account exists in seed data. Only `demo@4-craft.com` / `demo1234` confirmed working in prior tests. |
| No browser automation available | Medium | Chrome not available in this environment — manual QA required to confirm redirect behavior. |

---

## Node Version

- Current: **Node v22.22.2** ✅ — compatible with Next.js 14.2.5
- Not Node 24.14.0 — that was a different environment's report

---

## Conclusion

The browser login redirect issue had two root causes:
1. `router.push()` timing issue with Zustand + React hydration → fixed with `window.location.href`
2. Over-aggressive token invalidation on any API error → fixed to only remove token on HTTP 401

All routes now return HTTP 200. Backend needs to be running for full login → dashboard flow verification.