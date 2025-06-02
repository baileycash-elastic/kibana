/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import React, { useEffect } from 'react';
import { useBreadcrumbs } from '@kbn/observability-shared-plugin/public';
import { paths } from '../../../common/locators/paths';
import { HeaderMenu } from '../../components/header_menu/header_menu';
import { SloOutdatedCallout } from '../../components/slo/slo_outdated_callout';
import { useFetchSloList } from '../../hooks/use_fetch_slo_list';
import { useSelectedTab } from './hooks/use_selected_tab';
import { useLicense } from '../../hooks/use_license';
import { usePermissions } from '../../hooks/use_permissions';
import { usePluginContext } from '../../hooks/use_plugin_context';
import { useKibana } from '../../hooks/use_kibana';
import { CreateSloBtn } from './components/common/create_slo_btn';
import { FeedbackButton } from './components/common/feedback_button';
import { useSloHomeTabs } from './hooks/use_slo_home_tabs';
import { SloManagementPage } from '../slo_management/slo_management_page';
import { SLOListContainer } from './components/slo_list_container';

export const SLO_PAGE_ID = 'slo-page-container';

export const INSTANCES_TAB_ID = 'definition';
export const MANAGEMENT_TAB_ID = 'alerts';

export type SloTabId = typeof INSTANCES_TAB_ID | typeof MANAGEMENT_TAB_ID;

export function SlosPage() {
  const {
    application: { navigateToUrl },
    http: { basePath },
    serverless,
  } = useKibana().services;
  const { ObservabilityPageTemplate } = usePluginContext();
  const { hasAtLeast } = useLicense();
  const { data: permissions } = usePermissions();

  const { isLoading, isError, data: sloList } = useFetchSloList({ perPage: 0 });
  const { total } = sloList ?? { total: 0 };

  const { selectedTabId } = useSelectedTab();

  const { tabs } = useSloHomeTabs({
    selectedTabId,
  });

  useBreadcrumbs(
    [
      {
        href: basePath.prepend(paths.slos()),
        text: i18n.translate('xpack.slo.breadcrumbs.slosLinkText', {
          defaultMessage: 'SLOs',
        }),
        deepLinkId: 'slo',
      },
    ],
    { serverless }
  );

  useEffect(() => {
    if ((!isLoading && total === 0) || hasAtLeast('platinum') === false || isError) {
      navigateToUrl(basePath.prepend(paths.slosWelcome));
    }

    if (permissions?.hasAllReadRequested === false) {
      navigateToUrl(basePath.prepend(paths.slosWelcome));
    }
  }, [basePath, hasAtLeast, isError, isLoading, navigateToUrl, total, permissions]);

  return (
    <ObservabilityPageTemplate
      data-test-subj="slosPage"
      pageHeader={{
        pageTitle: i18n.translate('xpack.slo.slosPage.', { defaultMessage: 'SLOs' }),
        rightSideItems: [<CreateSloBtn />, <FeedbackButton />],
        tabs,
      }}
    >
      <HeaderMenu />
      <SloOutdatedCallout />
      {selectedTabId === MANAGEMENT_TAB_ID ? <SloManagementPage /> : <SLOListContainer />}
    </ObservabilityPageTemplate>
  );
}
