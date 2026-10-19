/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KibanaRole, ScoutPage } from '@kbn/scout-oblt';
import { expect } from '@kbn/scout-oblt/ui';
import { test } from '../fixtures';
import type { ObservabilityAlertingPage } from '../fixtures/page_objects';
import {
  setAlertingV2EnabledSetting,
  unsetAlertingV2EnabledSetting,
} from '../fixtures/alerting_v2_setting';
import { deleteRuleTemplate, seedRuleTemplate } from '../fixtures/rule_template_data';
import { OBSERVABILITY_ALERTING_ALERTS_PATH } from '../../../../public/constants';

const READER_ES_PRIVILEGES: KibanaRole['elasticsearch'] = {
  cluster: [],
  indices: [{ names: ['*'], privileges: ['read', 'view_index_metadata'] }],
};

const kibanaRoleWith = (feature: Record<string, string[]>): KibanaRole => ({
  elasticsearch: READER_ES_PRIVILEGES,
  kibana: [{ base: [], feature, spaces: ['*'] }],
});

/** Alerts read keeps the classic Alerting nav section visible so the link has a place to appear. */
const RULES_READ_ROLE = kibanaRoleWith({
  alerting_v2_alerts: ['read'],
  alerting_v2_rules: ['read'],
});

const NO_RULES_ROLE = kibanaRoleWith({ alerting_v2_alerts: ['read'] });

/**
 * Reloads until the nav link count settles on `expected`. The server re-checks template
 * existence at most every few seconds (in both directions), so a template seeded or removed
 * at runtime reaches the capabilities on a later page load rather than immediately.
 */
const expectRuleLibraryNavLinkCount = async (
  page: ScoutPage,
  observabilityAlerting: ObservabilityAlertingPage,
  expected: number
): Promise<void> => {
  await expect
    .poll(
      async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await observabilityAlerting.pageTitle.waitFor({ state: 'visible', timeout: 60_000 });
        return observabilityAlerting.ruleLibraryNavLink.count();
      },
      { timeout: 90_000, intervals: [5_000] }
    )
    .toBe(expected);
};

/**
 * The server serves `alertingVTwo.v2RuleTemplatesAvailable` through core capabilities and
 * re-checks it (throttled), so a template seeded at runtime shows up on a later page load
 * without restarting Kibana. Polling covers that throttle window.
 *
 * Custom-role auth (`browserAuth.loginWithCustomRole`) is not yet supported on Elastic Cloud
 * Hosted, so this suite only runs on local stateful (classic).
 */
test.describe(
  'Observability Alerting - Rule Library nav link',
  { tag: '@local-stateful-classic' },
  () => {
    test.beforeAll(async ({ kbnClient }) => {
      await setAlertingV2EnabledSetting(kbnClient, true);
      await deleteRuleTemplate(kbnClient);
    });

    test.afterEach(async ({ kbnClient }) => {
      await deleteRuleTemplate(kbnClient);
    });

    test.afterAll(async ({ kbnClient }) => {
      await unsetAlertingV2EnabledSetting(kbnClient);
    });

    test('hides the link without templates but keeps Rule Library searchable', async ({
      browserAuth,
      page,
      pageObjects,
    }) => {
      const { observabilityAlerting } = pageObjects;

      await browserAuth.loginWithCustomRole(RULES_READ_ROLE);
      await observabilityAlerting.goto(OBSERVABILITY_ALERTING_ALERTS_PATH);
      await expect(observabilityAlerting.pageTitle).toHaveText('Alerts', { timeout: 60_000 });

      await expectRuleLibraryNavLinkCount(page, observabilityAlerting, 0);

      await observabilityAlerting.searchGlobalNav('Rule Library');
      await expect(
        observabilityAlerting.globalSearchOptions.filter({ hasText: 'Rule Library' })
      ).toBeVisible();
    });

    test('shows the link once a v2 template exists and hides it again when removed', async ({
      browserAuth,
      kbnClient,
      page,
      pageObjects,
    }) => {
      const { observabilityAlerting } = pageObjects;

      await browserAuth.loginWithCustomRole(RULES_READ_ROLE);
      await observabilityAlerting.goto(OBSERVABILITY_ALERTING_ALERTS_PATH);
      await expect(observabilityAlerting.pageTitle).toHaveText('Alerts', { timeout: 60_000 });
      await expectRuleLibraryNavLinkCount(page, observabilityAlerting, 0);

      await seedRuleTemplate(kbnClient);
      await expectRuleLibraryNavLinkCount(page, observabilityAlerting, 1);

      await deleteRuleTemplate(kbnClient);
      await expectRuleLibraryNavLinkCount(page, observabilityAlerting, 0);
    });

    test('hides the link from users without rules read even when a template exists', async ({
      browserAuth,
      kbnClient,
      page,
      pageObjects,
    }) => {
      const { observabilityAlerting } = pageObjects;

      await seedRuleTemplate(kbnClient);

      // A rules-read user seeing the link proves the capability is already true server-side.
      await browserAuth.loginWithCustomRole(RULES_READ_ROLE);
      await observabilityAlerting.goto(OBSERVABILITY_ALERTING_ALERTS_PATH);
      await expectRuleLibraryNavLinkCount(page, observabilityAlerting, 1);

      await browserAuth.loginWithCustomRole(NO_RULES_ROLE);
      await observabilityAlerting.goto(OBSERVABILITY_ALERTING_ALERTS_PATH);
      await expect(observabilityAlerting.pageTitle).toHaveText('Alerts', { timeout: 60_000 });
      await expect(observabilityAlerting.ruleLibraryNavLink).toHaveCount(0);
    });
  }
);
