/**
 * Deterministic matching rules (docs/ARCHITECTURE.md §6.3) — no model call.
 *
 *   score(doctor) = Σ SymptomSpecialty.weight over matched symptoms
 *                 + availabilityBonus  (3 if a slot is free within 48h)
 *                 + experienceBonus    (0.15 per year, capped at 10 years)
 *
 * Ties break on earliest next slot, then doctor id, so results are stable.
 */

export const EXPERIENCE_CAP_YEARS = 10;
export const EXPERIENCE_BONUS_PER_YEAR = 0.15;
export const AVAILABILITY_BONUS = 3;
export const AVAILABILITY_WINDOW_HOURS = 48;

export interface SymptomForMatching {
  id: string;
  label: string;
  slug: string;
  synonyms: string[];
}

export function normalizeFreeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalizeFreeText(text).split(' ').filter(Boolean);
}

function significant(tokens: string[]): string[] {
  return tokens.filter((token) => token.length >= 3);
}

/** A needle word matches a free-text word on exact or prefix equality. */
function wordMatches(needle: string, haystack: string[]): boolean {
  return haystack.some((word) => word.startsWith(needle) || needle.startsWith(word));
}

/**
 * Deterministic, local free-text matching: a symptom matches when any word of
 * its slug or synonyms matches any word of the normalized input (exact or
 * prefix). Word-token matching, not whole-phrase substring, so "tight chest"
 * matches the "chest tightness" synonym regardless of word order.
 */
export function matchFreeText(freeText: string, symptoms: SymptomForMatching[]): string[] {
  const freeWords = significant(tokenize(freeText));
  if (freeWords.length === 0) return [];
  const ids: string[] = [];
  for (const symptom of symptoms) {
    const needles = significant([symptom.slug, ...(symptom.synonyms ?? [])].flatMap(tokenize));
    if (needles.some((needle) => wordMatches(needle, freeWords))) {
      ids.push(symptom.id);
    }
  }
  return ids;
}

export interface ScoreInput {
  yearsOfExperience: number;
  nextAvailableAt: Date | null;
  specializations: { name: string; weight: number }[];
  now: Date;
}

export interface ScoreOutput {
  score: number;
  specializations: { name: string; weight: number }[];
  availabilityBonus: number;
  experienceBonus: number;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreDoctor(input: ScoreInput): ScoreOutput {
  const specializations = input.specializations.filter((s) => s.weight > 0);
  const weightSum = specializations.reduce((sum, s) => sum + s.weight, 0);
  const windowMs = AVAILABILITY_WINDOW_HOURS * 3600_000;
  const withinWindow =
    input.nextAvailableAt != null &&
    input.nextAvailableAt.getTime() >= input.now.getTime() &&
    input.nextAvailableAt.getTime() <= input.now.getTime() + windowMs;
  const availabilityBonus = withinWindow ? AVAILABILITY_BONUS : 0;
  const experienceBonus = EXPERIENCE_BONUS_PER_YEAR * Math.min(input.yearsOfExperience, EXPERIENCE_CAP_YEARS);
  return {
    score: round2(weightSum + availabilityBonus + experienceBonus),
    specializations,
    availabilityBonus: round2(availabilityBonus),
    experienceBonus: round2(experienceBonus),
  };
}

export interface RankedSuggestion<T> {
  item: T;
  nextAvailableAtMs: number | null;
  score: number;
}

/** Stable ranking: score desc, then earliest slot, then id asc. */
export function rankByScore<T extends { id: string }>(
  items: T[],
  scoreFor: (item: T) => ScoreOutput,
  nextAvailableAtMsOf: (item: T) => number | null,
): RankedSuggestion<T>[] {
  return items
    .map((item) => ({ item, nextAvailableAtMs: nextAvailableAtMsOf(item), score: scoreFor(item).score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((a.nextAvailableAtMs ?? Infinity) !== (b.nextAvailableAtMs ?? Infinity)) {
        return (a.nextAvailableAtMs ?? Infinity) - (b.nextAvailableAtMs ?? Infinity);
      }
      return a.item.id.localeCompare(b.item.id);
    });
}
