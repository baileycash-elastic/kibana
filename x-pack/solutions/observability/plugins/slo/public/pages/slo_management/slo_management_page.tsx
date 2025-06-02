/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup } from '@elastic/eui';
import React, { useEffect } from 'react';
import { paths } from '../../../common/locators/paths';
import { useFetchSloDefinitions } from '../../hooks/use_fetch_slo_definitions';
import { useKibana } from '../../hooks/use_kibana';
import { useLicense } from '../../hooks/use_license';
import { usePermissions } from '../../hooks/use_permissions';
import { SloOutdatedFilterCallout } from './components/slo_management_outdated_filter_callout';
import { SloManagementTable } from './components/slo_management_table';
import { ActionModalProvider } from '../../context/action_modal';
import { BulkOperationProvider } from './context/bulk_operation';

export function SloManagementPage() {
  const {
    http: { basePath },
    application: { navigateToUrl },
  } = useKibana().services;
  const { data: permissions } = usePermissions();
  const { hasAtLeast } = useLicense();
  const {
    isLoading,
    isError,
    data: { total } = { total: 0 },
  } = useFetchSloDefinitions({ perPage: 0 });

  useEffect(() => {
    if (
      hasAtLeast('platinum') === false ||
      permissions?.hasAllReadRequested === false ||
      (!isLoading && total === 0) ||
      isError
    ) {
      navigateToUrl(basePath.prepend(paths.slosWelcome));
    }
  }, [basePath, hasAtLeast, isError, isLoading, navigateToUrl, total, permissions]);

  return (
    <BulkOperationProvider>
      <ActionModalProvider>
        <EuiFlexGroup direction="column" gutterSize="m">
          <SloOutdatedFilterCallout />
          <SloManagementTable />
        </EuiFlexGroup>
      </ActionModalProvider>
    </BulkOperationProvider>
  );
}
