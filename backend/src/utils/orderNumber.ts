import crypto from 'crypto';

/** Human-friendly, unique order reference e.g. GSS-20260916-9F3K7C */
export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `GSS-${y}${m}${d}-${rand}`;
}

export function generateTransactionRef(): string {
  return `SIM-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}
