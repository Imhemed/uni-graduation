// Core financial calculations — the single source of truth on the client so the
// numbers match DRD §9 and the backend. Used by the account, start-semester and
// receipt screens.
//
//   Total Semester Cost = (courses_count × course_price) + base_fee
//   Remaining Balance    = Total Cost − Total Paid
//   Fully Paid           = Remaining ≤ 0

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function sum(nums) {
  return round2((nums || []).reduce((acc, n) => acc + Number(n || 0), 0));
}

export function semesterCost({ courses_count, snapshot_course_price, snapshot_base_fee }) {
  const courses = Number(courses_count || 0);
  const price = Number(snapshot_course_price || 0);
  const base = Number(snapshot_base_fee || 0);
  return round2(courses * price + base);
}

export function remaining(cost, paid) {
  return round2(Math.max(0, round2(cost) - round2(paid)));
}

export function isFullyPaid(cost, paid) {
  return round2(paid) >= round2(cost);
}

export function paidPercent(cost, paid) {
  const c = round2(cost);
  if (c <= 0) return 100;
  return Math.min(100, Math.round((round2(paid) / c) * 100));
}
