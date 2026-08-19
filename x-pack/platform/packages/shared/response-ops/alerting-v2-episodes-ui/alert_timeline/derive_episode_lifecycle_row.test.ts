/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ALERT_EPISODE_STATUS } from '@kbn/alerting-v2-schemas';
import type { EpisodeEventRow } from '@kbn/alerting-v2-common-queries';
import { deriveEpisodeLifecycleRow } from './derive_episode_lifecycle_row';

const iso = (s: string) => new Date(Date.parse(s)).toISOString();
const ms = (s: string) => Date.parse(s);

const event = (overrides: Partial<EpisodeEventRow> = {}): EpisodeEventRow => ({
  '@timestamp': iso('2026-04-05T00:00:00Z'),
  'episode.id': 'ep-1',
  'episode.status': ALERT_EPISODE_STATUS.ACTIVE,
  'rule.id': 'rule-1',
  group_hash: 'gh-1',
  ...overrides,
});

const NOW = ms('2026-04-06T00:00:00Z');

describe('deriveEpisodeLifecycleRow', () => {
  it('returns undefined for no events', () => {
    expect(deriveEpisodeLifecycleRow([], NOW)).toBeUndefined();
  });

  it('ignores events with an unparseable timestamp or unknown status', () => {
    const rows = [
      event({ '@timestamp': 'not-a-date' }),
      event({ 'episode.status': 'bogus' as EpisodeEventRow['episode.status'] }),
      event({ '@timestamp': iso('2026-04-05T00:00:00Z') }),
    ];
    const result = deriveEpisodeLifecycleRow(rows, NOW);
    expect(result?.row.segments).toHaveLength(1);
  });

  it('collapses a single contiguous run into one segment with an open tail to now', () => {
    const rows = [
      event({ '@timestamp': iso('2026-04-05T00:00:00Z') }),
      event({ '@timestamp': iso('2026-04-05T00:10:00Z') }),
      event({ '@timestamp': iso('2026-04-05T00:20:00Z') }),
    ];
    const result = deriveEpisodeLifecycleRow(rows, NOW);

    expect(result?.windowStartMs).toBe(ms('2026-04-05T00:00:00Z'));
    expect(result?.windowEndMs).toBe(NOW);
    expect(result?.row.segments).toEqual([
      expect.objectContaining({
        status: ALERT_EPISODE_STATUS.ACTIVE,
        x0Ms: ms('2026-04-05T00:00:00Z'),
        x1Ms: NOW,
      }),
    ]);
    expect(result?.row.hasOpenEpisode).toBe(true);
  });

  it('preserves flapping as alternating segments instead of collapsing same-status runs', () => {
    const rows = [
      event({
        '@timestamp': iso('2026-04-05T00:00:00Z'),
        'episode.status': ALERT_EPISODE_STATUS.ACTIVE,
      }),
      event({
        '@timestamp': iso('2026-04-05T00:05:00Z'),
        'episode.status': ALERT_EPISODE_STATUS.RECOVERING,
      }),
      event({
        '@timestamp': iso('2026-04-05T00:10:00Z'),
        'episode.status': ALERT_EPISODE_STATUS.ACTIVE,
      }),
      event({
        '@timestamp': iso('2026-04-05T00:15:00Z'),
        'episode.status': ALERT_EPISODE_STATUS.RECOVERING,
      }),
    ];
    const result = deriveEpisodeLifecycleRow(rows, NOW);

    // Four phases -> three bounded segments (the last tails to windowEndMs) and four transition dots.
    expect(result?.row.segments).toHaveLength(4);
    expect(result?.row.segments.map((s) => s.status)).toEqual([
      ALERT_EPISODE_STATUS.ACTIVE,
      ALERT_EPISODE_STATUS.RECOVERING,
      ALERT_EPISODE_STATUS.ACTIVE,
      ALERT_EPISODE_STATUS.RECOVERING,
    ]);
    expect(result?.row.transitions).toHaveLength(4);
  });

  it('draws no bar for a terminal INACTIVE phase and does not extend the window to now', () => {
    const rows = [
      event({
        '@timestamp': iso('2026-04-05T00:00:00Z'),
        'episode.status': ALERT_EPISODE_STATUS.ACTIVE,
      }),
      event({
        '@timestamp': iso('2026-04-05T00:10:00Z'),
        'episode.status': ALERT_EPISODE_STATUS.INACTIVE,
      }),
    ];
    const result = deriveEpisodeLifecycleRow(rows, NOW);

    expect(result?.windowEndMs).toBe(ms('2026-04-05T00:10:00Z'));
    expect(result?.row.segments).toEqual([
      expect.objectContaining({ status: ALERT_EPISODE_STATUS.ACTIVE }),
    ]);
    expect(result?.row.hasOpenEpisode).toBe(false);
  });

  it('handles a single event as one instantaneous open phase', () => {
    const rows = [event({ '@timestamp': iso('2026-04-05T00:00:00Z') })];
    const result = deriveEpisodeLifecycleRow(rows, NOW);

    expect(result?.row.segments).toEqual([
      expect.objectContaining({
        x0Ms: ms('2026-04-05T00:00:00Z'),
        x1Ms: NOW,
      }),
    ]);
  });

  it('sorts out-of-order input by timestamp before collapsing runs', () => {
    const rows = [
      event({
        '@timestamp': iso('2026-04-05T00:10:00Z'),
        'episode.status': ALERT_EPISODE_STATUS.RECOVERING,
      }),
      event({
        '@timestamp': iso('2026-04-05T00:00:00Z'),
        'episode.status': ALERT_EPISODE_STATUS.ACTIVE,
      }),
    ];
    const result = deriveEpisodeLifecycleRow(rows, NOW);

    expect(result?.row.segments.map((s) => s.status)).toEqual([
      ALERT_EPISODE_STATUS.ACTIVE,
      ALERT_EPISODE_STATUS.RECOVERING,
    ]);
  });
});
