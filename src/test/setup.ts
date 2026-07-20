import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Recharts ResponsiveContainer needs ResizeObserver in jsdom
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
