# Checkout Feedback Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 3-step checkout feedback flow with required rating selection, optional feedback submission, and thank-you screen while reusing `/api/checkout`.

**Architecture:** Frontend state machine in `page.tsx` drives the three steps and calls `/api/checkout` with an explicit `mode` for creation vs. feedback update. The API route validates inputs and either creates a new checkout document (with rating) or updates an existing one (with feedback and timestamp).

**Tech Stack:** Next.js (App Router), React, Firebase Admin (Firestore), Tailwind.

### Task 1: Extend checkout types for rating + feedback metadata

**Files:**
- Modify: `src/types/checkout.ts`

**Step 1: Write a failing test**
Create a brief manual verification checklist in this plan for type usage (since no test framework exists):
- CheckoutRecord should accept `stayRating` and `feedbackSubmittedAt`.
- CheckoutRequest should accept `mode` and `checkoutId` for feedback updates.

**Step 2: Run test to verify it fails**
N/A (no automated tests). Confirm current types do not include the new fields.

**Step 3: Write minimal implementation**
- Add `export type StayRating = 'not_great' | 'good' | 'excellent'`.
- Extend `CheckoutRecord` with `stayRating?: StayRating` and `feedbackSubmittedAt?: FirestoreTimestamp | Date | string`.
- Update `CheckoutRequest` to include optional `mode?: 'checkout' | 'feedback'`, optional `checkoutId?: string`, optional `stayRating?: StayRating`, and keep `guestNote?: string`.

**Step 4: Run test to verify it passes**
Re-check the manual checklist and ensure the types compile with the new fields.

**Step 5: Commit**
```bash
git add src/types/checkout.ts
git commit -m "feat: extend checkout types for rating and feedback"
```

### Task 2: Update `/api/checkout` to support `mode` and rating/feedback

**Files:**
- Modify: `src/app/api/checkout/route.ts`

**Step 1: Write the failing test**
Manual verification checklist:
- `mode=checkout` requires `roomId` + `stayRating` and creates a document with `stayRating`.
- `mode=feedback` requires `checkoutId` and updates `guestNote` + `feedbackSubmittedAt`.

**Step 2: Run test to verify it fails**
N/A (no automated tests). Confirm current route only creates documents and ignores `mode`.

**Step 3: Write minimal implementation**
- Parse `mode` from request body and default to `'checkout'` when absent.
- Validate `stayRating` when `mode=checkout`.
- For `mode=checkout`, create the checkout record including `stayRating` and return `checkoutId`.
- For `mode=feedback`, update the existing checkout doc with `guestNote` (or null) and `feedbackSubmittedAt`.
- Return success message for each mode.

**Step 4: Run test to verify it passes**
Re-check the manual checklist against code paths and error responses.

**Step 5: Commit**
```bash
git add src/app/api/checkout/route.ts
git commit -m "feat: add checkout/feedback modes to checkout API"
```

### Task 3: Implement three-step UI flow in checkout page

**Files:**
- Modify: `src/app/checkout/[roomId]/page.tsx`

**Step 1: Write the failing test**
Manual verification checklist:
- Checkout button disabled until a rating is selected.
- After checkout succeeds, completion UI is shown with feedback textarea + send button.
- After feedback submission, thank-you UI is shown.

**Step 2: Run test to verify it fails**
N/A (no automated tests). Confirm current UI shows textarea before checkout and has no rating step.

**Step 3: Write minimal implementation**
- Add state: `flowStep`, `stayRating`, `checkoutId`.
- Step 1 UI: “How was your stay?” with 3 rating buttons (single-select). Checkout button enabled only when `stayRating` is set.
- On checkout submit: call `/api/checkout` with `{ mode: 'checkout', roomId, stayRating }`. Store `checkoutId` on success and move to Step 2.
- Step 2 UI: “チェックアウト完了” screen with optional feedback textarea and “送信” button; on submit call `/api/checkout` with `{ mode: 'feedback', checkoutId, guestNote }`, then move to Step 3.
- Step 3 UI: “フィードバック ありがとうございます” page matching the provided mock.

**Step 4: Run test to verify it passes**
Re-check the manual checklist by running the page locally (`npm run dev`).

**Step 5: Commit**
```bash
git add src/app/checkout/[roomId]/page.tsx
git commit -m "feat: add rating-first checkout feedback flow"
```

### Task 4: Optional polish + lint

**Files:**
- Modify: `src/app/checkout/[roomId]/page.tsx` (only if needed)

**Step 1: Write the failing test**
Manual verification checklist:
- Disabled buttons have appropriate visual state.
- Loading indicators appear during API calls.

**Step 2: Run test to verify it fails**
N/A (manual).

**Step 3: Write minimal implementation**
Tweak UI classes or copy to match the reference images more closely.

**Step 4: Run test to verify it passes**
`npm run lint`

**Step 5: Commit**
```bash
git add src/app/checkout/[roomId]/page.tsx
git commit -m "chore: polish checkout feedback UI"
```
