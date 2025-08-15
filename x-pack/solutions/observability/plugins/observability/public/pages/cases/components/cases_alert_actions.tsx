/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiContextMenuItem } from '@elastic/eui';

import React, { useMemo, useCallback } from 'react';
import { i18n } from '@kbn/i18n';
import { RELATED_ALERTS_TABLE_ID } from '@kbn/observability-shared-plugin/common';
import {
  useDeletePropertyAction,
  DeleteAttachmentConfirmationModal,
} from '@kbn/cases-plugin/public';
import { useCaseActions } from '../../../hooks/use_case_actions';
import { GetObservabilityAlertsTableProp } from '../../..';
import { AlertActions } from '../../../components/alert_actions/alert_actions';
import { useKibana } from '../../../utils/kibana_react';

export function CasesAlertActions({
  observabilityRuleTypeRegistry,
  alert,
  caseData,
  tableId,
  refresh,
  openAlertInFlyout,
  parentAlert,
  services,
  config,
  openInAlertFlyout,
  ...rest
}: React.ComponentProps<GetObservabilityAlertsTableProp<'renderActionsCell'>>) {
  const { cases } = services;
  const { telemetryClient } = useKibana().services;

  const alertAttachment = useMemo(() => {
    return caseData?.comments?.find((comment) => {
      if ('alertId' in comment && comment.alertId.includes(alert._id)) {
        return comment.alertId.includes(alert._id);
      }
    });
  }, [caseData, alert._id]);

  const onAddToCase = useCallback(
    ({ isNewCase }: { isNewCase: boolean }) => {
      if (tableId === RELATED_ALERTS_TABLE_ID) {
        telemetryClient.reportRelatedAlertAddedToCase(isNewCase);
      }
      refresh?.();
    },
    [refresh, telemetryClient, tableId]
  );

  const { isPopoverOpen, setIsPopoverOpen, removeAlertsFromCase } = useCaseActions({
    onAddToCase,
    alerts: [alert],
    services: {
      cases,
    },
    caseId: caseData?.id,
  });

  const { showDeletionModal, onConfirm, onCancel, onModalOpen } = useDeletePropertyAction({
    onDelete: () => {
      removeAlertsFromCase();
    },
  });

  const closeActionsPopover = useCallback(() => {
    setIsPopoverOpen(false);
  }, [setIsPopoverOpen]);

  const toggleActionsPopover = () => {
    setIsPopoverOpen(!isPopoverOpen);
  };

  const removeFromCaseAction = [
    ...(alertAttachment
      ? [
          <EuiContextMenuItem
            data-test-subj="remove-from-case-action"
            key="removeFromCase"
            onClick={onModalOpen}
            size="s"
          >
            {i18n.translate('xpack.observability.alerts.actions.removeFromCase', {
              defaultMessage: 'Remove from case',
            })}
          </EuiContextMenuItem>,
        ]
      : []),
  ];

  return (
    <>
      <AlertActions
        actionsMenuItems={[removeFromCaseAction]}
        closeActionsPopover={closeActionsPopover}
        isPopoverOpen={isPopoverOpen}
        toggleActionsPopover={toggleActionsPopover}
        services={services}
        observabilityRuleTypeRegistry={observabilityRuleTypeRegistry}
        config={config}
        alert={alert}
        refresh={refresh}
        openAlertInFlyout={openInAlertFlyout}
        caseData={caseData}
        {...rest}
      />
      {showDeletionModal && (
        <DeleteAttachmentConfirmationModal
          onCancel={onCancel}
          onConfirm={onConfirm}
          confirmButtonText={i18n.translate(
            'xpack.observability.alerts.actions.removeFromCaseConfirm',
            {
              defaultMessage: 'Remove',
            }
          )}
          title={i18n.translate('xpack.observability.alerts.actions.removeFromCaseTitle', {
            defaultMessage: 'Remove alert from case',
          })}
        />
      )}
    </>
  );
}

// Default export used for lazy loading
// eslint-disable-next-line import/no-default-export
export default CasesAlertActions;

export type CasesAlertActions = typeof CasesAlertActions;
