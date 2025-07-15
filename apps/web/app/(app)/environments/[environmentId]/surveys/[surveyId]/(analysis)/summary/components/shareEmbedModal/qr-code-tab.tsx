"use client";

import { TabContainer } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/TabContainer";
import { getQRCodeOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/get-qr-code-options";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { Download, LoaderCircle } from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { logger } from "@formbricks/logger";

interface QRCodeTabProps {
  surveyUrl: string;
}

export const QRCodeTab = ({ surveyUrl }: QRCodeTabProps) => {
  const { t } = useTranslate();
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const qrInstance = useRef<QRCodeStyling | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        qrInstance.current ??= new QRCodeStyling(getQRCodeOptions(184, 184));

        if (surveyUrl && qrInstance.current) {
          qrInstance.current.update({ data: surveyUrl });

          if (qrCodeRef.current) {
            qrCodeRef.current.innerHTML = "";
            qrInstance.current.append(qrCodeRef.current);
          }
        }
      } catch (error) {
        logger.error("Failed to generate QR code:", error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (surveyUrl) {
      generateQRCode();
    }

    return () => {
      const instance = qrInstance.current;
      if (instance) {
        qrInstance.current = null;
      }
    };
  }, [surveyUrl]);

  const downloadQRCode = async () => {
    try {
      setIsDownloading(true);
      const downloadInstance = new QRCodeStyling(getQRCodeOptions(500, 500));
      downloadInstance.update({ data: surveyUrl });
      downloadInstance.download({ name: "survey-qr-code", extension: "png" });
      toast.success(t("environments.surveys.summary.qr_code_download_with_start_soon"));
    } catch (error) {
      logger.error("Failed to download QR code:", error);
      toast.error(t("environments.surveys.summary.qr_code_download_failed"));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div data-testid="qr-code-tab">
      <TabContainer
        title={t("environments.surveys.summary.make_survey_accessible_via_qr_code")}
        description={t("environments.surveys.summary.responses_collected_via_qr_code_are_anonymous")}>
        {isLoading && (
          <div className="flex flex-col items-center gap-2">
            <LoaderCircle className="h-8 w-8 animate-spin text-slate-500" />
            <p className="text-sm text-slate-500">{t("environments.surveys.summary.generating_qr_code")}</p>
          </div>
        )}

        {hasError && (
          <Alert variant="error">
            <AlertTitle>{t("common.something_went_wrong")}</AlertTitle>
            <AlertDescription>{t("environments.surveys.summary.qr_code_generation_failed")}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !hasError && (
          <div className="flex flex-col items-start justify-center gap-4">
            <div className="flex h-[184px] w-[184px] items-center justify-center overflow-hidden rounded-lg border bg-white">
              <div ref={qrCodeRef} className="h-full w-full" />
            </div>
            <Button
              onClick={downloadQRCode}
              data-testid="download-qr-code-button"
              disabled={!surveyUrl || isDownloading || hasError}
              className="flex items-center gap-2">
              {isDownloading
                ? t("environments.surveys.summary.downloading_qr_code")
                : t("environments.surveys.summary.download_qr_code")}
              {isDownloading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </TabContainer>
    </div>
  );
};
