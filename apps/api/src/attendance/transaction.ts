export function retryable(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 5) return false;
  const info = error as Record<string, unknown>;
  if (
    ['code', 'sqlState', 'originalCode'].some((key) =>
      ['P2034', '40001', '40P01'].includes(String(info[key] || '')),
    )
  )
    return true;
  return ['cause', 'meta', 'driverAdapterError'].some((key) =>
    retryable(info[key], depth + 1),
  );
}
