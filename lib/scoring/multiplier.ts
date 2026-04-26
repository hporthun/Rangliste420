/**
 * DSV-Ranglistenordnung (RO) Anlage 1, §3 — Multiplikator m
 * Gültig ab 01.01.2026
 *
 * Eine Regatta fließt bis zu m-mal in die Werteliste eines Seglers ein.
 */
export function calculateMultiplier(
  completedRaces: number,
  multiDayAnnouncement: boolean
): number {
  if (completedRaces <= 0) return 0;
  if (completedRaces === 1) return 1;
  if (completedRaces === 2) return 2;
  if (completedRaces === 3) return 3;
  if (completedRaces <= 5) return 4;
  // 6 or more: 5 if multiDay announced, else 4
  return multiDayAnnouncement ? 5 : 4;
}
