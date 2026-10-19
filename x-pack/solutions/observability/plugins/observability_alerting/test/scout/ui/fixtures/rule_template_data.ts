/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KbnClient } from '@kbn/scout-oblt';

/** Hidden saved object type registered by the alerting plugin and shared by both engines. */
const RULE_TEMPLATE_SAVED_OBJECT_TYPE = 'alerting_rule_template';

export const SCOUT_RULE_TEMPLATE_ID = 'scout-rule-library-nav-template';

/**
 * Templates are normally installed by Fleet packages and have no public write API, so the
 * spec seeds one through the saved objects client, as the alerting_v2 Scout suites do.
 * The server's template existence check only looks at `engine: 'v2'`.
 */
export const seedRuleTemplate = async (kbnClient: KbnClient): Promise<void> => {
  await kbnClient.savedObjects.create({
    type: RULE_TEMPLATE_SAVED_OBJECT_TYPE,
    id: SCOUT_RULE_TEMPLATE_ID,
    overwrite: true,
    attributes: {
      engine: 'v2',
      rule: {
        kind: 'alert',
        metadata: {
          name: '[scout] Rule Library nav template',
          description: 'Seeded so the Rule Library nav link is offered.',
          tags: ['scout'],
        },
        time_field: '@timestamp',
        schedule: { every: '5m', lookback: '15m' },
        query: {
          base: 'FROM logs-* | STATS count = COUNT(*) BY host.name',
          breach: { segment: 'WHERE count > 100' },
        },
        grouping: { fields: ['host.name'] },
        recovery: { strategy: 'no_breach' },
        no_data: { strategy: 'ignore' },
        state_transition: { pending: { count: 0 }, recovering: { count: 0 } },
      },
    },
  });
};

export const deleteRuleTemplate = async (kbnClient: KbnClient): Promise<void> => {
  await kbnClient.savedObjects
    .delete({ type: RULE_TEMPLATE_SAVED_OBJECT_TYPE, id: SCOUT_RULE_TEMPLATE_ID })
    .catch(() => undefined);
};
