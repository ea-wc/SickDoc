import { describe, expect, it } from 'vitest';
import { matchFreeText, rankByScore, scoreDoctor } from './scoring.js';

describe('matchFreeText', () => {
  const symptoms = [
    { id: 's1', label: 'Chest pain', slug: 'chest-pain', synonyms: ['chest tightness', 'angina'] },
    { id: 's2', label: 'Cough', slug: 'cough', synonyms: ['persistent cough'] },
    { id: 's3', label: 'Rash', slug: 'rash', synonyms: ['hives'] },
  ];

  it('matches a synonym regardless of word order', () => {
    expect(matchFreeText('tight chest when climbing stairs', symptoms)).toContain('s1');
  });

  it('matches a direct slug word', () => {
    expect(matchFreeText('I have a bad cough', symptoms)).toContain('s2');
  });

  it('returns no ids for unrelated text', () => {
    expect(matchFreeText('hello world', symptoms)).toEqual([]);
  });
});

describe('scoreDoctor', () => {
  const now = new Date('2026-09-21T00:00:00.000Z');

  it('sums specialty weights plus availability and experience bonuses', () => {
    const output = scoreDoctor({
      yearsOfExperience: 11,
      nextAvailableAt: new Date('2026-09-21T10:00:00.000Z'), // within 48h
      specializations: [
        { name: 'Cardiology', weight: 9 },
        { name: 'Internal Medicine', weight: 5 },
      ],
      now,
    });
    expect(output.specializations).toHaveLength(2);
    expect(output.availabilityBonus).toBe(3);
    expect(output.experienceBonus).toBeCloseTo(1.5, 2);
    expect(output.score).toBeCloseTo(18.5, 2);
  });

  it('caps the experience bonus at 10 years', () => {
    const output = scoreDoctor({
      yearsOfExperience: 25,
      nextAvailableAt: null,
      specializations: [{ name: 'Cardiology', weight: 4 }],
      now,
    });
    expect(output.experienceBonus).toBeCloseTo(1.5, 2);
  });

  it('gives no availability bonus when the next slot is far away', () => {
    const output = scoreDoctor({
      yearsOfExperience: 5,
      nextAvailableAt: new Date('2026-09-30T00:00:00.000Z'),
      specializations: [{ name: 'Cardiology', weight: 4 }],
      now,
    });
    expect(output.availabilityBonus).toBe(0);
  });
});

describe('rankByScore', () => {
  it('sorts by score desc, then earliest slot, then id', () => {
    const now = new Date('2026-09-21T00:00:00.000Z');
    const items = [
      { id: 'b', yearsOfExperience: 1, nextAvailableAt: new Date('2026-09-21T10:00:00.000Z'), specializations: [{ name: 'A', weight: 5 }] },
      { id: 'a', yearsOfExperience: 1, nextAvailableAt: new Date('2026-09-21T09:00:00.000Z'), specializations: [{ name: 'A', weight: 5 }] },
      { id: 'c', yearsOfExperience: 1, nextAvailableAt: null, specializations: [{ name: 'A', weight: 9 }] },
    ];
    const ranked = rankByScore(
      items,
      (item) =>
        scoreDoctor({
          yearsOfExperience: item.yearsOfExperience,
          nextAvailableAt: item.nextAvailableAt,
          specializations: item.specializations,
          now,
        }),
      (item) => item.nextAvailableAt?.getTime() ?? null,
    );
    expect(ranked.map((r) => r.item.id)).toEqual(['c', 'a', 'b']);
  });
});
