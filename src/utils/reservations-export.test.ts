import { expect, test } from 'vitest';
import {
  getAgeGroup,
  getReservationType,
  formatGender,
  buildReservationExportRows
} from './reservations-export';

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
