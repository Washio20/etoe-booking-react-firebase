# Reservations Excel Password Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a password-gated Excel download on the reservations admin page using the same password as the sales-statistics page.

**Architecture:** Add a small password validation helper with unit tests, then wire a modal overlay in the reservations page to verify once per session (React state). If verified, proceed with existing Excel export flow.

**Tech Stack:** Next.js, React, TypeScript, Vitest.

---

### Task 1: Add password validation helper (TDD)

**Files:**
- Create: `src/utils/password.ts`
- Create: `src/utils/password.test.ts`

**Step 1: Write failing test**

```ts
import { expect, test } from 'vitest';
import { isSalesPasswordValid } from './password';

test('isSalesPasswordValid matches sales password', () => {
  const env = { NEXT_PUBLIC_SALES_PASSWORD: 'secret' } as any;
  expect(isSalesPasswordValid('secret', env)).toBe(true);
  expect(isSalesPasswordValid('wrong', env)).toBe(false);
});
```

**Step 2: Run test to verify RED**

Run: `npm test`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```ts
export const isSalesPasswordValid = (
  input: string,
  env: { NEXT_PUBLIC_SALES_PASSWORD?: string } = process.env
) => {
  const expected = env.NEXT_PUBLIC_SALES_PASSWORD || 'etoestats';
  return input === expected;
};
```

**Step 4: Run tests to verify GREEN**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/password.ts src/utils/password.test.ts
git commit -m "test: add sales password helper"
```

---

### Task 2: Add password modal to reservations Excel download (TDD + manual UI check)

**Files:**
- Modify: `src/app/admin/reservations/page.tsx`

**Step 1: Add UI state and handlers**
- `isExcelPasswordVerified`
- `showPasswordModal`, `passwordInput`, `passwordError`
- `handleDownloadClick` opens modal if not verified
- `handlePasswordSubmit` verifies and triggers download

**Step 2: Add modal overlay**
- Style it similarly to sales-statistics password card
- Include cancel button

**Step 3: Manual check**
- `npm run dev`
- Click Excel download -> modal shows
- Enter correct password -> download starts, subsequent clicks skip prompt

**Step 4: Commit**

```bash
git add src/app/admin/reservations/page.tsx
git commit -m "feat: gate reservations Excel download with password"
```
