/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { coreMock, httpServerMock } from '@kbn/core/server/mocks';
import type { CapabilitiesSwitcher } from '@kbn/core/server';
import type { RuleTemplatesAvailability } from './rule_templates_availability';
import { registerRuleTemplatesCapabilities } from './register_capabilities';

describe('registerRuleTemplatesCapabilities', () => {
  const isAvailable = jest.fn<Promise<boolean>, []>();
  const availability = { isAvailable } as unknown as RuleTemplatesAvailability;
  const request = httpServerMock.createKibanaRequest();
  const uiCapabilities = { navLinks: {}, management: {}, catalogue: {} };

  const register = () => {
    const { capabilities } = coreMock.createSetup();
    registerRuleTemplatesCapabilities({ capabilities, availability });

    const [provider] = capabilities.registerProvider.mock.calls[0];
    const [switcher, options] = capabilities.registerSwitcher.mock.calls[0];

    return { provider, switcher: switcher as CapabilitiesSwitcher, options };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('declares the capability as false by default', () => {
    expect(register().provider()).toEqual({ alertingVTwo: { v2RuleTemplatesAvailable: false } });
  });

  it('scopes the switcher to the alertingVTwo section', () => {
    expect(register().options).toEqual({ capabilityPath: 'alertingVTwo.*' });
  });

  it.each([true, false])(
    'switches the capability to %s from the availability check',
    async (value) => {
      isAvailable.mockResolvedValue(value);

      await expect(register().switcher(request, uiCapabilities, false)).resolves.toEqual({
        alertingVTwo: { v2RuleTemplatesAvailable: value },
      });
    }
  );

  it('keeps default capabilities without checking availability', async () => {
    await expect(register().switcher(request, uiCapabilities, true)).resolves.toEqual({});

    expect(isAvailable).not.toHaveBeenCalled();
  });
});
