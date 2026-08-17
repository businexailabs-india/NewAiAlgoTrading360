import { describe, it, expect } from 'vitest';
import {
  documentTitleForEnv,
  envLabel,
  envShortLabel,
  environmentFromProfile,
  formatUsd,
  formatUsdSigned,
  liveConfirmButtonLabel,
} from '../format';
import type { IBKRConnectionProfile } from '../types';

function profile(environment: IBKRConnectionProfile['environment']): IBKRConnectionProfile {
  return {
    id: `p-${environment.toLowerCase()}`,
    label: environment === 'PAPER' ? 'IBKR Paper DU' : 'IBKR Live U',
    environment,
    accountIds: ['DU123'],
  };
}

describe('environmentFromProfile', () => {
  it('derives PAPER/LIVE only from profile.environment — not a boolean', () => {
    const paper = profile('PAPER');
    const live = profile('LIVE');

    expect(environmentFromProfile(paper)).toBe('PAPER');
    expect(environmentFromProfile(live)).toBe('LIVE');

    // A bare isPaper boolean must not be the source of truth.
    const isPaperFlag = true;
    // @ts-expect-error — deliberately wrong: boolean alone is not an environment
    const confused = environmentFromProfile(isPaperFlag);
    expect(confused).toBeNull();

    // Even if a caller invents { isPaper: true }, without .environment we refuse.
    expect(
      environmentFromProfile({ isPaper: true } as unknown as Pick<IBKRConnectionProfile, 'environment'>)
    ).toBeNull();

    expect(environmentFromProfile(null)).toBeNull();
    expect(environmentFromProfile(undefined)).toBeNull();
  });

  it('paper and live profiles cannot be confused by boolean alone', () => {
    const paperEnv = environmentFromProfile(profile('PAPER'));
    const liveEnv = environmentFromProfile(profile('LIVE'));
    expect(paperEnv).not.toBe(liveEnv);
    expect(envShortLabel(paperEnv)).toBe('PAPER');
    expect(envShortLabel(liveEnv)).toBe('LIVE');
    expect(envLabel(paperEnv)).toContain('PAPER');
    expect(envLabel(liveEnv)).toContain('LIVE');
    expect(documentTitleForEnv(paperEnv)).toBe('[PAPER] US Stocks Trading');
    expect(documentTitleForEnv(liveEnv)).toBe('[LIVE] US Stocks Trading');
  });
});

describe('formatUsd', () => {
  it('formats USD with grouping and sign', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(-99)).toBe('-$99.00');
    expect(formatUsd(null)).toBe('—');
    expect(formatUsdSigned(25)).toBe('+$25.00');
    expect(formatUsdSigned(-3.1)).toBe('-$3.10');
  });
});

describe('liveConfirmButtonLabel', () => {
  it('builds LIVE BUY/SELL share phrase', () => {
    expect(liveConfirmButtonLabel('BUY', 25)).toBe('LIVE BUY 25 SHARES');
    expect(liveConfirmButtonLabel('SELL', 10)).toBe('LIVE SELL 10 SHARES');
  });
});
