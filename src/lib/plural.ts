/**
 * Picks the correct Russian plural form for a number.
 *
 * Russian has three forms, selected by the number's last digit(s):
 *   - one:  1, 21, 31, …            → forms[0]  («1 игрок»)
 *   - few:  2–4, 22–24, …           → forms[1]  («2 игрока»)
 *   - many: 0, 5–20, 25–30, 11–14   → forms[2]  («5 игроков»)
 *
 * @example plural(1, ["игрок", "игрока", "игроков"]) // "игрок"
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** Same as {@link plural} but prefixes the number: `pluralize(3, …)` → "3 игрока". */
export function pluralize(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}
