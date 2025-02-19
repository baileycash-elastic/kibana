/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ExternalPageName, SecurityPageName } from '@kbn/security-solution-navigation';
import { INVESTIGATIONS_PATH } from '../../../../../common/constants';
import { SECURITY_FEATURE_ID } from '../../../../../common';
import type { LinkItem } from '../../../../common/links/types';
import type { SolutionNavLink } from '../../../../common/links';
import { IconOsqueryLazy, IconTimelineLazy } from './lazy_icons';
import * as i18n from './investigations_translations';

// appLinks configures the Security Solution pages links
const investigationsAppLink: LinkItem = {
  id: SecurityPageName.investigations,
  title: i18n.INVESTIGATIONS_TITLE,
  path: INVESTIGATIONS_PATH,
  capabilities: [`${SECURITY_FEATURE_ID}.show`],
  hideTimeline: true,
  skipUrlState: true,
  links: [], // timeline and note links are added via the methods below
};

export const createInvestigationsLink = (links: LinkItem[]): LinkItem => ({
  ...investigationsAppLink,
  links,
});

export const createTimelineLink = (timelineLink: LinkItem): LinkItem => ({
  ...timelineLink,
  description: i18n.TIMELINE_DESCRIPTION,
  landingIcon: IconTimelineLazy,
});

// navLinks define the navigation links for the Security Solution pages and External pages as well
export const investigationsNavLinks: SolutionNavLink[] = [
  {
    id: ExternalPageName.osquery,
    title: i18n.OSQUERY_TITLE,
    landingIcon: IconOsqueryLazy,
    description: i18n.OSQUERY_DESCRIPTION,
  },
];
