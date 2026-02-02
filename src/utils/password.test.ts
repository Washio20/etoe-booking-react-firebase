import { expect, test } from 'vitest';
import { isSalesPasswordValid } from './password';

test('isSalesPasswordValid matches sales password', () => {
  const env = { NEXT_PUBLIC_SALES_PASSWORD: 'secret' } as any;
  expect(isSalesPasswordValid('secret', env)).toBe(true);
  expect(isSalesPasswordValid('wrong', env)).toBe(false);
});
