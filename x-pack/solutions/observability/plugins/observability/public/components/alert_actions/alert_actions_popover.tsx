/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiButtonIcon,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiPopover,
  EuiToolTip,
} from '@elastic/eui';

import React, { useMemo, useCallback } from 'react';
import { i18n } from '@kbn/i18n';
import { RELATED_ALERTS_TABLE_ID } from '@kbn/observability-shared-plugin/common';
import { DefaultAlertActions } from '@kbn/response-ops-alerts-table/components/default_alert_actions';
import { useCaseActions } from '../../hooks/use_case_actions';
import { RULE_DETAILS_PAGE_ID } from '../../pages/rule_details/constants';
import { paths } from '../../../common/locators/paths';
import {
  GetObservabilityAlertsTableProp,
  ObservabilityAlertsTableContext,
  observabilityFeatureId,
} from '../..';
import { ALERT_DETAILS_PAGE_ID } from '../../pages/alert_details/alert_details';
import { useKibana } from '../../utils/kibana_react';

export function AlertActionsPopover({
  observabilityRuleTypeRegistry,
  actionsMenuItems: additionalMenuItems,
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
  const { cases } = services;
  const { telemetryClient } = useKibana().services;

  const userCasesPermissions = cases?.helpers.canUseCases([observabilityFeatureId]);

  const onAddToCase = useCallback(
    ({ isNewCase }: { isNewCase: boolean }) => {
      if (tableId === RELATED_ALERTS_TABLE_ID) {
        telemetryClient.reportRelatedAlertAddedToCase(isNewCase);
      }
      refresh?.();
    },
    [refresh, telemetryClient, tableId]
  );

  const { isPopoverOpen, setIsPopoverOpen, handleAddToExistingCaseClick, handleAddToNewCaseClick } =
    useCaseActions({
      onAddToCase,
      alerts: [alert],
      services: {
        cases,
      },
    });

  const closeActionsPopover = useCallback(() => {
    setIsPopoverOpen(false);
  }, [setIsPopoverOpen]);

  const toggleActionsPopover = () => {
    setIsPopoverOpen(!isPopoverOpen);
  };

  const actionsMenuItems = [
    ...(userCasesPermissions?.createComment && userCasesPermissions?.read
      ? [
          <EuiContextMenuItem
            data-test-subj="add-to-existing-case-action"
            key="addToExistingCase"
            onClick={handleAddToExistingCaseClick}
            size="s"
          >
            {i18n.translate('xpack.observability.alerts.actions.addToCase', {
              defaultMessage: 'Add to existing case',
            })}
          </EuiContextMenuItem>,
          <EuiContextMenuItem
            data-test-subj="add-to-new-case-action"
            key="addToNewCase"
            onClick={handleAddToNewCaseClick}
            size="s"
          >
            {i18n.translate('xpack.observability.alerts.actions.addToNewCase', {
              defaultMessage: 'Add to new case',
            })}
          </EuiContextMenuItem>,
          ...(additionalMenuItems ?? []),
        ]
      : []),
    useMemo(
      () => (
        <DefaultAlertActions<ObservabilityAlertsTableContext>
          observabilityRuleTypeRegistry={observabilityRuleTypeRegistry}
          key="defaultRowActions"
          onActionExecuted={closeActionsPopover}
          isAlertDetailsEnabled={true}
          resolveRulePagePath={(ruleId, currentPageId) =>
            currentPageId !== RULE_DETAILS_PAGE_ID ? paths.observability.ruleDetails(ruleId) : null
          }
          resolveAlertPagePath={(alertId, currentPageId) =>
            currentPageId !== ALERT_DETAILS_PAGE_ID
              ? paths.observability.alertDetails(alertId)
              : null
          }
          tableId={tableId}
          refresh={refresh}
          alert={alert}
          openAlertInFlyout={openAlertInFlyout}
          services={services}
          caseData={caseData}
          config={config}
          {...rest}
        />
      ),
      [
        alert,
        caseData,
        closeActionsPopover,
        observabilityRuleTypeRegistry,
        openAlertInFlyout,
        refresh,
        services,
        rest,
        tableId,
      ]
    ),
  ];

  const actionsToolTip =
    actionsMenuItems.length <= 0
      ? i18n.translate('xpack.observability.alertsTable.notEnoughPermissions', {
          defaultMessage: 'Additional privileges required',
        })
      : i18n.translate('xpack.observability.alertsTable.moreActionsTextLabel', {
          defaultMessage: 'More actions',
        });

  return (
    <>
      <EuiPopover
        anchorPosition="downLeft"
        button={
          <EuiToolTip content={actionsToolTip} disableScreenReaderOutput>
            <EuiButtonIcon
              aria-label={actionsToolTip}
              color="text"
              data-test-subj="alertsTableRowActionMore"
              display="empty"
              iconType="boxesHorizontal"
              onClick={toggleActionsPopover}
              size="s"
            />
          </EuiToolTip>
        }
        closePopover={closeActionsPopover}
        isOpen={isPopoverOpen}
        panelPaddingSize="none"
      >
        <EuiContextMenuPanel
          size="s"
          items={actionsMenuItems}
          data-test-subj="alertsTableActionsMenu"
        />
      </EuiPopover>
    </>
  );
}

// Default export used for lazy loading
// eslint-disable-next-line import/no-default-export
export default AlertActionsPopover;

export type AlertActionsPopover = typeof AlertActionsPopover;
