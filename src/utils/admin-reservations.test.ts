import { expect, test } from 'vitest';
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
