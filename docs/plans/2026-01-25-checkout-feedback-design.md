# Checkout Feedback Flow Design

Date: 2026-01-25

## Summary
Add a three-step checkout feedback flow on the checkout page. Step 1 requires a single rating selection before checkout. Step 2 shows checkout completion with an optional feedback textarea and a submit button. Step 3 shows a thank-you screen after feedback submission. Persist both rating and feedback to the existing `checkouts` collection using the `/api/checkout` endpoint.

## Goals
- Require a single stay rating before allowing checkout.
- Show a checkout completion page that invites optional feedback.
- If feedback is submitted, show a thank-you page.
- Reuse `/api/checkout` and store rating/feedback on the same checkout document.

## Non-goals
- Do not create a new feedback endpoint.
- Do not support multiple ratings per checkout.

## User Flow
1. Rating step: user selects one of three ratings (not_great, good, excellent). Checkout button becomes enabled.
2. Checkout completion step: on successful checkout API call, show completion UI and optional feedback input.
3. Feedback thank-you step: on successful feedback submission, show thank-you UI.

## Frontend State
- `flowStep`: "rate" | "done" | "thanks"
- `stayRating`: "not_great" | "good" | "excellent" | ""
- `checkoutId`: string | ""
- `guestNote`: string
- `isLoading`: boolean

## API Contract
POST `/api/checkout`
- Mode `checkout`:
  - Request: `{ mode: "checkout", roomId, stayRating }`
  - Response: `{ success, message, checkoutId }`
- Mode `feedback`:
  - Request: `{ mode: "feedback", checkoutId, guestNote }`
  - Response: `{ success, message }`

## Data Model
`checkouts` document fields (new/updated):
- `stayRating`: "not_great" | "good" | "excellent"
- `guestNote`: string | null
- `feedbackSubmittedAt`: Timestamp | null

## Validation
- roomId format: 3 digits
- stayRating must be one of the three values when `mode=checkout`
- `mode=feedback` requires a valid `checkoutId`

## Error Handling
- Show inline error message for API failures.
- Keep user on current step and allow retry.

## Testing Notes
- Rating must be selected before enabling checkout button.
- Checkout flow returns checkoutId and moves to completion step.
- Feedback submission updates same document and shows thank-you page.
