/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useController, useFormContext } from 'react-hook-form';
import type { FormValues } from '../../../form/types';
import { validateRecoveryStrategy } from '../validation/recovery_strategy_validation';

/**
 * Always-mounted registration for the `recoveryStrategy` field so
 * `trigger(['recoveryStrategy'])` works even when the Outcome step is not the
 * visible step, and so submit-time validation runs from any step.
 */
export const RecoveryFieldRules = (): null => {
  const { control, getValues } = useFormContext<FormValues>();

  useController({
    name: 'recoveryStrategy',
    control,
    rules: {
      validate: (value) => validateRecoveryStrategy(value, getValues('kind'), getValues('query')),
    },
  });

  return null;
};
