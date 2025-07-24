/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { EuiCard, EuiText, EuiToolTip, useEuiTheme } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { RuleTypeWithDescription } from '@kbn/triggers-actions-ui-types';
import React from 'react';

interface RuleCardProps {
  rule: RuleTypeWithDescription;
  onSelectRuleType: (ruleTypeId: string) => void;
  producerToDisplayName: (producer: string) => string;
}

export const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  onSelectRuleType,
  producerToDisplayName,
}) => {
  const { euiTheme } = useEuiTheme();

  const enabledInLicense = rule.enabledInLicense;
  const hasWritePrivileges = Object.keys(rule.authorizedConsumers).some(
    (consumer) => rule.authorizedConsumers[consumer]?.all
  );

  const isEnabled = enabledInLicense && hasWritePrivileges;

  const card = (isDisabled: boolean) => (
    <EuiCard
      titleSize="xs"
      textAlign="left"
      hasBorder
      title={rule.name}
      onClick={() => onSelectRuleType(rule.id)}
      description={rule.description}
      style={{ marginRight: '8px', flexGrow: 0 }}
      data-test-subj={`${rule.id}-SelectOption`}
      isDisabled={isDisabled}
    >
      <EuiText
        color="subdued"
        size="xs"
        style={{ textTransform: 'uppercase', fontWeight: euiTheme.font.weight.bold }}
      >
        {producerToDisplayName(rule.producer)}
      </EuiText>
    </EuiCard>
  );

  if (isEnabled) {
    return card(false);
  }

  const tooltipText = !enabledInLicense
    ? i18n.translate('responseOpsRuleForm.components.ruleTypeModal.minimumRequiredLicenseMessage', {
        defaultMessage: 'This rule requires a {minimumLicenseRequired} license.',
        values: {
          minimumLicenseRequired: rule.minimumLicenseRequired,
        },
      })
    : i18n.translate('responseOpsRuleForm.components.ruleTypeModal.insufficientPrivilegesMessage', {
        defaultMessage: 'You do not have sufficient privileges to create this rule.',
      });

  return (
    <EuiToolTip position="top" content={tooltipText}>
      {card(true)}
    </EuiToolTip>
  );
};
