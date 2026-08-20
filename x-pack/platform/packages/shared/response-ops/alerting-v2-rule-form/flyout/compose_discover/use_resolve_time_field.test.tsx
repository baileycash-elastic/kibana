/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@kbn/react-query';
import type { HttpStart } from '@kbn/core/public';
import type { DataViewsPublicPluginStart } from '@kbn/data-views-plugin/public';
import { getESQLTimeField } from '@kbn/esql-utils';
import { createTestQueryClient } from '../../test_utils';
import { useDataFields } from '../../form/hooks/use_data_fields';
import { ruleFormKeys } from '../../form/hooks/query_key_factory';
import { getTimeFieldSelectState, useResolveTimeField } from './use_resolve_time_field';

jest.mock('@kbn/esql-utils', () => ({
  ...jest.requireActual('@kbn/esql-utils'),
  getESQLTimeField: jest.fn(async () => undefined),
}));

jest.mock('../../form/hooks/use_data_fields', () => ({
  useDataFields: jest.fn(() => ({ data: {}, isLoading: false })),
}));

const FLIGHTS_QUERY =
  'FROM kibana_sample_data_flights | STATS COUNT(*) BY timestamp | WHERE Cancelled == "true"';

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const defaultParams = {
  query: FLIGHTS_QUERY,
  timeField: '@timestamp',
  http: {} as HttpStart,
  dataViews: {} as DataViewsPublicPluginStart,
};

describe('useResolveTimeField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useDataFields as jest.Mock).mockReturnValue({ data: {}, isLoading: false });
    (getESQLTimeField as jest.Mock).mockResolvedValue(undefined);
  });

  it('clears an invalid current field (does not substitute) but offers the real field for selection', async () => {
    const onTimeFieldChange = jest.fn();
    (useDataFields as jest.Mock).mockReturnValue({
      data: {
        timestamp: { name: 'timestamp', type: 'date', searchable: true, aggregatable: true },
      },
      isLoading: false,
    });

    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.timeFieldOptions).toEqual([{ value: 'timestamp', text: 'timestamp' }]);
    });
    // Current field `@timestamp` is not on the index: clear it (never substitute
    // `timestamp`) so the user is forced to pick.
    expect(onTimeFieldChange).toHaveBeenCalledWith('');
    expect(result.current.status).toBe('resolved');
    expect(getTimeFieldSelectState(result.current, '@timestamp').isInvalid).toBe(true);
  });

  it('offers the ES|QL timefield API result as an option but clears the invalid current field', async () => {
    const onTimeFieldChange = jest.fn();
    (getESQLTimeField as jest.Mock).mockResolvedValue('timestamp');

    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(getESQLTimeField).toHaveBeenCalledWith({
        query: 'FROM kibana_sample_data_flights',
        http: defaultParams.http,
      });
      expect(result.current.timeFieldOptions).toEqual([{ value: 'timestamp', text: 'timestamp' }]);
    });
    expect(onTimeFieldChange).toHaveBeenCalledWith('');
    expect(result.current.status).toBe('resolved');
    expect(getTimeFieldSelectState(result.current, '@timestamp').isInvalid).toBe(true);
  });

  it('does not call onTimeFieldChange when the current time field is valid', async () => {
    const onTimeFieldChange = jest.fn();
    (useDataFields as jest.Mock).mockReturnValue({
      data: {
        '@timestamp': { name: '@timestamp', type: 'date', searchable: true, aggregatable: true },
      },
      isLoading: false,
    });

    renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: '@timestamp',
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(onTimeFieldChange).not.toHaveBeenCalled();
    });
  });

  it('preserves the saved timeField and reports unverified when field discovery errors', async () => {
    const onTimeFieldChange = jest.fn();
    (useDataFields as jest.Mock).mockReturnValue({
      data: {},
      isLoading: false,
      isError: true,
    });

    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: 'event.start',
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    // API fallback runs (field-caps errored so dateFields is empty)...
    await waitFor(() => {
      expect(getESQLTimeField).toHaveBeenCalled();
    });
    // ...but nothing clears the saved timeField.
    expect(onTimeFieldChange).not.toHaveBeenCalled();
    // The existing selection is treated as unverified-but-valid so the form
    // remains submittable rather than being flagged invalid.
    expect(result.current.status).toBe('unverified');
    expect(getTimeFieldSelectState(result.current, 'event.start').isInvalid).toBe(false);
  });

  it('clears the current field (does not fabricate) when none can be resolved', async () => {
    const onTimeFieldChange = jest.fn();

    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: 'event.start',
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(getESQLTimeField).toHaveBeenCalled();
    });
    expect(onTimeFieldChange).toHaveBeenCalledWith('');
    expect(result.current.status).toBe('no_candidates');
    expect(getTimeFieldSelectState(result.current, 'event.start').isInvalid).toBe(true);
  });

  it('stays no_candidates when no date field exists, even if timeField is @timestamp', async () => {
    // fieldMap is empty and API returns nothing (default mocks in beforeEach).
    // No candidate exists, so no timeField value can be selectable.
    const { result, rerender } = renderHook(
      ({ timeField }: { timeField: string }) =>
        useResolveTimeField({
          ...defaultParams,
          timeField,
        }),
      {
        initialProps: { timeField: 'event.start' },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('no_candidates');
    });

    rerender({ timeField: '@timestamp' });

    // Still no_candidates — no date fields were discovered, so nothing is selectable
    // regardless of which value the form holds.
    await waitFor(() => {
      expect(result.current.status).toBe('no_candidates');
      expect(result.current.timeFieldOptions).toEqual([]);
    });
  });

  it('does not auto-correct while fields are still loading', async () => {
    const onTimeFieldChange = jest.fn();
    (useDataFields as jest.Mock).mockReturnValue({
      data: {},
      isLoading: true,
    });

    renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: 'event.start',
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(onTimeFieldChange).not.toHaveBeenCalled();
    });
  });

  it('does not reset timeField when no query is committed yet', async () => {
    const onTimeFieldChange = jest.fn();

    renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          query: '',
          timeField: 'event.start',
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(onTimeFieldChange).not.toHaveBeenCalled();
    });
  });

  it('does not reset a valid saved timeField to @timestamp while fields are loading', async () => {
    const onTimeFieldChange = jest.fn();
    (useDataFields as jest.Mock).mockReturnValue({ data: {}, isLoading: true });

    renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: 'event.start',
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(onTimeFieldChange).not.toHaveBeenCalled();
    });
  });

  it('does not reset a valid saved timeField to @timestamp while the API fallback is loading', async () => {
    const onTimeFieldChange = jest.fn();
    // No date fields found (triggers API fallback), API still in flight
    (useDataFields as jest.Mock).mockReturnValue({ data: {}, isLoading: false });
    (getESQLTimeField as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: 'event.start',
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(getESQLTimeField).toHaveBeenCalled();
    });

    expect(onTimeFieldChange).not.toHaveBeenCalled();
  });

  it('skips resolution and auto-correction when enabled is false', async () => {
    const onTimeFieldChange = jest.fn();
    (useDataFields as jest.Mock).mockReturnValue({
      data: {
        timestamp: { name: 'timestamp', type: 'date', searchable: true, aggregatable: true },
      },
      isLoading: false,
    });

    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: '@timestamp',
          onTimeFieldChange,
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(useDataFields).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '',
        })
      );
      expect(onTimeFieldChange).not.toHaveBeenCalled();
      expect(getESQLTimeField).not.toHaveBeenCalled();
      expect(result.current.status).toBe('pending');
      expect(result.current.timeFieldOptions).toEqual([]);
    });
  });

  it('reports resolved once correction completes', async () => {
    (useDataFields as jest.Mock).mockReturnValue({
      data: {
        timestamp: { name: 'timestamp', type: 'date', searchable: true, aggregatable: true },
      },
      isLoading: false,
    });

    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: 'timestamp',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('resolved');
      expect(result.current.timeFieldOptions).toEqual([{ value: 'timestamp', text: 'timestamp' }]);
    });
    expect(getTimeFieldSelectState(result.current, 'timestamp').isInvalid).toBe(false);
  });

  it('treats a valid timeField as selectable even when it is not first alphabetically', async () => {
    (useDataFields as jest.Mock).mockReturnValue({
      data: {
        'event.end': { name: 'event.end', type: 'date', searchable: true, aggregatable: true },
        'event.start': { name: 'event.start', type: 'date', searchable: true, aggregatable: true },
      },
      isLoading: false,
    });

    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          timeField: 'event.start',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('resolved');
    });

    expect(getTimeFieldSelectState(result.current, 'event.start')).toMatchObject({
      value: 'event.start',
      isInvalid: false,
      isExecutable: true,
    });
    expect(result.current.timeFieldOptions).toEqual([
      { value: 'event.end', text: 'event.end' },
      { value: 'event.start', text: 'event.start' },
    ]);
  });

  it('withholds options while resolution is in flight so a refetch cannot offer stale fields', async () => {
    (useDataFields as jest.Mock).mockReturnValue({
      data: {
        'event.start': { name: 'event.start', type: 'date', searchable: true, aggregatable: true },
      },
      isLoading: true,
    });

    const { result } = renderHook(
      () => useResolveTimeField({ ...defaultParams, timeField: 'event.start' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('pending');
    });
    expect(result.current.timeFieldOptions).toEqual([]);
  });

  it('reports pending when the query has no source command', async () => {
    const { result } = renderHook(
      () => useResolveTimeField({ ...defaultParams, query: '| WHERE a > 1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('pending');
    });
    expect(result.current.timeFieldOptions).toEqual([]);
  });

  it('uses ruleFormKeys for the API fallback query key', () => {
    expect(ruleFormKeys.composeDiscoverApiTimeField('FROM kibana_sample_data_flights')).toEqual([
      'ruleForm',
      'composeDiscoverApiTimeField',
      'FROM kibana_sample_data_flights',
    ]);
  });

  it('forwards search to useDataFields when provided', () => {
    const mockSearch = jest.fn();

    renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          search: mockSearch as any,
        }),
      { wrapper: createWrapper() }
    );

    expect(useDataFields).toHaveBeenCalledWith(expect.objectContaining({ search: mockSearch }));
  });

  it('does not forward search to useDataFields when not provided', () => {
    renderHook(() => useResolveTimeField({ ...defaultParams }), {
      wrapper: createWrapper(),
    });

    expect(useDataFields).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
  });

  describe('getTimeFieldSelectState', () => {
    const resolved = {
      status: 'resolved' as const,
      timeFieldOptions: [{ value: '@timestamp', text: '@timestamp' }],
      resolvedTimeField: '@timestamp',
    };

    it('disables without flagging invalid while pending', () => {
      expect(
        getTimeFieldSelectState(
          { status: 'pending', timeFieldOptions: [], resolvedTimeField: null },
          '@timestamp'
        )
      ).toEqual({
        options: [],
        value: '',
        hasNoInitialSelection: true,
        isDisabled: true,
        isInvalid: false,
        isExecutable: false,
      });
    });

    it('leaves an unverified selection enabled, unflagged, and executable so the preview still runs', () => {
      expect(
        getTimeFieldSelectState(
          { status: 'unverified', timeFieldOptions: [], resolvedTimeField: null },
          'event.start'
        )
      ).toMatchObject({ isDisabled: false, isInvalid: false, isExecutable: true });
    });

    it('is not executable when unverified with no saved time field', () => {
      expect(
        getTimeFieldSelectState(
          { status: 'unverified', timeFieldOptions: [], resolvedTimeField: null },
          ''
        )
      ).toMatchObject({ isDisabled: false, isInvalid: false, isExecutable: false });
    });

    it('flags invalid but stays enabled when the source has no date field', () => {
      expect(
        getTimeFieldSelectState(
          { status: 'no_candidates', timeFieldOptions: [], resolvedTimeField: null },
          '@timestamp'
        )
      ).toMatchObject({ isDisabled: false, isInvalid: true, isExecutable: false });
    });

    it('is executable only when the current value is one of the resolved options', () => {
      expect(getTimeFieldSelectState(resolved, '@timestamp')).toMatchObject({
        value: '@timestamp',
        hasNoInitialSelection: false,
        isInvalid: false,
        isExecutable: true,
      });
      expect(getTimeFieldSelectState(resolved, 'event.start')).toMatchObject({
        value: '',
        hasNoInitialSelection: true,
        isInvalid: true,
        isExecutable: false,
      });
    });
  });

  it('recognizes date_nanos fields as temporal and offers them for selection', async () => {
    const onTimeFieldChange = jest.fn();
    (useDataFields as jest.Mock).mockReturnValue({
      data: {
        event_time: {
          name: 'event_time',
          type: 'date_nanos',
          searchable: true,
          aggregatable: true,
        },
      },
      isLoading: false,
    });

    // defaultParams has timeField: '@timestamp' which is not on this index.
    // The hook clears the invalid field (does not auto-pick) and surfaces event_time
    // as an option for the user to select.
    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(onTimeFieldChange).toHaveBeenCalledWith('');
    });
    expect(result.current.timeFieldOptions).toEqual([{ value: 'event_time', text: 'event_time' }]);
    expect(result.current.status).toBe('resolved');
    expect(getTimeFieldSelectState(result.current, '@timestamp').isInvalid).toBe(true);
  });

  it('recognizes ES|QL datetime columns as temporal and offers them for selection', async () => {
    const onTimeFieldChange = jest.fn();
    (useDataFields as jest.Mock).mockReturnValue({
      data: {
        event_time: {
          name: 'event_time',
          type: 'datetime',
          searchable: true,
          aggregatable: true,
        },
      },
      isLoading: false,
    });

    // defaultParams has timeField: '@timestamp' which is not on this index.
    // The hook clears the invalid field (does not auto-pick) and surfaces event_time
    // as an option for the user to select.
    const { result } = renderHook(
      () =>
        useResolveTimeField({
          ...defaultParams,
          onTimeFieldChange,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(onTimeFieldChange).toHaveBeenCalledWith('');
    });
    expect(result.current.timeFieldOptions).toEqual([{ value: 'event_time', text: 'event_time' }]);
    expect(result.current.status).toBe('resolved');
    expect(getTimeFieldSelectState(result.current, '@timestamp').isInvalid).toBe(true);
  });
});
