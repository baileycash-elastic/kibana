/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { useCallback, useState } from 'react';
import { difference, isEqual } from 'lodash';
import type { Alert } from '@kbn/alerting-types';
import type { HttpStart } from '@kbn/core-http-browser';
import type { NotificationsStart } from '@kbn/core-notifications-browser';
import type { UseActionProps, ItemsSelectionState } from './types';

type AlertsUpdateRequest = Record<string, unknown>;

type UseItemsActionProps<T> = UseActionProps & {
  fieldKey: 'tags' | 'assignees';
  successToasterTitle: (totalAlerts: number) => string;
  fieldSelector: (alert: Alert) => string[];
  itemsTransformer: (items: string[]) => T;
  http: HttpStart;
  notifications: NotificationsStart;
};

export const useItemsAction = <T,>({
  isDisabled,
  fieldKey,
  onAction,
  onActionSuccess,
  successToasterTitle,
  fieldSelector,
  itemsTransformer,
  http,
  notifications,
}: UseItemsActionProps<T>) => {
  const [isFlyoutOpen, setIsFlyoutOpen] = useState<boolean>(false);
  const [selectedAlertsToEdit, setSelectedAlertsToEdit] = useState<Alert[]>([]);
  const isActionDisabled = isDisabled;

  const onFlyoutClosed = useCallback(() => setIsFlyoutOpen(false), []);
  const openFlyout = useCallback(
    (selectedAlerts: Alert[]) => {
      onAction();
      setIsFlyoutOpen(true);
      setSelectedAlertsToEdit(selectedAlerts);
    },
    [onAction]
  );

  const areItemsEqual = (originalItems: Set<string>, itemsToUpdate: Set<string>): boolean => {
    return isEqual(originalItems, itemsToUpdate);
  };

  const updateAlerts = useCallback(
    async (
      payload: {
        alertsToUpdate: AlertsUpdateRequest[];
        selectedItems: string[];
        unSelectedItems: string[];
      },
      options: { onSuccess: () => void }
    ) => {
      if (payload.alertsToUpdate.length === 0) {
        options.onSuccess();
        return;
      }

      // Only tags field is supported for bulk updates via the RAC alerts API
      if (fieldKey !== 'tags') {
        notifications.toasts.addWarning({
          title: `Bulk update for ${fieldKey} is not yet supported`,
        });
        options.onSuccess();
        return;
      }

      try {
        // Group alerts by index since the API requires a single index per request
        const alertsByIndex = payload.alertsToUpdate.reduce((acc, alert) => {
          const index = (alert as unknown as Alert)._index;
          const alertId = (alert as unknown as Alert)._id;
          const existing = acc[index] as string[] | undefined;
          acc[index] = existing ? [...existing, alertId] : [alertId];
          return acc;
        }, {} as Record<string, string[]>);

        // Make API calls for each index
        await Promise.all(
          Object.entries(alertsByIndex).map(([index, alertIds]) =>
            http.post('/internal/rac/alerts/tags', {
              body: JSON.stringify({
                index,
                alertIds,
                add: payload.selectedItems.length > 0 ? payload.selectedItems : undefined,
                remove: payload.unSelectedItems.length > 0 ? payload.unSelectedItems : undefined,
              }),
            })
          )
        );

        notifications.toasts.addSuccess({
          title: `Successfully updated ${payload.alertsToUpdate.length} alert${
            payload.alertsToUpdate.length !== 1 ? 's' : ''
          }`,
        });

        options.onSuccess();
      } catch (error) {
        notifications.toasts.addError(error as Error, {
          title: `Failed to update alerts`,
        });
      }
    },
    [fieldKey, http, notifications]
  );

  const onSaveItems = useCallback(
    (itemsSelection: ItemsSelectionState) => {
      onAction();
      onFlyoutClosed();

      const alertsToUpdate = selectedAlertsToEdit.reduce((acc, alert) => {
        const alertFieldValue = fieldSelector(alert);

        if (!alertFieldValue) return acc;

        const itemsWithoutUnselectedItems = difference(
          alertFieldValue,
          itemsSelection.unSelectedItems
        );

        const uniqueItems = new Set([
          ...itemsWithoutUnselectedItems,
          ...itemsSelection.selectedItems,
        ]);

        if (areItemsEqual(new Set([...alertFieldValue]), uniqueItems)) {
          return acc;
        }

        return [
          ...acc,
          {
            [fieldKey]: itemsTransformer(Array.from(uniqueItems.values())),
            id: alert.id,
            version: alert.version,
            ...alert, // Include the full alert object to access _id and _index
          },
        ];
      }, [] as AlertsUpdateRequest[]);

      const payload = {
        alertsToUpdate,
        selectedItems: itemsSelection.selectedItems,
        unSelectedItems: itemsSelection.unSelectedItems,
      };

      updateAlerts(payload, { onSuccess: onActionSuccess });
    },
    [
      fieldKey,
      fieldSelector,
      itemsTransformer,
      onAction,
      onActionSuccess,
      onFlyoutClosed,
      selectedAlertsToEdit,
      updateAlerts,
    ]
  );

  return { isFlyoutOpen, onFlyoutClosed, onSaveItems, openFlyout, isActionDisabled };
};

export type UseItemsAction = ReturnType<typeof useItemsAction>;
