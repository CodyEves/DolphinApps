import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemName: string;
  itemType: string;
  description: string;
  confirmLabel?: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  itemName,
  itemType,
  description,
  confirmLabel = "Delete",
  isDeleting = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const canDelete = confirmationText === itemName && !isDeleting;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmationText("");
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background p-5 shadow-xl focus:outline-none">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <Dialog.Title className="text-lg font-semibold">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="text-sm leading-6 text-muted-foreground">
                  {description}
                </Dialog.Description>
              </div>
            </div>

            <div className="rounded-md border bg-muted/25 p-3 text-sm">
              <p className="font-medium">{itemName}</p>
              <p className="text-muted-foreground">{itemType}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type the exact {itemType} title to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={itemName}
                disabled={isDeleting}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={isDeleting}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                disabled={!canDelete}
                onClick={() => void onConfirm()}
              >
                {isDeleting ? "Deleting..." : confirmLabel}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
