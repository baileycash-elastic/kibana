/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { CaseAttachmentsWithoutOwner } from '@kbn/cases-plugin/public';
import { useCallback, useState } from 'react';
import { AttachmentType } from '@kbn/cases-plugin/common';
import type { Alert } from '@kbn/alerting-types';
import { CasesService } from '@kbn/response-ops-alerts-table/types';
import { EventNonEcsData } from '../../common/typings';

export const useCaseActions = ({
  alerts,
  onAddToCase,
  services,
  caseId,
}: {
  alerts: Alert[];
  onAddToCase?: ({ isNewCase }: { isNewCase: boolean }) => void;
  services: {
    /**
     * The cases service is optional: cases features will be disabled if not provided
     */
    cases?: CasesService;
  };
  caseId?: string;
}) => {
  const { cases } = services;
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

  const onAddToExistingCase = useCallback(() => {
    onAddToCase?.({ isNewCase: false });
  }, [onAddToCase]);

  const onAddToNewCase = useCallback(() => {
    onAddToCase?.({ isNewCase: true });
  }, [onAddToCase]);

  const selectCaseModal = cases?.hooks.useCasesAddToExistingCaseModal({
    onSuccess: onAddToExistingCase,
  });

  function getCaseAttachments(): CaseAttachmentsWithoutOwner {
    return alerts.map((alert) => ({
      alertId: alert?._id ?? '',
      index: alert?._index ?? '',
      type: AttachmentType.alert,
      rule: cases?.helpers.getRuleIdFromEvent({
        ecs: {
          _id: alert?._id ?? '',
          _index: alert?._index ?? '',
        },
        data:
          Object.entries(alert ?? {}).reduce<EventNonEcsData[]>(
            (acc, [field, value]) => [...acc, { field, value: value as string[] }],
            []
          ) ?? [],
      }) ?? { id: '', name: '' },
    }));
  }
  const createCaseFlyout = cases?.hooks.useCasesAddToNewCaseFlyout({ onSuccess: onAddToNewCase });
  const closeActionsPopover = () => {
    setIsPopoverOpen(false);
  };

  const removeAlertsFromCase = useCallback(() => {
    return cases?.hooks.useRemoveAlertsFromCase(alerts[0]._id, caseId ?? '');
  }, [alerts, caseId, cases]);

  const handleAddToNewCaseClick = () => {
    createCaseFlyout?.open({ attachments: getCaseAttachments() });
    closeActionsPopover();
  };

  const handleAddToExistingCaseClick = () => {
    selectCaseModal?.open({ getAttachments: () => getCaseAttachments() });
    closeActionsPopover();
  };

  return {
    isPopoverOpen,
    setIsPopoverOpen,
    handleAddToExistingCaseClick,
    handleAddToNewCaseClick,
    removeAlertsFromCase,
  };
};
