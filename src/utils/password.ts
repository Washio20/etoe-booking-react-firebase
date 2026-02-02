export const isSalesPasswordValid = (
  input: string,
  env: { NEXT_PUBLIC_SALES_PASSWORD?: string } = process.env
) => {
  const expected = env.NEXT_PUBLIC_SALES_PASSWORD || 'etoestats';
  return input === expected;
};
