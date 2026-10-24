/** Shared light/dark chrome colors for shell surfaces. */
export function chrome(light: boolean) {
  if (light) {
    return {
      barBg: '#ffffff',
      barBgAlt: '#f8fafc',
      barBorder: '#e2e8f0',
      fg: '#0f172a',
      muted: '#64748b',
      faint: '#94a3b8',
      tabOnBd: '#059669',
      tabOnBg: '#ecfdf5',
      tabOnFg: '#047857',
      tabOffFg: '#334155',
      pillBd: '#cbd5e1',
      pillBg: '#ffffff',
      pillFg: '#334155',
      shadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
      menuBg: '#ffffff',
      menuShadow: '0 16px 40px rgba(15, 23, 42, 0.14)'
    };
  }
  return {
    barBg: 'linear-gradient(180deg, rgba(8,47,73,0.98) 0%, rgba(15,23,42,0.99) 55%, rgba(2,6,23,1) 100%)',
    barBgAlt: 'rgba(2,6,23,0.96)',
    barBorder: 'rgba(34,211,238,0.35)',
    fg: '#e2e8f0',
    muted: '#94a3b8',
    faint: '#64748b',
    tabOnBd: 'rgba(52,211,153,0.55)',
    tabOnBg: 'rgba(16,185,129,0.18)',
    tabOnFg: '#6ee7b7',
    tabOffFg: '#e2e8f0',
    pillBd: 'rgba(148,163,184,0.35)',
    pillBg: 'rgba(15,23,42,0.75)',
    pillFg: '#e2e8f0',
    shadow: '0 10px 28px rgba(0,0,0,0.45)',
    menuBg: 'rgba(15,23,42,0.99)',
    menuShadow: '0 16px 40px rgba(0,0,0,0.65)'
  };
}
