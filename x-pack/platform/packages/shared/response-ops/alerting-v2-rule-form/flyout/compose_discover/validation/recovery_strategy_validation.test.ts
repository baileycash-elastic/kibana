/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RuleQuery } from '../../../form/types';
import { validateRecoveryStrategy } from './recovery_strategy_validation';

const composedWithoutRecovery: RuleQuery = {
  format: 'composed',
  base: 'FROM logs-*',
  breach: { segment: '| WHERE count > 100' },
};

const composedWithRecovery: RuleQuery = {
  ...composedWithoutRecovery,
  recovery: { segment: '| WHERE count < 50' },
};

const standaloneWithRecovery: RuleQuery = {
  format: 'standalone',
  breach: { query: 'FROM logs-* | WHERE count > 100' },
  recovery: { query: 'FROM logs-* | WHERE count < 50' },
};

describe('validateRecoveryStrategy', () => {
  it('accepts custom recovery backed by a composed recovery segment', () => {
    expect(validateRecoveryStrategy('query', 'alert', composedWithRecovery)).toBe(true);
  });

  it('accepts custom recovery backed by a standalone recovery query', () => {
    expect(validateRecoveryStrategy('query', 'alert', standaloneWithRecovery)).toBe(true);
  });

  it('rejects custom recovery with no recovery query, which the API would reject', () => {
    expect(validateRecoveryStrategy('query', 'alert', composedWithoutRecovery)).toEqual(
      expect.stringContaining('recovery query')
    );
  });

  it('rejects custom recovery when the recovery segment is only whitespace', () => {
    const query: RuleQuery = { ...composedWithoutRecovery, recovery: { segment: '   ' } };

    expect(validateRecoveryStrategy('query', 'alert', query)).toEqual(
      expect.stringContaining('recovery query')
    );
  });

  it('accepts every non-query strategy, which carries no recovery query', () => {
    expect(validateRecoveryStrategy('no_breach', 'alert', composedWithoutRecovery)).toBe(true);
    expect(validateRecoveryStrategy('none', 'alert', composedWithoutRecovery)).toBe(true);
    expect(validateRecoveryStrategy(undefined, 'alert', composedWithoutRecovery)).toBe(true);
  });

  it('accepts signal rules, which never carry a recovery strategy', () => {
    expect(validateRecoveryStrategy('query', 'signal', composedWithoutRecovery)).toBe(true);
  });
});
