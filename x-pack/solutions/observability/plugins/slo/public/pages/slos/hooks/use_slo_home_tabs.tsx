/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import { paths } from '../../../../common/locators/paths';
import { useKibana } from '../../../hooks/use_kibana';
import { INSTANCES_TAB_ID, MANAGEMENT_TAB_ID, SloTabId } from '../slos';

export const useSloHomeTabs = ({
  selectedTabId,
  setSelectedTabId,
}: {
  selectedTabId: SloTabId;
  setSelectedTabId?: (val: SloTabId) => void;
}) => {
  const { basePath } = useKibana().services.http;

  const tabs = [
    {
      id: INSTANCES_TAB_ID,
      label: i18n.translate('xpack.slo.sloHome.tab.instancesLabel', {
        defaultMessage: 'Instances',
      }),
      'data-test-subj': 'instancesTab',
      isSelected: selectedTabId === INSTANCES_TAB_ID,
      ...(setSelectedTabId
        ? {
            onClick: () => setSelectedTabId(INSTANCES_TAB_ID),
          }
        : {
            href: `${basePath.get()}${paths.slos()}`,
          }),
    },
    {
      id: MANAGEMENT_TAB_ID,
      label: i18n.translate('xpack.slo.sloHome.tab.managementLabel', {
        defaultMessage: 'Management',
      }),
      'data-test-subj': 'managementTab',
      isSelected: selectedTabId === MANAGEMENT_TAB_ID,
      ...(setSelectedTabId
        ? {
            onClick: () => setSelectedTabId(MANAGEMENT_TAB_ID),
          }
        : {
            href: `${basePath.get()}${paths.slos('management')}`,
          }),
    },
  ];

  return { tabs };
};
