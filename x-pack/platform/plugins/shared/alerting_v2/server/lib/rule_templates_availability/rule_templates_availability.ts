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

export const DEFAULT_RECHECK_INTERVAL_MS = 10_000;

interface RuleTemplatesAvailabilityOptions {
  getSavedObjects: () => SavedObjectsServiceStart;
  logger: LoggerServiceContract;
  recheckIntervalMs?: number;
  now?: () => number;
}

/**
 * Tracks whether at least one v2 rule template exists in any space, using an internal
 * saved objects client so the answer does not depend on the requesting user.
 *
 * Fleet installs (and uninstalls) templates at runtime, so the answer is re-checked on
 * demand, at most once per interval. A failed check keeps the last known answer.
 */
export class RuleTemplatesAvailability {
  private readonly getSavedObjects: () => SavedObjectsServiceStart;
  private readonly logger: LoggerServiceContract;
  private readonly recheckIntervalMs: number;
  private readonly now: () => number;

  private available = false;
  private lastCheckedAt: number | undefined;
  private inFlight: Promise<boolean> | undefined;

  constructor({
    getSavedObjects,
    logger,
    recheckIntervalMs = DEFAULT_RECHECK_INTERVAL_MS,
    now = Date.now,
  }: RuleTemplatesAvailabilityOptions) {
    this.getSavedObjects = getSavedObjects;
    this.logger = logger;
    this.recheckIntervalMs = recheckIntervalMs;
    this.now = now;
  }

  /** Runs the startup check without waiting for it. Failures are logged, never thrown. */
  public start(): void {
    void this.check();
  }

  public async isAvailable(): Promise<boolean> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const isFresh =
      this.lastCheckedAt !== undefined && this.now() - this.lastCheckedAt < this.recheckIntervalMs;

    return isFresh ? this.available : this.check();
  }

  private check(): Promise<boolean> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.queryTemplateExistence().finally(() => {
      this.lastCheckedAt = this.now();
      this.inFlight = undefined;
    });

    return this.inFlight;
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

      this.available = total > 0;
    } catch (error) {
      this.logger.warn({
        message: 'Failed to check whether any v2 rule template exists',
        error,
        code: ALERTING_LOG_CODES.SAVED_OBJECTS_RULE_TEMPLATES_AVAILABILITY_CHECK_FAILED,
        labels: { resource: RULE_TEMPLATE_SAVED_OBJECT_TYPE },
      });
    }

    return this.available;
  }
}
