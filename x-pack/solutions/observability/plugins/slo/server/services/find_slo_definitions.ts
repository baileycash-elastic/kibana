/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  FindSLODefinitionsParams,
  FindSLODefinitionsResponse,
  Pagination,
} from '@kbn/slo-schema';
import { findSloDefinitionsResponseSchema } from '@kbn/slo-schema';
import type { IScopedClusterClient } from '@kbn/core/server';
import { IllegalArgumentError } from '../errors';
import { GetSLOHealth } from './get_slo_health';
import type { SLORepository } from './slo_repository';

const MAX_PER_PAGE = 1000;
const DEFAULT_PER_PAGE = 100;
const DEFAULT_PAGE = 1;

export class FindSLODefinitions {
  constructor(
    private repository: SLORepository,
    private scopedClusterClient: IScopedClusterClient
  ) {}

  public async execute(params: FindSLODefinitionsParams): Promise<FindSLODefinitionsResponse> {
    const requestTags: string[] = params.tags?.split(',') ?? [];

    const result = await this.repository.search(params.search ?? '', toPagination(params), {
      includeOutdatedOnly: params.includeOutdatedOnly === true,
      tags: requestTags,
    });

    if (params.getHealth) {
      const getSloHealthData = new GetSLOHealth(this.scopedClusterClient);
      const slos = result.results.map((slo) => ({
        sloId: slo.id,
        sloInstanceId: '*',
      }));
      const healthData = await getSloHealthData.execute({ list: slos });
      result.results = result.results.map((slo) => {
        const sloHealthData = healthData.data.find(
          (health: { sloId: string }) => health.sloId === slo.id
        );
        return {
          ...slo,
          health: sloHealthData?.health,
          state: sloHealthData?.state,
        };
      });
    }
    return findSloDefinitionsResponseSchema.encode(result);
  }
}

function toPagination(params: FindSLODefinitionsParams): Pagination {
  const page = Number(params.page);
  const perPage = Number(params.perPage);

  if (!isNaN(perPage) && perPage > MAX_PER_PAGE) {
    throw new IllegalArgumentError(`perPage limit set to ${MAX_PER_PAGE}`);
  }

  return {
    page: !isNaN(page) && page >= 1 ? page : DEFAULT_PAGE,
    perPage: !isNaN(perPage) && perPage >= 1 ? perPage : DEFAULT_PER_PAGE,
  };
}
