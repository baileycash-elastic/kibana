/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { savedObjectsClientMock, savedObjectsServiceMock } from '@kbn/core/server/mocks';
import { RULE_TEMPLATE_SAVED_OBJECT_TYPE } from '../../../common/saved_object_types';
import { ALERTING_LOG_CODES } from '../errors/error_codes';
import { createLoggerService } from '../services/logger_service/logger_service.mock';
import { buildEngineV2Filter } from '../rule_templates_client';
import { RuleTemplatesAvailability } from './rule_templates_availability';

const RECHECK_INTERVAL_MS = 10_000;

const findResponse = (total: number) => ({
  saved_objects: [],
  total,
  page: 1,
  per_page: 0,
});

describe('RuleTemplatesAvailability', () => {
  let currentTime: number;
  const savedObjects = savedObjectsServiceMock.createStartContract();
  const internalClient = savedObjectsClientMock.create();
  const { loggerService, mockLogger } = createLoggerService();

  const createAvailability = () =>
    new RuleTemplatesAvailability({
      getSavedObjects: () => savedObjects,
      logger: loggerService,
      recheckIntervalMs: RECHECK_INTERVAL_MS,
      now: () => currentTime,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    currentTime = 1_000_000;
    savedObjects.getUnsafeInternalClient.mockReturnValue(internalClient);
    internalClient.find.mockResolvedValue(findResponse(0));
  });

  it('queries v2 templates in every space with the internal client', async () => {
    internalClient.find.mockResolvedValue(findResponse(1));

    await expect(createAvailability().isAvailable()).resolves.toBe(true);

    expect(savedObjects.getUnsafeInternalClient).toHaveBeenCalledWith({
      includedHiddenTypes: [RULE_TEMPLATE_SAVED_OBJECT_TYPE],
    });
    expect(internalClient.find).toHaveBeenCalledWith({
      type: RULE_TEMPLATE_SAVED_OBJECT_TYPE,
      namespaces: ['*'],
      filter: buildEngineV2Filter(),
      perPage: 0,
    });
  });

  it('reports false when no v2 template exists', async () => {
    await expect(createAvailability().isAvailable()).resolves.toBe(false);
  });

  it('runs the startup check without waiting for it', async () => {
    internalClient.find.mockResolvedValue(findResponse(1));
    const availability = createAvailability();

    availability.start();

    expect(internalClient.find).toHaveBeenCalledTimes(1);
    await expect(availability.isAvailable()).resolves.toBe(true);
    expect(internalClient.find).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['false', 0],
    ['true', 1],
  ])('does not recheck within the interval while %s', async (_, total) => {
    internalClient.find.mockResolvedValue(findResponse(total));
    const availability = createAvailability();

    await availability.isAvailable();
    currentTime += RECHECK_INTERVAL_MS - 1;
    await expect(availability.isAvailable()).resolves.toBe(total > 0);

    expect(internalClient.find).toHaveBeenCalledTimes(1);
  });

  it('rechecks once the interval has elapsed and picks up templates installed later', async () => {
    const availability = createAvailability();

    await expect(availability.isAvailable()).resolves.toBe(false);

    internalClient.find.mockResolvedValue(findResponse(2));
    currentTime += RECHECK_INTERVAL_MS;

    await expect(availability.isAvailable()).resolves.toBe(true);
    expect(internalClient.find).toHaveBeenCalledTimes(2);
  });

  it('rechecks once the interval has elapsed and notices templates being removed', async () => {
    internalClient.find.mockResolvedValue(findResponse(1));
    const availability = createAvailability();

    await expect(availability.isAvailable()).resolves.toBe(true);

    internalClient.find.mockResolvedValue(findResponse(0));
    currentTime += RECHECK_INTERVAL_MS;

    await expect(availability.isAvailable()).resolves.toBe(false);
    expect(internalClient.find).toHaveBeenCalledTimes(2);
  });

  it('keeps the last known answer when a later check fails', async () => {
    internalClient.find.mockResolvedValue(findResponse(1));
    const availability = createAvailability();

    await expect(availability.isAvailable()).resolves.toBe(true);

    internalClient.find.mockRejectedValue(new Error('es unavailable'));
    currentTime += RECHECK_INTERVAL_MS;

    await expect(availability.isAvailable()).resolves.toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight check between concurrent callers', async () => {
    let resolveFind: (value: ReturnType<typeof findResponse>) => void = () => {};
    internalClient.find.mockReturnValue(
      new Promise((resolve) => {
        resolveFind = resolve;
      })
    );
    const availability = createAvailability();

    const results = Promise.all([
      availability.isAvailable(),
      availability.isAvailable(),
      availability.isAvailable(),
    ]);
    resolveFind(findResponse(1));

    await expect(results).resolves.toEqual([true, true, true]);
    expect(internalClient.find).toHaveBeenCalledTimes(1);
  });

  it('logs a warning and reports false when the check fails, then recovers on a later check', async () => {
    const error = new Error('type is not registered');
    internalClient.find.mockRejectedValueOnce(error);
    const availability = createAvailability();

    await expect(availability.isAvailable()).resolves.toBe(false);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        labels: expect.objectContaining({
          code: ALERTING_LOG_CODES.SAVED_OBJECTS_RULE_TEMPLATES_AVAILABILITY_CHECK_FAILED,
        }),
      })
    );

    internalClient.find.mockResolvedValue(findResponse(1));
    currentTime += RECHECK_INTERVAL_MS;

    await expect(availability.isAvailable()).resolves.toBe(true);
  });

  it('does not throw from the startup check when the saved objects contract throws', async () => {
    savedObjects.getUnsafeInternalClient.mockImplementation(() => {
      throw new Error('boom');
    });
    const availability = createAvailability();

    expect(() => availability.start()).not.toThrow();
    await expect(availability.isAvailable()).resolves.toBe(false);
  });
});
