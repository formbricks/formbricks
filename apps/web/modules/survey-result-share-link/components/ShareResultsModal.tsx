"use client";

import { CopyIcon, LinkIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyResultShareLink } from "@formbricks/types/survey-result-share-link";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  createSurveyResultShareLinkAction,
  getSurveyResultShareLinksAction,
  revokeSurveyResultShareLinkAction,
} from "@/modules/survey-result-share-link/actions";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface ShareResultsModalProps {
  surveyId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const getShareUrl = (token: string): string => {
  return `${window.location.protocol}//${window.location.host}/share/results/${token}`;
};

const getLinkStatus = (
  link: TSurveyResultShareLink,
  t: (key: string) => string
): { label: string; variant: "success" | "warning" | "error" | "gray" } => {
  if (link.revokedAt) {
    return { label: t("environments.surveys.summary.share_results.revoked"), variant: "error" };
  }
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return { label: t("environments.surveys.summary.share_results.expired"), variant: "warning" };
  }
  return { label: t("environments.surveys.summary.share_results.active"), variant: "success" };
};

export const ShareResultsModal = ({ surveyId, open, setOpen }: ShareResultsModalProps) => {
  const { t } = useTranslation();
  const [links, setLinks] = useState<TSurveyResultShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>("never");
  const [label, setLabel] = useState("");
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [linkToRevoke, setLinkToRevoke] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getSurveyResultShareLinksAction({ surveyId });
      if (response?.data) {
        setLinks(response.data);
      }
    } catch {
      toast.error(t("common.something_went_wrong"));
    } finally {
      setIsLoading(false);
    }
  }, [surveyId, t]);

  useEffect(() => {
    if (open) {
      fetchLinks();
    }
  }, [open, fetchLinks]);

  const handleCreateLink = async () => {
    setIsCreating(true);
    try {
      const response = await createSurveyResultShareLinkAction({
        surveyId,
        expiresIn: expiresIn as "7d" | "30d" | "90d" | "never",
        label: label || undefined,
      });

      if (response?.data) {
        toast.success(t("environments.surveys.summary.share_results.link_created"));
        navigator.clipboard.writeText(getShareUrl(response.data.token));
        toast.success(t("common.copied_to_clipboard"));
        setLabel("");
        setExpiresIn("never");
        fetchLinks();
      } else {
        const errorMessage = getFormattedErrorMessage(response);
        toast.error(errorMessage);
      }
    } catch {
      toast.error(t("common.something_went_wrong"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!linkToRevoke) return;
    setIsRevoking(true);
    try {
      const response = await revokeSurveyResultShareLinkAction({
        surveyId,
        linkId: linkToRevoke,
      });

      if (response?.data) {
        toast.success(t("environments.surveys.summary.share_results.link_revoked"));
        fetchLinks();
      } else {
        const errorMessage = getFormattedErrorMessage(response);
        toast.error(errorMessage);
      }
    } catch {
      toast.error(t("common.something_went_wrong"));
    } finally {
      setIsRevoking(false);
      setRevokeModalOpen(false);
      setLinkToRevoke(null);
    }
  };

  const activeLinksCount = links.filter(
    (l) => !l.revokedAt && (!l.expiresAt || new Date(l.expiresAt) > new Date())
  ).length;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("environments.surveys.summary.share_results.title")}</DialogTitle>
            <DialogDescription>
              {t("environments.surveys.summary.share_results.description")}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-6">
              {/* Create new link section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-label">
                    {t("environments.surveys.summary.share_results.label_optional")}
                  </Label>
                  <Input
                    id="share-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t("environments.surveys.summary.share_results.label_placeholder")}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("environments.surveys.summary.share_results.expiration")}</Label>
                  <Select value={expiresIn} onValueChange={setExpiresIn}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">
                        {t("environments.surveys.summary.share_results.never_expires")}
                      </SelectItem>
                      <SelectItem value="7d">
                        {t("environments.surveys.summary.share_results.expires_7_days")}
                      </SelectItem>
                      <SelectItem value="30d">
                        {t("environments.surveys.summary.share_results.expires_30_days")}
                      </SelectItem>
                      <SelectItem value="90d">
                        {t("environments.surveys.summary.share_results.expires_90_days")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleCreateLink}
                  loading={isCreating}
                  disabled={activeLinksCount >= 5}
                  className="w-full">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  {activeLinksCount >= 5
                    ? t("environments.surveys.summary.share_results.max_links_reached")
                    : t("environments.surveys.summary.share_results.generate_link")}
                </Button>
              </div>

              {/* Existing links section */}
              {links.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">
                    {t("environments.surveys.summary.share_results.existing_links")}{" "}
                    <span className="text-slate-400">({links.length})</span>
                  </h4>
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {isLoading ? (
                      <p className="py-4 text-center text-sm text-slate-500">{t("common.loading")}</p>
                    ) : (
                      links.map((link) => {
                        const status = getLinkStatus(link, t);
                        const isActive =
                          !link.revokedAt && (!link.expiresAt || new Date(link.expiresAt) > new Date());
                        return (
                          <div
                            key={link.id}
                            className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-slate-700">
                                  {link.label ||
                                    t("environments.surveys.summary.share_results.untitled_link")}
                                </p>
                                <Badge type={status.variant} size="tiny" text={status.label} />
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {t("environments.surveys.summary.share_results.created")}{" "}
                                {new Date(link.createdAt).toLocaleDateString()}
                                {link.expiresAt &&
                                  ` · ${t("environments.surveys.summary.share_results.expires")} ${new Date(link.expiresAt).toLocaleDateString()}`}
                              </p>
                            </div>
                            <div className="ml-2 flex items-center gap-1">
                              {isActive && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(getShareUrl(link.token));
                                      toast.success(t("common.copied_to_clipboard"));
                                    }}
                                    title={t("common.copy_link")}>
                                    <CopyIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setLinkToRevoke(link.id);
                                      setRevokeModalOpen(true);
                                    }}
                                    title={t("environments.surveys.summary.share_results.revoke")}>
                                    <Trash2Icon className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={revokeModalOpen}
        setOpen={setRevokeModalOpen}
        title={t("environments.surveys.summary.share_results.revoke_confirm_title")}
        body={t("environments.surveys.summary.share_results.revoke_confirm_body")}
        buttonText={t("environments.surveys.summary.share_results.revoke")}
        onConfirm={handleRevokeLink}
        buttonVariant="destructive"
        buttonLoading={isRevoking}
      />
    </>
  );
};
