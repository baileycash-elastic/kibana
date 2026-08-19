/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EpisodeEventRow } from '@kbn/alerting-v2-common-queries';
import { ALERT_EPISODE_STATUS, type AlertEpisodeStatus } from '@kbn/alerting-v2-schemas';
import { deriveAlertTimelineData } from './derive_alert_timeline_data';
import type { AlertTimelinePhaseRow, AlertTimelineSeries } from './types';

const VALID_STATUSES: ReadonlySet<string> = new Set(Object.values(ALERT_EPISODE_STATUS));

const isValidStatus = (status: string): status is AlertEpisodeStatus => VALID_STATUSES.has(status);

/**
 * Collapses one episode's raw ascending-by-timestamp events into contiguous status
 * runs. Unlike the server-side phase aggregation (`buildEpisodePhasesQuery`, grouped
 * `BY episode.status` with no regard for contiguity), non-contiguous runs of the same
 * status are kept as separate phases here — so an oscillating (flapping) episode
 * produces alternating segments instead of collapsing into one span.
 */
const toContiguousPhaseRows = (eventRows: EpisodeEventRow[]): AlertTimelinePhaseRow[] => {
  const sorted = [...eventRows].sort(
    (a, b) => Date.parse(a['@timestamp']) - Date.parse(b['@timestamp'])
  );

  const phases: AlertTimelinePhaseRow[] = [];
  let currentStatus: AlertEpisodeStatus | undefined;
  let currentStartIso: string | undefined;
  let currentEndIso: string | undefined;
  let episodeId = '';
  let groupHash = '';

  const flushCurrentRun = () => {
    if (
      currentStatus !== undefined &&
      currentStartIso !== undefined &&
      currentEndIso !== undefined
    ) {
      phases.push({
        'episode.id': episodeId,
        'episode.status': currentStatus,
        group_hash: groupHash,
        seg_start: currentStartIso,
        seg_end: currentEndIso,
      });
    }
  };

  for (const row of sorted) {
    const status = row['episode.status'];
    const ts = row['@timestamp'];
    if (!ts || Number.isNaN(Date.parse(ts)) || !isValidStatus(status)) continue;

    episodeId = row['episode.id'];
    groupHash = row.group_hash;

    if (status === currentStatus) {
      currentEndIso = ts;
    } else {
      flushCurrentRun();
      currentStatus = status;
      currentStartIso = ts;
      currentEndIso = ts;
    }
  }
  flushCurrentRun();

  return phases;
};

const EMPTY_SUMMARY = {
  episodesStarted: 0,
  recovered: 0,
  stillOpen: 0,
  medianDurationMs: 0,
};

export interface EpisodeLifecycleRow {
  row: AlertTimelineSeries;
  windowStartMs: number;
  windowEndMs: number;
}

/**
 * Derives a single Gantt lane for one episode directly from its raw `.rule-events`
 * rows (the same rows already fetched for the severity heatmap), rather than the
 * lossy server-side phase aggregation used by the rule-level alert activity
 * timeline. Reuses `deriveAlertTimelineData` for segment/transition geometry.
 *
 * An episode still in an open status (anything but INACTIVE) has its final segment
 * tail to `nowMs`, so an ongoing episode's bar reflects elapsed duration rather than
 * stopping dead at its last recorded event. Returns the window bounds alongside the
 * row so a consumer renders `AlertTimelineRow` against the exact same domain the
 * segments were clipped to — computing `nowMs` again independently at render time
 * could disagree and clip the open segment's rendered edge.
 */
export const deriveEpisodeLifecycleRow = (
  eventRows: EpisodeEventRow[],
  nowMs: number
): EpisodeLifecycleRow | undefined => {
  const phaseRows = toContiguousPhaseRows(eventRows);
  if (phaseRows.length === 0) return undefined;

  const windowStartMs = Date.parse(phaseRows[0].seg_start);
  const lastPhase = phaseRows[phaseRows.length - 1];
  const lastEventMs = Date.parse(lastPhase.seg_end);
  const isOpen = lastPhase['episode.status'] !== ALERT_EPISODE_STATUS.INACTIVE;
  const windowEndMs = isOpen ? Math.max(lastEventMs, nowMs) : lastEventMs;

  const { rows } = deriveAlertTimelineData(
    phaseRows,
    {},
    'started_asc',
    windowStartMs,
    windowEndMs,
    EMPTY_SUMMARY
  );

  return { row: rows[0], windowStartMs, windowEndMs };
};
