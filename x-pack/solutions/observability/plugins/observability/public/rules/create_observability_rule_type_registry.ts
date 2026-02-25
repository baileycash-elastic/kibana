/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  RuleTypeModel,
  RuleTypeParams,
  RuleTypeRegistryContract,
} from '@kbn/triggers-actions-ui-plugin/public';
import type {
  ObservabilityFormatterRegistry,
  ObservabilityRuleTypeFormatter,
  AsDuration,
  AsPercent,
} from '@kbn/observability-shared-plugin/public';

export type { ObservabilityRuleTypeFormatter, AsDuration, AsPercent };

export interface ObservabilityRuleTypeModel<Params extends RuleTypeParams = RuleTypeParams>
  extends RuleTypeModel<Params> {
  format: ObservabilityRuleTypeFormatter;
  priority?: number;
}

/**
 * Full registry: registers rule type models into both the UI rule type registry
 * (triggersActionsUi) and the shared formatter registry (observabilityShared).
 */
export const createObservabilityRuleTypeRegistry = (
  formatterRegistry: ObservabilityFormatterRegistry,
  ruleTypeRegistry: RuleTypeRegistryContract
) => {
  return {
    register: (type: ObservabilityRuleTypeModel<any>) => {
      const { format, priority, ...rest } = type;
      formatterRegistry.register(type.id, format, priority ?? 0);
      ruleTypeRegistry.register(rest);
    },
    getFormatter: (typeId: string) => formatterRegistry.getFormatter(typeId),
    list: () => formatterRegistry.list(),
  };
};

export type ObservabilityRuleTypeRegistry = ReturnType<typeof createObservabilityRuleTypeRegistry>;
