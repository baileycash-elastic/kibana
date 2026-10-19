/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsServiceStart } from '@kbn/core/server';
import { RULE_TEMPLATE_SAVED_OBJECT_TYPE } from '../../../common/saved_object_types';
import { ALERTING_LOG_CODES } from '../errors/error_codes';
import { buildEngineV2Filter } from '../rule_templates_client';
import type { LoggerServiceContract } from '../services/logger_service/logger_service';

interface RuleTemplatesAvailabilityOptions {
  getSavedObjects: () => SavedObjectsServiceStart;
  logger: LoggerServiceContract;
}

/**
 * Tracks whether at least one v2 rule template exists in any space, using an internal
 * saved objects client so the answer does not depend on the requesting user.
 *
 * The check runs once, from `start()`. It is never repeated, so templates installed or
 * removed afterwards are only reflected after the next Kibana restart.
 */
export class RuleTemplatesAvailability {
  private readonly getSavedObjects: () => SavedObjectsServiceStart;
  private readonly logger: LoggerServiceContract;

  private startupCheck: Promise<boolean> | undefined;

  constructor({ getSavedObjects, logger }: RuleTemplatesAvailabilityOptions) {
    this.getSavedObjects = getSavedObjects;
    this.logger = logger;
  }

  /** Runs the startup check without waiting for it. Failures are logged, never thrown. */
  public start(): void {
    this.startupCheck ??= this.queryTemplateExistence();
  }

  /**
   * Resolves with the startup result, waiting for it if it is still running. Resolves `false`
   * if `start()` has not run, because the saved objects start contract may not be ready.
   */
  public isAvailable(): Promise<boolean> {
    return this.startupCheck ?? Promise.resolve(false);
  }

  private async queryTemplateExistence(): Promise<boolean> {
    try {
      const client = this.getSavedObjects().getUnsafeInternalClient({
        includedHiddenTypes: [RULE_TEMPLATE_SAVED_OBJECT_TYPE],
      });
      const { total } = await client.find({
        type: RULE_TEMPLATE_SAVED_OBJECT_TYPE,
        namespaces: ['*'],
        filter: buildEngineV2Filter(),
        perPage: 0,
      });

      return total > 0;
    } catch (error) {
      this.logger.warn({
        message: 'Failed to check whether any v2 rule template exists',
        error,
        code: ALERTING_LOG_CODES.SAVED_OBJECTS_RULE_TEMPLATES_AVAILABILITY_CHECK_FAILED,
        labels: { resource: RULE_TEMPLATE_SAVED_OBJECT_TYPE },
      });

      return false;
    }
  }
}
