import { describe, expect, it } from 'vitest';

import { formatMoney, initials, markerToneColor, normalizeOrderStatus, orderSectionLabel, parseAmount } from './utils';

describe('admin utils', () => {
  it('normalizes known and unknown statuses', () => {
    expect(normalizeOrderStatus('Review')).toBe('Review');
    expect(normalizeOrderStatus('unknown')).toBe('Draft');
  });

  it('parses and formats amounts', () => {
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('oops')).toBe(0);
    expect(formatMoney(1234)).toBe('1\u00a0234');
  });

  it('formats initials and labels', () => {
    expect(initials('Ivan Petrov')).toBe('IP');
    expect(initials(' single ')).toBe('S');
    expect(orderSectionLabel('InProgress')).toBe('В работе');
  });

  it('maps marker tone colors', () => {
    expect(markerToneColor('blue')).toBe('#4c9cff');
    expect(markerToneColor('green')).toBe('#43bc78');
    expect(markerToneColor('yellow')).toBe('#e5b637');
  });
});
