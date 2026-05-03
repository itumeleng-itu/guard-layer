/**
 * Deterministic weighted risk score before Claude (P2).
 * Spec: documentation.md — Signal Fusion Scoring
 */

/**
 * @param {object} signals — keyed results from all six CAMARA checks
 * @returns {{ score: number, breakdown: { label: string, points: number }[], triggerCount: number }}
 */
export function computeRawRiskScore(signals) {
  const {
    simSwap,
    deviceSwap,
    numberVerify,
    locationVerify,
    kycMatch,
    congestionInsights,
  } = signals;

  let rawSum = 0;
  /** @type {{ label: string, points: number }[]} */
  const breakdown = [];
  let triggerCount = 0;

  const add = (points, label) => {
    rawSum += points;
    breakdown.push({ label, points });
    triggerCount += 1;
  };

  if (simSwap?.recentChange) add(35, 'sim_swap');
  if (deviceSwap && !deviceSwap.deviceMatch) add(25, 'device_mismatch');
  if (numberVerify && !numberVerify.verified) add(20, 'number_spoof');
  if (locationVerify && !locationVerify.withinGeofence) add(15, 'location_mismatch');

  const kycFail =
    kycMatch &&
    (!kycMatch.identitySynced || kycMatch.matchScore < 80);
  if (kycFail) add(10, 'kyc_mismatch');

  const level = congestionInsights?.level ?? 'normal';
  if (level === 'elevated') add(8, 'congestion_elevated');
  else if (level === 'critical') add(15, 'congestion_critical');

  let score = rawSum;
  if (triggerCount >= 3) score = rawSum * 1.2;

  score = Math.min(100, Math.round(score));

  return { score, breakdown, triggerCount };
}
