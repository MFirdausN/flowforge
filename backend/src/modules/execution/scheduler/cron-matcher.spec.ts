import { CronMatcher } from './cron-matcher';

describe('CronMatcher', () => {
  const matcher = new CronMatcher();
  const date = new Date('2026-04-23T10:15:00');

  it('matches wildcard expressions', () => {
    expect(matcher.matches('* * * * *', date)).toBe(true);
  });

  it('matches exact minute and hour expressions', () => {
    expect(matcher.matches('15 10 * * *', date)).toBe(true);
    expect(matcher.matches('16 10 * * *', date)).toBe(false);
  });

  it('supports ranges, lists, and steps', () => {
    expect(matcher.matches('*/5 9-11 * * 4,5', date)).toBe(true);
  });

  it('rejects malformed expressions', () => {
    expect(matcher.isValid('* * *')).toBe(false);
    expect(matcher.isValid('99 * * * *')).toBe(false);
    expect(matcher.isValid('*/0 * * * *')).toBe(false);
  });
});
