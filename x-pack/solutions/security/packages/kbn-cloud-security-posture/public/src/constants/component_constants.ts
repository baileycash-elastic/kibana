/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { euiThemeVars } from '@kbn/ui-theme'; // TODO: replace with euiTheme

export const statusColors = {
  passed: euiThemeVars.euiColorSuccess,
  failed: euiThemeVars.euiColorDanger,
  unknown: euiThemeVars.euiColorLightShade, // TODO: switch to semantic color, eg. euiColorSeverity0
};

export const HOST_NAME = 'host.name';
export const USER_NAME = 'user.name';
