/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import {
  allOrAnyString,
  groupingsSchema,
  healthStatusSchema,
  metaSchema,
  remoteSchema,
  sloDefinitionSchema,
  stateSchema,
  summarySchema,
} from '../schema';

const sloWithDataResponseSchema = t.intersection([
  sloDefinitionSchema,
  t.type({ summary: summarySchema, groupings: groupingsSchema, instanceId: allOrAnyString }),
  t.partial({
    meta: metaSchema,
    remote: remoteSchema,
  }),
]);

const sloWithDataWithHealthResponseSchema = t.intersection([
  sloDefinitionSchema,
  t.partial({
    state: stateSchema,
    health: t.type({
      overall: healthStatusSchema,
      rollup: healthStatusSchema,
      summary: healthStatusSchema,
    }),
  }),
]);

type SLODefinitionResponse = t.OutputOf<typeof sloDefinitionSchema>;
type SLODefinitionWithHealthResponse = t.OutputOf<typeof sloWithDataWithHealthResponseSchema>;
type SLOWithSummaryResponse = t.OutputOf<typeof sloWithDataResponseSchema>;

export { sloWithDataResponseSchema };
export type { SLODefinitionResponse, SLOWithSummaryResponse, SLODefinitionWithHealthResponse };
