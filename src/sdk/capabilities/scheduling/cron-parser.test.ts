import { describe, expect, it } from 'vitest';
import { isValidCron, matchesCron } from './cron-parser.js';

describe('isValidCron', () => {
  it('accepts standard cron expressions', () => {
    expect(isValidCron('* * * * *')).toBe(true);
    expect(isValidCron('0 9 * * 1-5')).toBe(true);
    expect(isValidCron('*/5 * * * *')).toBe(true);
    expect(isValidCron('30 14 1 1 *')).toBe(true);
    expect(isValidCron('0,15,30,45 * * * *')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidCron('')).toBe(false);
    expect(isValidCron('* * *')).toBe(false);
    expect(isValidCron('* * * * * *')).toBe(false);
    expect(isValidCron('abc * * * *')).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(isValidCron('60 * * * *')).toBe(false);
    expect(isValidCron('* 24 * * *')).toBe(false);
    expect(isValidCron('* * 0 * *')).toBe(false);
    expect(isValidCron('* * * 13 *')).toBe(false);
    expect(isValidCron('* * * * 7')).toBe(false);
  });

  it('validates ranges', () => {
    expect(isValidCron('1-5 * * * *')).toBe(true);
    expect(isValidCron('5-1 * * * *')).toBe(false);
  });

  it('validates step values', () => {
    expect(isValidCron('*/5 * * * *')).toBe(true);
    expect(isValidCron('*/0 * * * *')).toBe(false);
    expect(isValidCron('*/61 * * * *')).toBe(false);
  });
});

describe('matchesCron', () => {
  // 2024-03-15 14:30:00 is a Friday (day 5)
  const friday = new Date(2024, 2, 15, 14, 30, 0);

  it('matches wildcard', () => {
    expect(matchesCron('* * * * *', friday)).toBe(true);
  });

  it('matches exact values', () => {
    expect(matchesCron('30 14 15 3 5', friday)).toBe(true);
    expect(matchesCron('0 14 15 3 5', friday)).toBe(false);
  });

  it('matches step values', () => {
    expect(matchesCron('*/10 * * * *', friday)).toBe(true); // 30 % 10 === 0
    expect(matchesCron('*/7 * * * *', friday)).toBe(false); // 30 % 7 !== 0
  });

  it('matches ranges', () => {
    expect(matchesCron('* 12-16 * * *', friday)).toBe(true);
    expect(matchesCron('* 15-23 * * *', friday)).toBe(false);
  });

  it('matches lists', () => {
    expect(matchesCron('15,30,45 * * * *', friday)).toBe(true);
    expect(matchesCron('0,15,45 * * * *', friday)).toBe(false);
  });

  it('rejects invalid cron strings', () => {
    expect(matchesCron('bad', friday)).toBe(false);
    expect(matchesCron('', friday)).toBe(false);
  });
});
