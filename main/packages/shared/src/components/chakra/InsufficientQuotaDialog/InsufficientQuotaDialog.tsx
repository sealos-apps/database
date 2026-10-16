'use client';

import { useHostConfigStore } from '../../../store/hostConfig';
import { InsufficientQuotaDialogView } from './InsufficientQuotaDialogView';
import { useQuotaStore } from '../../../store/quota';
import { useQuotaGuardConfig } from '../../../hooks/QuotaGuardProvider';
import type { SupportedLang } from '../../../i18n/quota-dialog';

export interface InsufficientQuotaDialogProps {
  /** Language for dialog content */
  lang: SupportedLang;
}

/**
 * Dialog component shown when quota is exceeded.
 *
 * @param props - Component props
 */
export function InsufficientQuotaDialog({ lang }: InsufficientQuotaDialogProps) {
  const quotaStore = useQuotaStore();
  const { sealosApp } = useQuotaGuardConfig();
  const subscriptionEnabled = useHostConfigStore((state) => state.subscriptionEnabled);

  const handleOpenCostcenter = () => {
    if (!sealosApp) return;
    sealosApp.runEvents('openDesktopApp', {
      appKey: 'system-costcenter',
      pathname: '/',
      query: {
        mode: 'upgrade'
      },
      messageData: {
        type: 'InternalAppCall',
        mode: 'upgrade'
      }
    });
  };

  const openTicketsApp = () => {
    if (!sealosApp) return;
    sealosApp.runEvents('openDesktopApp', {
      appKey: 'system-workorder',
      pathname: '/'
    });
  };

  return (
    <InsufficientQuotaDialogView
      onOpenCostCenter={handleOpenCostcenter}
      onOpenTickets={openTicketsApp}
      subscriptionEnabled={subscriptionEnabled}
      items={quotaStore.exceededQuotas}
      open={quotaStore.exceededPromptOpen}
      onOpenChange={quotaStore.setExceededPromptOpen}
      showControls={quotaStore.showExceededPromptControls}
      showRequirements={quotaStore.showRequirements}
      lang={lang}
      disallowClosing={quotaStore.disallowClosing}
      onConfirm={
        quotaStore.exceededPromptCallback
          ? () => {
              quotaStore.exceededPromptCallback!();
              quotaStore.setExceededPromptOpen(false);
            }
          : () => {
              quotaStore.setExceededPromptOpen(false);
            }
      }
    />
  );
}
