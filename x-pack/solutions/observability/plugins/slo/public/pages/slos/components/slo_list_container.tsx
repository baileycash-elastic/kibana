/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiSpacer } from '@elastic/eui';
import React from 'react';
import { SloList } from './slo_list';
import { SloListSearchBar } from './slo_list_search_bar';
import { SLOsOverview } from './slos_overview/slos_overview';

export function SLOListContainer() {
  return (
    <>
      <SloListSearchBar />
      <EuiSpacer size="m" />
      <SLOsOverview />
      <EuiSpacer size="m" />
      <SloList />
    </>
  );
}
