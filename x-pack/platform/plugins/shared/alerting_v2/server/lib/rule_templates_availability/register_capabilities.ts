/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CapabilitiesSetup } from '@kbn/core/server';
import {
  ALERTING_V2_RULE_TEMPLATES_AVAILABLE_CAPABILITY,
  ALERTING_V2_SYSTEM_CAPABILITIES_ID,
} from '@kbn/alerting-v2-constants';
import type { RuleTemplatesAvailability } from './rule_templates_availability';

/**
 * Exposes `alertingVTwo.v2RuleTemplatesAvailable` through `core.application.capabilities`.
 * The provider declares the key (switchers can only flip keys that already exist) and the
 * switcher resolves it from the internal, user-independent availability check.
 */
export const registerRuleTemplatesCapabilities = ({
  capabilities,
  availability,
}: {
  capabilities: CapabilitiesSetup;
  availability: RuleTemplatesAvailability;
}): void => {
  capabilities.registerProvider(() => ({
    [ALERTING_V2_SYSTEM_CAPABILITIES_ID]: {
      [ALERTING_V2_RULE_TEMPLATES_AVAILABLE_CAPABILITY]: false,
    },
  }));

  capabilities.registerSwitcher(
    async (_request, _capabilities, useDefaultCapabilities) => {
      if (useDefaultCapabilities) {
        return {};
      }

      return {
        [ALERTING_V2_SYSTEM_CAPABILITIES_ID]: {
          [ALERTING_V2_RULE_TEMPLATES_AVAILABLE_CAPABILITY]: await availability.isAvailable(),
        },
      };
    },
    { capabilityPath: `${ALERTING_V2_SYSTEM_CAPABILITIES_ID}.*` }
  );
};
