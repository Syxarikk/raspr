import { describe, expect, it } from 'vitest';

import { formatMoney, formatStatus, getInitials, getStatusClass } from './format';

describe('format helpers', () => {
  it('maps status values', () => {
    expect(formatStatus('InProgress')).toBe('В работе');
    expect(formatStatus('paid')).toBe('Оплачен');
    expect(formatStatus('unknown')).toBe('unknown');
  });

  it('normalizes status class', () => {
    expect(getStatusClass('on_review')).toBe('status-on-review');
  });

  it('formats money and initials', () => {
    expect(formatMoney(1234)).toBe('1\u00a0234');
    expect(getInitials('Ivan Petrov')).toBe('IP');
  });
});
