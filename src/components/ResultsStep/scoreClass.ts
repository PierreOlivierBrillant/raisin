/**
 * Retourne la classe de badge correspondant à un score de similarité.
 */
export function scoreClass(score: number): string {
  if (score >= 95) return "badge-success";
  if (score >= 90) return "badge-warning";
  return "badge-error";
}
