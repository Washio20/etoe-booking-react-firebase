export const isSalesPasswordValid = (
  input: string,
  env?: { NEXT_PUBLIC_SALES_PASSWORD?: string }
) => {
  const expected =
    env?.NEXT_PUBLIC_SALES_PASSWORD ||
    process.env.NEXT_PUBLIC_SALES_PASSWORD ||
    'etoestats';
  return input === expected;
};
