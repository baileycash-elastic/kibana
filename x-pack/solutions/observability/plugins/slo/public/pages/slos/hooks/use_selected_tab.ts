/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { INSTANCES_TAB_ID, MANAGEMENT_TAB_ID, SloTabId } from '../slos';

export const useSelectedTab = () => {
  const { tabId } = useParams<{
    tabId?: string;
  }>();

  const [selectedTabId, setSelectedTabId] = useState(() => {
    return tabId && [INSTANCES_TAB_ID, MANAGEMENT_TAB_ID].includes(tabId)
      ? (tabId as SloTabId)
      : INSTANCES_TAB_ID;
  });

  useEffect(() => {
    // update the url when the selected tab changes
    if (tabId !== selectedTabId) {
      setSelectedTabId(tabId as SloTabId);
    }
  }, [selectedTabId, tabId]);

  return {
    selectedTabId: selectedTabId || INSTANCES_TAB_ID,
    setSelectedTabId,
  };
};
