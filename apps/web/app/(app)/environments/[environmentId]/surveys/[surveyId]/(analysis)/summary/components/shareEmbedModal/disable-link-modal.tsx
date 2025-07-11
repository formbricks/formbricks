import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/modules/ui/components/dialog";

interface DisableLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "multi-use" | "single-use";
  onDisable: () => void;
}

export const DisableLinkModal = ({ open, onOpenChange, type, onDisable }: DisableLinkModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-md flex-col" hideCloseButton disableCloseOnOutsideClick>
        <DialogHeader className="tex-sm font-medium text-slate-900">
          {type === "multi-use" ? "Are you sure? This can break active embeddings" : "Are you sure?"}
        </DialogHeader>

        <DialogBody>
          {type === "multi-use" ? (
            <>
              <p>Disabling the multi-use link will prevent anyone to submit a response via the link.</p>

              <br />

              <p>
                This will also break any active embeds on Websites, Emails, Social Media and QR codes that use
                this multi-use link.
              </p>
            </>
          ) : (
            <p>
              If you shared single-use links, participants will not be able to respond to the survey any
              longer.
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <div className="flex w-full flex-col gap-2">
            <Button
              variant="default"
              onClick={() => {
                onDisable();
                onOpenChange(false);
              }}>
              {type === "multi-use" ? "Disable multi-use link" : "Disable single-use link"}
            </Button>

            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
