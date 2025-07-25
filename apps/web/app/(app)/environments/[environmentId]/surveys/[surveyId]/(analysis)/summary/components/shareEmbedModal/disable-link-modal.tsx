import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { useTranslate } from "@tolgee/react";

interface DisableLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "multi-use" | "single-use";
  onDisable: () => void;
}

export const DisableLinkModal = ({ open, onOpenChange, type, onDisable }: DisableLinkModalProps) => {
  const { t } = useTranslate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="narrow" className="flex flex-col" hideCloseButton disableCloseOnOutsideClick>
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-slate-900">
            {type === "multi-use"
              ? t("environments.surveys.share.anonymous_links.disable_multi_use_link_modal_title")
              : t("common.are_you_sure")}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {type === "multi-use" ? (
            <>
              <p>
                {t("environments.surveys.share.anonymous_links.disable_multi_use_link_modal_description")}
              </p>

              <br />

              <p>
                {t(
                  "environments.surveys.share.anonymous_links.disable_multi_use_link_modal_description_subtext"
                )}
              </p>
            </>
          ) : (
            <p>{t("environments.surveys.share.anonymous_links.disable_single_use_link_modal_description")}</p>
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
              {type === "multi-use"
                ? t("environments.surveys.share.anonymous_links.disable_multi_use_link_modal_button")
                : t("environments.surveys.share.anonymous_links.disable_single_use_link_modal_button")}
            </Button>

            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
