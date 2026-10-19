/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KibanaRole } from '@kbn/scout-oblt';
import { expect } from '@kbn/scout-oblt/ui';
import { test } from '../fixtures';
import {
  setAlertingV2EnabledSetting,
  unsetAlertingV2EnabledSetting,
} from '../fixtures/alerting_v2_setting';
import { OBSERVABILITY_ALERTING_ALERTS_PATH } from '../../../../public/constants';

const READER_ES_PRIVILEGES: KibanaRole['elasticsearch'] = {
  cluster: [],
  indices: [{ names: ['*'], privileges: ['read', 'view_index_metadata'] }],
};

const kibanaRoleWith = (feature: Record<string, string[]>): KibanaRole => ({
  elasticsearch: READER_ES_PRIVILEGES,
  kibana: [{ base: [], feature, spaces: ['*'] }],
});

/** Alerts read keeps the classic Alerting nav section visible, so a hidden link is a real signal. */
const RULES_READ_ROLE = kibanaRoleWith({
  alerting_v2_alerts: ['read'],
  alerting_v2_rules: ['read'],
});

const NO_RULES_ROLE = kibanaRoleWith({ alerting_v2_alerts: ['read'] });

/*
 * The server resolves `alertingVTwo.v2RuleTemplatesAvailable` once, at Kibana startup, and
 * Scout can neither restart Kibana nor seed saved objects before it boots. This suite
 * therefore covers the default boot, where no v2 rule template exists. The "templates
 * exist" cases are covered by Jest (availability check, capability switcher, nav and
 * deep-link builders).
 *
 * Custom-role auth (`browserAuth.loginWithCustomRole`) is not yet supported on Elastic Cloud
 * Hosted, so this suite only runs on local stateful (classic).
 */
test.describe(
  'Observability Alerting - Rule Library nav link (no templates)',
  { tag: '@local-stateful-classic' },
  () => {
    test.beforeAll(async ({ kbnClient }) => {
      await setAlertingV2EnabledSetting(kbnClient, true);
    });

    test.afterAll(async ({ kbnClient }) => {
      await unsetAlertingV2EnabledSetting(kbnClient);
    });

    test('hides the link but keeps Rule Library searchable for a rules-read user', async ({
      browserAuth,
      pageObjects,
    }) => {
      const { observabilityAlerting } = pageObjects;

      await browserAuth.loginWithCustomRole(RULES_READ_ROLE);
      await observabilityAlerting.goto(OBSERVABILITY_ALERTING_ALERTS_PATH);
      await expect(observabilityAlerting.pageTitle).toHaveText('Alerts', { timeout: 60_000 });

      await expect(observabilityAlerting.ruleLibraryNavLink).toHaveCount(0);

      await observabilityAlerting.searchGlobalNav('Rule Library');
      await expect(
        observabilityAlerting.globalSearchOptions.filter({ hasText: 'Rule Library' })
      ).toBeVisible();
    });

    test('hides the link from a user without rules read', async ({ browserAuth, pageObjects }) => {
      const { observabilityAlerting } = pageObjects;

      await browserAuth.loginWithCustomRole(NO_RULES_ROLE);
      await observabilityAlerting.goto(OBSERVABILITY_ALERTING_ALERTS_PATH);
      await expect(observabilityAlerting.pageTitle).toHaveText('Alerts', { timeout: 60_000 });

      await expect(observabilityAlerting.ruleLibraryNavLink).toHaveCount(0);
    });
  }
);
