/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ParsedTechnicalFields } from '@kbn/rule-registry-plugin/common/parse_technical_fields';

export type AsDuration = (
  value: number | null | undefined,
  options?: { defaultValue?: string; extended?: boolean }
) => string;

export type AsPercent = (
  numerator: number | null | undefined,
  denominator: number | undefined,
  fallbackResult?: string
) => string;

export type ObservabilityRuleTypeFormatter = (options: {
  fields: ParsedTechnicalFields & Record<string, any>;
  formatters: { asDuration: AsDuration; asPercent: AsPercent };
}) => { reason: string; link?: string; hasBasePath?: boolean };

/**
 * Slim formatter-only registry owned by observability_shared.
 * Does not depend on triggersActionsUi — rule type model registration
 * (into the UI rule type registry) is handled by the full registry in
 * the observability plugin.
 */
export const createObservabilityFormatterRegistry = () => {
  const formatters: Array<{
    typeId: string;
    priority: number;
    fn: ObservabilityRuleTypeFormatter;
  }> = [];

  return {
    register: (typeId: string, fn: ObservabilityRuleTypeFormatter, priority = 0) => {
      formatters.push({ typeId, priority, fn });
    },
    getFormatter: (typeId: string) => {
      return formatters.find((formatter) => formatter.typeId === typeId)?.fn;
    },
    list: () =>
      formatters.sort((a, b) => b.priority - a.priority).map((formatter) => formatter.typeId),
  };
};

export type ObservabilityFormatterRegistry = ReturnType<
  typeof createObservabilityFormatterRegistry
>;

/** Minimal interface required by parseAlert — satisfied by both ObservabilityFormatterRegistry and ObservabilityRuleTypeRegistry */
export interface AlertFormatterLookup {
  getFormatter: (typeId: string) => ObservabilityRuleTypeFormatter | undefined;
}
