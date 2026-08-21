/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEffect, useMemo } from 'react';
import { useQuery } from '@kbn/react-query';
import type { HttpStart } from '@kbn/core/public';
import type { DataViewsPublicPluginStart } from '@kbn/data-views-plugin/public';
import { getESQLTimeField } from '@kbn/esql-utils';
import type { ISearchGeneric } from '@kbn/search-types';
import { resolveTimeField } from '@kbn/alerting-v2-utils';
import { useDataFields } from '../../form/hooks/use_data_fields';
import { isDateLikeFieldType } from '../../form/utils';
import { ruleFormKeys } from '../../form/hooks/query_key_factory';
import { extractFromSourceQuery } from './extract_from_source_query';

interface UseResolveTimeFieldParams {
  /** Full ES|QL query or FROM-only query used to resolve index date fields. */
  query: string;
  timeField: string;
  onTimeFieldChange?: (timeField: string) => void;
  http: HttpStart;
  dataViews: DataViewsPublicPluginStart;
  /**
   * When provided, ES|QL column introspection is used for field discovery instead
   * of the DataView field-caps API. Preferred for all ES|QL sources because it
   * reflects the actual schema the query will return; required for federated sources
   * that don't exist as Elasticsearch indices.
   */
  search?: ISearchGeneric;
  /** When false, skips field resolution and auto-correction. Defaults to true. */
  enabled?: boolean;
}

export interface TimeFieldOption {
  value: string;
  text: string;
}

/**
 * pending       – no source query, or discovery in flight.
 * unverified    – discovery failed; the current selection is kept but unchecked.
 * no_candidates – discovery succeeded and the source has no date field.
 * resolved      – `timeFieldOptions` holds the selectable date fields.
 */
export type TimeFieldStatus = 'pending' | 'unverified' | 'no_candidates' | 'resolved';

export interface TimeFieldResolution {
  status: TimeFieldStatus;
  /** Selectable date fields. Always empty unless `status` is `resolved`. */
  timeFieldOptions: TimeFieldOption[];
  /** Field the hook would auto-select; `null` when none can be resolved. */
  resolvedTimeField: string | null;
}

export interface TimeFieldSelectState {
  options: TimeFieldOption[];
  /** `''` whenever the current value isn't selectable, so the select shows a placeholder. */
  value: string;
  hasNoInitialSelection: boolean;
  isDisabled: boolean;
  isInvalid: boolean;
  /** Whether the current selection is trustworthy enough to execute a query with. */
  isExecutable: boolean;
}

export const getTimeFieldSelectState = (
  { status, timeFieldOptions }: TimeFieldResolution,
  timeField: string
): TimeFieldSelectState => {
  const currentIsOption = timeFieldOptions.some((option) => option.value === timeField);

  return {
    options: timeFieldOptions,
    value: currentIsOption ? timeField : '',
    hasNoInitialSelection: !currentIsOption,
    isDisabled: status === 'pending',
    isInvalid: status === 'no_candidates' || (status === 'resolved' && !currentIsOption),
    // `unverified` means discovery errored: keep the saved field runnable rather
    // than blocking the preview on a failure we couldn't confirm.
    isExecutable:
      (status === 'resolved' && currentIsOption) || (status === 'unverified' && timeField !== ''),
  };
};

/**
 * Resolves the correct time field for an ES|QL rule by inspecting the source
 * index (FROM-only query). Falls back to the ES|QL timefield API when field
 * caps return no date fields. Auto-corrects `timeField` when it does not
 * exist on the index (e.g. default `@timestamp` on `kibana_sample_data_flights`).
 */
export const useResolveTimeField = ({
  query,
  timeField,
  onTimeFieldChange,
  http,
  dataViews,
  search,
  enabled = true,
}: UseResolveTimeFieldParams): TimeFieldResolution => {
  const fromSourceQuery = useMemo(() => extractFromSourceQuery(query), [query]);
  const resolutionQuery = enabled ? fromSourceQuery : '';

  const {
    data: fieldMap,
    isLoading: isLoadingFields,
    isError: isFieldMapError,
  } = useDataFields({
    query: resolutionQuery,
    http,
    dataViews,
    search,
  });

  const dateFields = useMemo(
    () =>
      Object.values(fieldMap)
        .filter((f) => isDateLikeFieldType(f.type))
        .map((f) => f.name)
        .sort(),
    [fieldMap]
  );

  const needsApiTimeField =
    enabled && Boolean(fromSourceQuery) && !isLoadingFields && dateFields.length === 0;

  const { data: apiTimeField, isLoading: isLoadingApiTimeField } = useQuery({
    queryKey: ruleFormKeys.composeDiscoverApiTimeField(fromSourceQuery),
    queryFn: () => getESQLTimeField({ query: fromSourceQuery, http }),
    enabled: needsApiTimeField,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Candidate date fields: field caps when available, otherwise the single
  // field the ES|QL API inferred from the query.
  const candidateDateFields = useMemo(
    () => (dateFields.length > 0 ? dateFields : apiTimeField ? [apiTimeField] : []),
    [dateFields, apiTimeField]
  );

  const resolvedTimeField = useMemo(
    () => resolveTimeField({ dateFields: candidateDateFields, currentTimeField: timeField }),
    [candidateDateFields, timeField]
  );

  const isLoadingResolution = isLoadingFields || (needsApiTimeField && isLoadingApiTimeField);

  // Field discovery failed and neither the API fallback nor field-caps returned
  // any date fields. We can't distinguish a transient introspection error from a
  // genuinely date-field-free index, so preserve the existing selection rather
  // than clearing it.
  const isDiscoveryErrored = isFieldMapError && candidateDateFields.length === 0;

  const status: TimeFieldStatus = useMemo(() => {
    if (!enabled || !fromSourceQuery || isLoadingResolution) {
      return 'pending';
    }
    if (isDiscoveryErrored) {
      return 'unverified';
    }
    return candidateDateFields.length > 0 ? 'resolved' : 'no_candidates';
  }, [enabled, fromSourceQuery, isLoadingResolution, isDiscoveryErrored, candidateDateFields]);

  const timeFieldOptions = useMemo(
    () =>
      status === 'resolved' ? candidateDateFields.map((name) => ({ value: name, text: name })) : [],
    [status, candidateDateFields]
  );

  useEffect(() => {
    if (!onTimeFieldChange) {
      return;
    }
    // `pending` has nothing to correct towards yet, and `unverified` must not
    // clear a saved field we simply failed to check.
    if (status !== 'resolved' && status !== 'no_candidates') {
      return;
    }
    // Sync the form value to the resolved field. `null` (no resolvable date field
    // on the index, or the current selection isn't valid) clears the value —
    // never fabricate `@timestamp` — so the user is forced to pick and the empty
    // value can be flagged downstream.
    const nextTimeField = resolvedTimeField ?? '';
    if (nextTimeField !== timeField) {
      onTimeFieldChange(nextTimeField);
    }
  }, [status, resolvedTimeField, timeField, onTimeFieldChange]);

  return {
    status,
    timeFieldOptions,
    resolvedTimeField,
  };
};
