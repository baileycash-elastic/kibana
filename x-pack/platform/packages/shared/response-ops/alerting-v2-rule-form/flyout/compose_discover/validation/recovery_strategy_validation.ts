/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import type { RecoveryStrategy, RuleKind } from '@kbn/alerting-v2-schemas';
import type { RuleQuery } from '../../../form/types';
import { getRecoverQuery } from '../../../form/utils/query_helpers';

const RECOVERY_QUERY_REQUIRED_ERROR = i18n.translate(
  'xpack.alertingV2.composeDiscover.validation.recoveryQueryRequiredError',
  { defaultMessage: 'Define a recovery query, or choose a different recovery option' }
);

/**
 * RHF `rules.validate` for the `recoveryStrategy` field.
 * Returns `true` when valid, otherwise an i18n error message.
 *
 * The API rejects `recovery_strategy: "query"` without a recovery block, so
 * custom recovery requires a non-empty recovery query. Every other strategy
 * carries no accompanying query, and signal rules carry no strategy at all.
 */
export const validateRecoveryStrategy = (
  recoveryStrategy: RecoveryStrategy | undefined,
  kind: RuleKind,
  query: RuleQuery
): true | string => {
  if (kind !== 'alert' || recoveryStrategy !== 'query') {
    return true;
  }
  return getRecoverQuery(query).trim().length > 0 ? true : RECOVERY_QUERY_REQUIRED_ERROR;
};
