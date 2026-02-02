# Reservations Excel Download Design

Date: 2026-02-02

## Goal
Add an Excel download to the admin Reservations page that exports the currently filtered results and includes customer demographics (gender, age group) and reservation type (sauna only vs set plan) for marketing analysis.

## Scope
- Page: `src/app/admin/reservations/page.tsx`
- API: `src/app/api/admin/reservations/route.ts`
- Types: `src/types/reservation.ts`

## Requirements
- Export **all rows** from the current filtered result set (not just current page).
- Columns: list page columns + gender + age group + reservation type (sauna only / set plan).
- Reservation type rule: `slowRoomAsSetPlan === true` => セットプラン, else サウナ単体.
- Age group buckets: 20代/30代/40代/50代/60代以上/不明 (birthdate missing => 不明).
- Excel format via `xlsx` (already used in sales-statistics page).

## Data Sources
- Reservations: `/api/admin/reservations` (existing).
- User demographics: `users` collection (`gender`, `birthdate`).
- Enrichment added server-side so the list fetch already includes `userGender` and `userBirthdate`.

## Excel Columns (JP)
1) 予約ID
2) 作成日時
3) 氏名
4) メール
5) 電話
6) 予約日
7) 予約時間
8) スロールーム時間
9) 部屋タイプ
10) 予約区分（サウナ単体/セットプラン）
11) 金額
12) ステータス
13) 性別
14) 年代

## UI/UX
- Add an “Excel ダウンロード” button in the Reservations page header area.
- Disable button when no data is available; alert when data set is empty.

## API Changes
- Extend `GET /api/admin/reservations` to include:
  - `userGender?: 'male' | 'female' | ''`
  - `userBirthdate?: string`
- Use existing user cache to avoid repeated lookups.

## Type Changes
- Extend `Reservation` with optional `userGender` and `userBirthdate` fields.

## Edge Cases
- Missing gender => 不明.
- Missing/invalid birthdate => 不明.
- Set plan depends solely on `slowRoomAsSetPlan`.

## Testing Checklist
- Verify export matches filtered results for email, status, room type, and date filters.
- Verify gender/age group derivation with missing data.
- Ensure set plan classification matches rule.
- Confirm Excel opens correctly in Excel.
