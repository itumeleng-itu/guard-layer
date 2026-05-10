/** In-memory FIFO log for demos (dashboard ↔ payment-app visibility). Not durable. */

const CAP = 200;
/** @type {object[]} */
const entries = [];

export const FRICTIONLESS_BIO_TOKEN = 'GUARD_LAYER_FRICTIONLESS';

/**
 * @param {object} row
 */
export function pushActivity(row) {
  entries.unshift({
    at: new Date().toISOString(),
    ...row,
  });
  while (entries.length > CAP) entries.pop();
}

export function listActivity() {
  return [...entries];
}

/**
 * Recent risk_check with APPROVE for same ref + msisdn (frictionless settlement gate).
 */
export function hasApproveCheck(transactionRef, phoneNumber) {
  if (!transactionRef || !phoneNumber) return false;
  return entries.some(
    (e) =>
      e.kind === 'risk_check' &&
      e.transactionRef === transactionRef &&
      e.phoneNumber === phoneNumber &&
      e.decision === 'APPROVE'
  );
}
