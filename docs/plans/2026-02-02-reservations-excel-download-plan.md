# Reservations Excel Download Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an Excel download to the admin Reservations page that exports the current filtered results with gender, age group, and reservation type for marketing analysis.

**Architecture:** Enrich reservations API responses with user gender/birthdate from the users collection, then generate Excel client-side from the already-filtered list. Move export formatting into testable utility functions and keep the UI layer thin.

**Tech Stack:** Next.js (App Router), Firebase Admin SDK, TypeScript, xlsx, Vitest (for unit tests).

---

### Task 1: Add a minimal test runner (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Update devDependencies and scripts**

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

**Step 2: Add Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
```

**Step 3: Install dependencies**

Run: `npm install`
Expected: installs vitest with no errors.

**Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest runner"
```

---

### Task 2: Add export formatting utilities (TDD)

**Files:**
- Create: `src/utils/reservations-export.ts`
- Create: `src/utils/reservations-export.test.ts`

**Step 1: Write failing tests**

```ts
// src/utils/reservations-export.test.ts
import { describe, expect, test } from 'vitest';
import { getAgeGroup, getReservationType, formatGender, buildReservationExportRows } from './reservations-export';

const roomTypeNames = { tototo: 'TOTOTO' };

const baseReservation = {
  id: 'res_1',
  userEmail: 'test@example.com',
  userFullName: '山田 太郎',
  userPhone: '090-0000-0000',
  roomType: 'tototo',
  price: '12000',
  paymentStatus: 'paid',
  createdAt: new Date('2025-01-02T12:34:00Z'),
  displayDate: '2025/01/10',
  displayTimeRange: '10:00〜12:00',
  displaySlowRoomTimeRange: '13:00〜15:00',
  slowRoomAsSetPlan: true,
  userGender: 'male',
  userBirthdate: '2000-05-01'
};

test('formatGender returns JP labels', () => {
  expect(formatGender('male')).toBe('男性');
  expect(formatGender('female')).toBe('女性');
  expect(formatGender('')).toBe('不明');
  expect(formatGender(undefined)).toBe('不明');
});

test('getAgeGroup buckets by decade', () => {
  const currentYear = new Date().getFullYear();
  const birthYear20s = currentYear - 25;
  const birthYear60s = currentYear - 63;
  expect(getAgeGroup(`${birthYear20s}-01-01`)).toBe('20代');
  expect(getAgeGroup(`${birthYear60s}-01-01`)).toBe('60代以上');
  expect(getAgeGroup('')).toBe('不明');
});

test('getReservationType uses slowRoomAsSetPlan', () => {
  expect(getReservationType({ slowRoomAsSetPlan: true })).toBe('セットプラン');
  expect(getReservationType({ slowRoomAsSetPlan: false })).toBe('サウナ単体');
  expect(getReservationType({})).toBe('サウナ単体');
});

test('buildReservationExportRows builds a single row', () => {
  const rows = buildReservationExportRows([baseReservation as any], roomTypeNames);
  expect(rows).toHaveLength(1);
  expect(rows[0][0]).toBe('res_1');
  expect(rows[0][3]).toBe('test@example.com');
  expect(rows[0][8]).toBe('TOTOTO');
  expect(rows[0][9]).toBe('セットプラン');
  expect(rows[0][12]).toBe('男性');
  expect(rows[0][13]).toBe('20代');
});
```

**Step 2: Run tests to verify RED**

Run: `npm test`
Expected: FAIL (module `reservations-export` not found).

**Step 3: Write minimal implementation**

```ts
// src/utils/reservations-export.ts
import { Reservation } from '@/types/reservation';
import { formatTimestamp } from '@/utils/date';

export const formatGender = (gender?: string) =>
  gender === 'male' ? '男性' : gender === 'female' ? '女性' : '不明';

export const getAgeGroup = (birthdate?: string) => {
  if (!birthdate) return '不明';
  const birthYear = new Date(birthdate).getFullYear();
  if (!Number.isFinite(birthYear)) return '不明';
  const age = new Date().getFullYear() - birthYear;
  if (age < 20) return '不明';
  if (age < 30) return '20代';
  if (age < 40) return '30代';
  if (age < 50) return '40代';
  if (age < 60) return '50代';
  return '60代以上';
};

export const getReservationType = (reservation: { slowRoomAsSetPlan?: boolean }) =>
  reservation.slowRoomAsSetPlan ? 'セットプラン' : 'サウナ単体';

export const buildReservationExportRows = (
  reservations: Reservation[],
  roomTypeNames: Record<string, string>
) => {
  return reservations.map((reservation) => {
    const displayDate = reservation.displayDate || reservation.reservationDate || '';
    const displayTime = reservation.displayTimeRange || reservation.reservationTime || '';
    const slowRoomTime = reservation.displaySlowRoomTimeRange || '';
    const roomTypeLabel = roomTypeNames[reservation.roomType] || reservation.roomType;
    const amount = parseInt(String(reservation.price), 10);
    const amountLabel = Number.isFinite(amount) ? `¥${amount.toLocaleString()}` : '';
    const statusLabel =
      reservation.paymentStatus === 'paid'
        ? '支払い済み'
        : reservation.paymentStatus === 'cancelled'
        ? 'キャンセル'
        : reservation.paymentStatus;

    return [
      reservation.id,
      formatTimestamp(reservation.createdAt, 'yyyy/MM/dd HH:mm'),
      reservation.userFullName || '未設定',
      reservation.userEmail || '',
      reservation.userPhone || '',
      displayDate,
      displayTime,
      slowRoomTime,
      roomTypeLabel,
      getReservationType(reservation),
      amountLabel,
      statusLabel,
      formatGender(reservation.userGender),
      getAgeGroup(reservation.userBirthdate)
    ];
  });
};
```

**Step 4: Run tests to verify GREEN**

Run: `npm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/reservations-export.ts src/utils/reservations-export.test.ts
git commit -m "test: add reservation export helpers"
```

---

### Task 3: Add user demographic fields to reservation data (TDD)

**Files:**
- Modify: `src/types/reservation.ts`
- Create: `src/utils/admin-reservations.ts`
- Create: `src/utils/admin-reservations.test.ts`
- Modify: `src/app/api/admin/reservations/route.ts`

**Step 1: Write failing tests**

```ts
// src/utils/admin-reservations.test.ts
import { describe, expect, test } from 'vitest';
import { mergeUserProfile } from './admin-reservations';

const baseReservation = {
  id: 'res_1',
  userFullName: undefined,
  userPhone: undefined,
  userGender: undefined,
  userBirthdate: undefined
};

const userData = {
  fullName: '山田 太郎',
  phone: '090-0000-0000',
  gender: 'male',
  birthdate: '2000-05-01'
};

test('mergeUserProfile fills missing fields', () => {
  const merged = mergeUserProfile(baseReservation as any, userData as any);
  expect(merged.userFullName).toBe('山田 太郎');
  expect(merged.userPhone).toBe('090-0000-0000');
  expect(merged.userGender).toBe('male');
  expect(merged.userBirthdate).toBe('2000-05-01');
});
```

**Step 2: Run tests to verify RED**

Run: `npm test`
Expected: FAIL (module `admin-reservations` not found).

**Step 3: Write minimal implementation**

```ts
// src/utils/admin-reservations.ts
import { Reservation } from '@/types/reservation';

export const mergeUserProfile = (
  reservation: Reservation,
  userData: { fullName?: string; phone?: string; gender?: string; birthdate?: string } | undefined
) => {
  if (!userData) return reservation;
  return {
    ...reservation,
    userFullName: reservation.userFullName || userData.fullName,
    userPhone: reservation.userPhone || userData.phone,
    userGender: reservation.userGender || userData.gender,
    userBirthdate: reservation.userBirthdate || userData.birthdate
  };
};
```

**Step 4: Update Reservation type**

```ts
// src/types/reservation.ts
  userGender?: 'male' | 'female' | '';
  userBirthdate?: string;
```

**Step 5: Wire into API route**

```ts
// src/app/api/admin/reservations/route.ts
import { mergeUserProfile } from '@/utils/admin-reservations';

// inside enhancedReservationsPromises
if (userDoc.exists) {
  const userData = userDoc.data();
  const fullName = userData?.fullName;
  const phone = userData?.phone;
  const gender = userData?.gender;
  const birthdate = userData?.birthdate;

  userInfoCache[userId] = { fullName, phone, gender, birthdate } as any;

  return mergeUserProfile(reservation, {
    fullName,
    phone,
    gender,
    birthdate
  });
}
```

**Step 6: Run tests to verify GREEN**

Run: `npm test`
Expected: PASS.

**Step 7: Commit**

```bash
git add src/types/reservation.ts src/utils/admin-reservations.ts src/utils/admin-reservations.test.ts src/app/api/admin/reservations/route.ts
git commit -m "feat: include user gender and birthdate in reservations"
```

---

### Task 4: Add Excel download to Reservations page (TDD)

**Files:**
- Modify: `src/app/admin/reservations/page.tsx`

**Step 1: Write failing test**

Create a small unit test for the export rows already covered in Task 2. For the UI change, we will rely on manual verification since no React test harness is in place. (If strict UI tests are required, add React Testing Library in a follow-up task.)

**Step 2: Update UI and export flow**

- Import `XLSX` and export helpers.
- Build Excel rows from `sortedReservations` and download.
- Add button near the page header (similar to sales-statistics).

```ts
import * as XLSX from 'xlsx';
import { buildReservationExportRows } from '@/utils/reservations-export';
```

```ts
const downloadExcel = () => {
  if (sortedReservations.length === 0) {
    alert('データがありません');
    return;
  }

  const header = [[
    '予約ID', '作成日時', '氏名', 'メール', '電話',
    '予約日', '予約時間', 'スロールーム時間', '部屋タイプ',
    '予約区分', '金額', 'ステータス', '性別', '年代'
  ]];

  const rows = buildReservationExportRows(sortedReservations, roomTypeNames);
  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '予約一覧');
  ws['!cols'] = [
    { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 14 },
    { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }
  ];

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  XLSX.writeFile(wb, `予約一覧_${y}${m}${d}.xlsx`);
};
```

**Step 3: Run tests to verify GREEN**

Run: `npm test`
Expected: PASS.

**Step 4: Manual check**

Run: `npm run dev`
Verify: Excel ダウンロード produces an .xlsx with rows matching filtered results.

**Step 5: Commit**

```bash
git add src/app/admin/reservations/page.tsx
git commit -m "feat: add reservations Excel download"
```

---

## Notes / Open Decisions
- If you prefer not to introduce Vitest, confirm permission to proceed without automated tests.
- If UI testing is required, add React Testing Library in a follow-up task.

