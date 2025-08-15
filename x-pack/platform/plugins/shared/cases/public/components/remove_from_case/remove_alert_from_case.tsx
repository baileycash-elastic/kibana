/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import { useDeleteComment } from '../../containers/use_delete_comment';
import { useUpdateAlertComment } from '../../containers/use_update_alert_comment';

import { useFindCaseUserActions } from '../../containers/use_find_case_user_actions';
import { useMemo } from 'react';

export const useRemoveAlertsFromCase = (alertId: string, caseId: string) => {
  console.log('Removing alert from case:', alertId, caseId);

  const { data, isLoading } = useFindCaseUserActions(
    caseId,
    {
      type: 'comment',
      sortOrder: 'asc',
      page: 1,
      perPage: 1000,
    },
    true
  );

  const myData = useMemo(() => {
    console.log(data);
    return data;
  }, [data, isLoading]);

  return {
    myData,
  };

  const removalSuccessToast = i18n.translate(
    'xpack.observability.alerts.actions.removeFromCaseSuccess',
    { defaultMessage: 'Alert removed from case' }
  );

  const { mutateAsync: deleteComment } = useDeleteComment();
  const { mutateAsync: updateComment } = useUpdateAlertComment();

  // if (alertAttachment?.id && 'alertId' in alertAttachment) {
  //   const { alertId, index } = alertAttachment;
  //   if (Array.isArray(alertId) && Array.isArray(index) && alertId.length > 1) {
  //     const alertIdx = alertId.indexOf(alertIdToRemove);
  //     alertId.splice(alertIdx, 1);
  //     index.splice(alertIdx, 1);
  //     updateComment({
  //       caseId,
  //       commentUpdate: alertAttachment,
  //       successToasterTitle: removalSuccessToast,
  //     });
  //   } else {
  //     deleteComment({
  //       caseId,
  //       commentId: alertAttachment.id,
  //       successToasterTitle: removalSuccessToast,
  //     });
  //   }
  // }
};

export type UseRemoveAlertsFromCase = typeof useRemoveAlertsFromCase;
