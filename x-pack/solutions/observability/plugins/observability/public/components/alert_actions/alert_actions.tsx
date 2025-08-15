/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiButtonIcon, EuiFlexItem, EuiToolTip } from '@elastic/eui';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { i18n } from '@kbn/i18n';
import { useRouteMatch } from 'react-router-dom';
import { SLO_ALERTS_TABLE_ID } from '@kbn/observability-shared-plugin/common';
import { ALERT_UUID } from '@kbn/rule-data-utils';

import { SLO_DETAIL_PATH } from '../../../common/locators/paths';
import { parseAlert } from '../../pages/alerts/helpers/parse_alert';
import { GetObservabilityAlertsTableProp } from '../..';
import AlertActionsPopover from './alert_actions_popover';

export function AlertActions({
  actionsMenuItems,
  observabilityRuleTypeRegistry,
  alert,
  caseData,
  tableId,
  refresh,
  openAlertInFlyout,
  parentAlert,
  services,
  config,
  ...rest
}: React.ComponentProps<GetObservabilityAlertsTableProp<'renderActionsCell'>>) {
  const {
    http: {
      basePath: { prepend },
    },
  } = services;
  const isSLODetailsPage = useRouteMatch(SLO_DETAIL_PATH);

  const isInApp = Boolean(tableId === SLO_ALERTS_TABLE_ID && isSLODetailsPage);

  const [viewInAppUrl, setViewInAppUrl] = useState<string>();

  const parseObservabilityAlert = useMemo(
    () => parseAlert(observabilityRuleTypeRegistry),
    [observabilityRuleTypeRegistry]
  );

  const observabilityAlert = parseObservabilityAlert(alert);

  useEffect(() => {
    const alertLink = observabilityAlert.link;
    if (!observabilityAlert.hasBasePath && prepend) {
      setViewInAppUrl(prepend(alertLink ?? ''));
    } else {
      setViewInAppUrl(alertLink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewInAppUrl = useCallback(() => {
    const alertLink = observabilityAlert.link as unknown as string;
    if (!observabilityAlert.hasBasePath) {
      setViewInAppUrl(prepend(alertLink ?? ''));
    } else {
      setViewInAppUrl(alertLink);
    }
  }, [observabilityAlert.link, observabilityAlert.hasBasePath, prepend]);

  const onExpandEvent = () => {
    const parsedAlert = parseAlert(observabilityRuleTypeRegistry)(alert);
    openAlertInFlyout?.(parsedAlert.fields[ALERT_UUID]);
  };

  const hideViewInApp = isInApp || viewInAppUrl === '' || parentAlert;

  return (
    <>
      {!parentAlert && (
        <EuiFlexItem>
          <EuiToolTip data-test-subj="expand-event-tool-tip" content={VIEW_DETAILS}>
            <EuiButtonIcon
              data-test-subj="expand-event"
              iconType="expand"
              onClick={onExpandEvent}
              size="s"
              color="text"
            />
          </EuiToolTip>
        </EuiFlexItem>
      )}
      {!hideViewInApp && (
        <EuiFlexItem>
          <EuiToolTip
            content={i18n.translate('xpack.observability.alertsTable.viewInAppTextLabel', {
              defaultMessage: 'View in app',
            })}
            disableScreenReaderOutput
          >
            <EuiButtonIcon
              data-test-subj="o11yAlertActionsButton"
              aria-label={i18n.translate('xpack.observability.alertsTable.viewInAppTextLabel', {
                defaultMessage: 'View in app',
              })}
              color="text"
              onMouseOver={handleViewInAppUrl}
              onClick={() => window.open(viewInAppUrl)}
              iconType="eye"
              size="s"
            />
          </EuiToolTip>
        </EuiFlexItem>
      )}

      <EuiFlexItem
        css={{
          textAlign: 'center',
        }}
        grow={parentAlert ? false : undefined}
      >
        <AlertActionsPopover
          observabilityRuleTypeRegistry={observabilityRuleTypeRegistry}
          alert={alert}
          caseData={caseData}
          tableId={tableId}
          refresh={refresh}
          actionsMenuItems={actionsMenuItems}
          openAlertInFlyout={openAlertInFlyout}
          parentAlert={parentAlert}
          services={services}
          config={config}
          {...rest}
        />
      </EuiFlexItem>
    </>
  );
}

// Default export used for lazy loading
// eslint-disable-next-line import/no-default-export
export default AlertActions;

const VIEW_DETAILS = i18n.translate('xpack.observability.alertsTable.viewDetailsTextLabel', {
  defaultMessage: 'Alert details',
});

export type AlertActions = typeof AlertActions;
