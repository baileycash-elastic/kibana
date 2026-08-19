/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import {
  EuiEmptyPrompt,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { useKibana } from '@kbn/kibana-react-plugin/public';
import type { ChartsPluginStart } from '@kbn/charts-plugin/public';
import type { EpisodeEventRow } from '@kbn/alerting-v2-common-queries';
import { AlertTimelineRow, deriveEpisodeLifecycleRow } from '../../alert_timeline';
import { useEpisodeFlapping } from '../../hooks/use_episode_flapping';
import { FlappingBadge } from '../flapping/flapping_badge';
import type { AlertEpisodeDetailsServices } from './types';
import * as i18n from './translations';

interface AlertEpisodeLifecycleGanttServices {
  charts: ChartsPluginStart;
}

/** Matches the rule-level alert activity timeline's row height (`alert_timeline_chart.tsx`). */
const ROW_HEIGHT_PX = 44;

const formatCompactTimestamp = (ms: number): string =>
  new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export interface AlertEpisodeLifecycleGanttProps {
  episodeId: string;
  eventRows: EpisodeEventRow[];
  services: Pick<AlertEpisodeDetailsServices, 'data' | 'spaces'>;
}

/**
 * Single-lane, real-time Gantt of one episode's status history, derived client-side
 * from its raw `.rule-events` rows (`deriveEpisodeLifecycleRow`) rather than the
 * lossy server-side phase aggregation used by the rule-level timeline — so an
 * oscillating (flapping) episode renders as distinct alternating segments. The
 * `FlappingBadge` still surfaces the explicit flag next to the title, since a quick
 * skim of the bars doesn't guarantee the viewer notices the oscillation.
 */
export const AlertEpisodeLifecycleGantt = ({
  episodeId,
  eventRows,
  services,
}: AlertEpisodeLifecycleGanttProps) => {
  const { euiTheme } = useEuiTheme();
  const { services: kibanaServices } = useKibana<AlertEpisodeLifecycleGanttServices>();
  const baseTheme = kibanaServices.charts.theme.useChartsBaseTheme();
  const { isFlapping } = useEpisodeFlapping({ episodeId, services });

  const lifecycle = useMemo(() => deriveEpisodeLifecycleRow(eventRows, Date.now()), [eventRows]);

  return (
    <EuiPanel hasShadow={false} paddingSize="none" data-test-subj="alertingV2EpisodeLifecycleGantt">
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap={false}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="xxs">
            <h2>{i18n.EPISODE_LIFECYCLE_TITLE}</h2>
          </EuiTitle>
        </EuiFlexItem>
        {isFlapping && (
          <EuiFlexItem grow={false}>
            <FlappingBadge />
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      {lifecycle ? (
        <>
          <AlertTimelineRow
            row={lifecycle.row}
            windowStartMs={lifecycle.windowStartMs}
            windowEndMs={lifecycle.windowEndMs}
            height={ROW_HEIGHT_PX}
            baseTheme={baseTheme}
          />
          <EuiFlexGroup
            justifyContent="spaceBetween"
            responsive={false}
            gutterSize="none"
            css={css`
              padding-top: ${euiTheme.size.xs};
            `}
          >
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">
                {formatCompactTimestamp(lifecycle.windowStartMs)}
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">
                {formatCompactTimestamp(lifecycle.windowEndMs)}
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      ) : (
        <EuiEmptyPrompt
          title={<h2>{i18n.EPISODE_LIFECYCLE_EMPTY_TITLE}</h2>}
          body={<p>{i18n.EPISODE_LIFECYCLE_EMPTY_BODY}</p>}
        />
      )}
    </EuiPanel>
  );
};
