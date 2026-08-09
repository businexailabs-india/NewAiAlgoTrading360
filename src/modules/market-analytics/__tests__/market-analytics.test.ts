import { describe, it, expect } from 'vitest';
import { lightweightChartsProvider } from '../charts/LightweightChartsProvider';

describe('Market Analytics frontend', () => {
  it('chart provider is licensed-fallback labeled', () => {
    expect(lightweightChartsProvider.name).toContain('Fallback');
    expect(lightweightChartsProvider.licenseNote.toLowerCase()).toContain('license');
  });
});
