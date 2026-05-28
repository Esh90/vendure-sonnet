import { CopyableText } from '@/vdb/components/shared/copyable-text.js';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/vdb/components/ui/alert-dialog.js';
import { Button } from '@/vdb/components/ui/button.js';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/vdb/components/ui/dialog.js';
import { api } from '@/vdb/graphql/api.js';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
    resetCustomerPasswordAsAdminDocument,
    verifyCustomerAccountAsAdminDocument,
} from '../customers.graphql.js';

export type CustomerCredentialAction = 'reset' | 'verify';

interface CustomerCredentialActionButtonProps {
    customerId: string;
    action: CustomerCredentialAction;
}

interface ActionCopy {
    button: ReactNode;
    icon: typeof KeyRound;
    confirmTitle: ReactNode;
    confirmDescription: ReactNode;
    confirmAction: ReactNode;
    resultTitle: ReactNode;
    resultDescription: ReactNode;
    errorToast: string;
    successToast: string;
}

export function CustomerCredentialActionButton({
    customerId,
    action,
}: Readonly<CustomerCredentialActionButtonProps>) {
    const { t } = useLingui();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

    const copy: ActionCopy =
        action === 'reset'
            ? {
                  button: <Trans>Reset password</Trans>,
                  icon: KeyRound,
                  confirmTitle: <Trans>Send password reset email?</Trans>,
                  confirmDescription: (
                      <Trans>
                          The customer will receive an email containing a link to set a new password.
                          Their existing password remains valid until they complete the reset flow.
                      </Trans>
                  ),
                  confirmAction: <Trans>Send reset email</Trans>,
                  resultTitle: null,
                  resultDescription: null,
                  errorToast: t`Failed to send password reset email`,
                  successToast: t`Password reset email sent to the customer`,
              }
            : {
                  button: <Trans>Verify account</Trans>,
                  icon: ShieldCheck,
                  confirmTitle: <Trans>Verify customer account?</Trans>,
                  confirmDescription: (
                      <Trans>
                          This marks the account as verified and sets a new random password, bypassing
                          the email verification flow. The password will be displayed once — the
                          customer will not receive any notification.
                      </Trans>
                  ),
                  confirmAction: <Trans>Verify account</Trans>,
                  resultTitle: <Trans>Account verified</Trans>,
                  resultDescription: (
                      <Trans>
                          The account is now verified. Copy the generated password now — it will not be
                          shown again.
                      </Trans>
                  ),
                  errorToast: t`Failed to verify account`,
                  successToast: '',
              };

    const handleError = (message?: string) =>
        toast.error(copy.errorToast, message ? { description: message } : undefined);

    const { mutate: runReset, isPending: resetPending } = useMutation({
        mutationFn: (vars: { customerId: string }) =>
            api.mutate(resetCustomerPasswordAsAdminDocument, vars),
        onSuccess: data => {
            const result = data.resetCustomerPasswordAsAdmin;
            if (result.__typename === 'Success') {
                toast.success(copy.successToast);
            } else {
                handleError(result.message);
            }
        },
        onError: err => handleError(err instanceof Error ? err.message : undefined),
    });

    const { mutate: runVerify, isPending: verifyPending } = useMutation({
        mutationFn: (vars: { customerId: string }) =>
            api.mutate(verifyCustomerAccountAsAdminDocument, vars),
        onSuccess: data => {
            const result = data.verifyCustomerAccountAsAdmin;
            if (result.__typename === 'AdminGeneratedPassword') {
                setGeneratedPassword(result.password);
            } else {
                handleError(result.message);
            }
        },
        onError: err => handleError(err instanceof Error ? err.message : undefined),
    });

    const isPending = action === 'reset' ? resetPending : verifyPending;
    const runMutation = () =>
        action === 'reset' ? runReset({ customerId }) : runVerify({ customerId });
    const Icon = copy.icon;

    return (
        <>
            <Button
                variant="outline"
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={isPending}
            >
                <Icon className="w-4 h-4" />
                {copy.button}
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{copy.confirmTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{copy.confirmDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
                            <Trans>Cancel</Trans>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            onClick={() => {
                                setConfirmOpen(false);
                                runMutation();
                            }}
                        >
                            {copy.confirmAction}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog
                open={generatedPassword !== null}
                onOpenChange={open => {
                    if (!open) setGeneratedPassword(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{copy.resultTitle}</DialogTitle>
                        <DialogDescription>{copy.resultDescription}</DialogDescription>
                    </DialogHeader>
                    {generatedPassword && (
                        <CopyableText value={generatedPassword} className="justify-between">
                            <code className="bg-muted px-3 py-2 rounded font-mono text-sm break-all">
                                {generatedPassword}
                            </code>
                        </CopyableText>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
