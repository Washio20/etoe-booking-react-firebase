# Reservations Excel Download Password Gate Design

Date: 2026-02-02

## Goal
Require a password before allowing the Excel export from the admin Reservations page. The password is the same as the sales-statistics page (`NEXT_PUBLIC_SALES_PASSWORD`).

## Scope
- Page: `src/app/admin/reservations/page.tsx`
- No API changes.

## UX
- Clicking "Excel Download" opens an in-page modal overlay styled like the sales-statistics password card.
- The list remains visible; only the download is gated.
- Error message is shown on incorrect password.
- On success, mark verified in React state for this session (clears on refresh/navigation) and perform the download.

## Behavior
- If already verified in state, clicking download proceeds without prompting.
- Password check uses the same env value as sales-statistics.
- Cancel/close button closes modal without downloading.

## Error Handling
- Incorrect password -> stay in modal, show error state.
- Empty input -> treat as incorrect.

## Testing
- Unit test: helper function for password validation.
- Manual: click download -> modal appears; correct password triggers download; incorrect shows error; subsequent downloads skip prompt.
