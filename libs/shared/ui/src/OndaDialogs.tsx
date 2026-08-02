'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { AlertDialog, Button } from '@heroui/react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
};

type AlertOptions = {
  title: string;
  message: string;
  actionLabel?: string;
  tone?: Tone;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve?: (ok: boolean) => void;
};

type AlertState = AlertOptions & {
  open: boolean;
  resolve?: () => void;
};

const CONFIRM_DEFAULTS: ConfirmOptions = {
  title: 'Confirmar',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  tone: 'danger',
};

const ALERT_DEFAULTS: AlertOptions = {
  title: 'Aviso',
  message: '',
  actionLabel: 'Entendido',
  tone: 'success',
};

function DialogShell({
  open,
  onOpenChange,
  title,
  message,
  tone = 'default',
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  tone?: Tone;
  footer: ReactNode;
}) {
  return (
    <AlertDialog.Root isOpen={open} onOpenChange={onOpenChange}>
      <AlertDialog.Backdrop isDismissable={false} className="onda-dialog-backdrop">
        <AlertDialog.Container placement="center" className="onda-dialog-container">
          <AlertDialog.Dialog className="onda-dialog">
            <AlertDialog.Header className="onda-dialog-header">
              <AlertDialog.Icon status={tone} />
              <AlertDialog.Heading className="onda-dialog-title">{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="onda-dialog-body">
              <p>{message}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="onda-dialog-footer">{footer}</AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog.Root>
  );
}

/** Hook: confirm() y alert() con modales (reemplaza window.confirm / alerts) */
export function useOndaDialogs() {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    ...CONFIRM_DEFAULTS,
    open: false,
  });
  const [alertState, setAlertState] = useState<AlertState>({
    ...ALERT_DEFAULTS,
    open: false,
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        ...CONFIRM_DEFAULTS,
        ...options,
        open: true,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setAlertState({
        ...ALERT_DEFAULTS,
        ...options,
        open: true,
        resolve,
      });
    });
  }, []);

  function closeConfirm(ok: boolean) {
    confirmState.resolve?.(ok);
    setConfirmState((s) => ({ ...s, open: false, resolve: undefined }));
  }

  function closeAlert() {
    alertState.resolve?.();
    setAlertState((s) => ({ ...s, open: false, resolve: undefined }));
  }

  const dialogs = (
    <>
      <DialogShell
        open={confirmState.open}
        onOpenChange={(open) => {
          if (!open) closeConfirm(false);
        }}
        title={confirmState.title}
        message={confirmState.message}
        tone={confirmState.tone}
        footer={
          <>
            <Button
              variant="secondary"
              className="onda-dialog-btn"
              onPress={() => closeConfirm(false)}
            >
              {confirmState.cancelLabel}
            </Button>
            <Button
              variant={confirmState.tone === 'danger' ? 'danger' : 'primary'}
              className="onda-dialog-btn"
              onPress={() => closeConfirm(true)}
            >
              {confirmState.confirmLabel}
            </Button>
          </>
        }
      />

      <DialogShell
        open={alertState.open}
        onOpenChange={(open) => {
          if (!open) closeAlert();
        }}
        title={alertState.title}
        message={alertState.message}
        tone={alertState.tone}
        footer={
          <Button variant="primary" className="onda-dialog-btn" onPress={closeAlert}>
            {alertState.actionLabel}
          </Button>
        }
      />
    </>
  );

  return { confirm, alert, dialogs };
}
