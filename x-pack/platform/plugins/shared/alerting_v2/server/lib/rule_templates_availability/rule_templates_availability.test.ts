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

const findResponse = (total: number) => ({
  saved_objects: [],
  total,
  page: 1,
  per_page: 0,
});

describe('RuleTemplatesAvailability', () => {
  const savedObjects = savedObjectsServiceMock.createStartContract();
  const internalClient = savedObjectsClientMock.create();
  const { loggerService, mockLogger } = createLoggerService();

  const createAvailability = () =>
    new RuleTemplatesAvailability({ getSavedObjects: () => savedObjects, logger: loggerService });

  beforeEach(() => {
    jest.clearAllMocks();
    savedObjects.getUnsafeInternalClient.mockReturnValue(internalClient);
    internalClient.find.mockResolvedValue(findResponse(0));
  });

  it('queries v2 templates in every space with the internal client', async () => {
    internalClient.find.mockResolvedValue(findResponse(1));
    const availability = createAvailability();

    availability.start();
    await expect(availability.isAvailable()).resolves.toBe(true);

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
    const availability = createAvailability();

    availability.start();

    await expect(availability.isAvailable()).resolves.toBe(false);
  });

  it('runs the check as soon as it is started, without waiting for it', () => {
    createAvailability().start();

    expect(internalClient.find).toHaveBeenCalledTimes(1);
  });

  it('reports false without querying before it is started', async () => {
    const availability = createAvailability();

    await expect(availability.isAvailable()).resolves.toBe(false);

    expect(savedObjects.getUnsafeInternalClient).not.toHaveBeenCalled();
    expect(internalClient.find).not.toHaveBeenCalled();
  });

  it('runs the check exactly once and never re-checks', async () => {
    internalClient.find.mockResolvedValue(findResponse(1));
    const availability = createAvailability();

    availability.start();
    availability.start();
    await availability.isAvailable();
    internalClient.find.mockResolvedValue(findResponse(0));
    await expect(availability.isAvailable()).resolves.toBe(true);

    expect(internalClient.find).toHaveBeenCalledTimes(1);
  });

  it('keeps reporting false for templates installed after startup', async () => {
    const availability = createAvailability();

    availability.start();
    await expect(availability.isAvailable()).resolves.toBe(false);
    internalClient.find.mockResolvedValue(findResponse(2));

    await expect(availability.isAvailable()).resolves.toBe(false);
    expect(internalClient.find).toHaveBeenCalledTimes(1);
  });

  it('makes callers that arrive during the startup check wait for its result', async () => {
    let resolveFind: (value: ReturnType<typeof findResponse>) => void = () => {};
    internalClient.find.mockReturnValue(
      new Promise((resolve) => {
        resolveFind = resolve;
      })
    );
    const availability = createAvailability();

    availability.start();
    const results = Promise.all([availability.isAvailable(), availability.isAvailable()]);
    resolveFind(findResponse(1));

    await expect(results).resolves.toEqual([true, true]);
    expect(internalClient.find).toHaveBeenCalledTimes(1);
  });

  it('logs a warning and reports false when the check fails, without retrying', async () => {
    internalClient.find.mockRejectedValue(new Error('type is not registered'));
    const availability = createAvailability();

    availability.start();

    await expect(availability.isAvailable()).resolves.toBe(false);
    await expect(availability.isAvailable()).resolves.toBe(false);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        labels: expect.objectContaining({
          code: ALERTING_LOG_CODES.SAVED_OBJECTS_RULE_TEMPLATES_AVAILABILITY_CHECK_FAILED,
        }),
      })
    );
    expect(internalClient.find).toHaveBeenCalledTimes(1);
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
