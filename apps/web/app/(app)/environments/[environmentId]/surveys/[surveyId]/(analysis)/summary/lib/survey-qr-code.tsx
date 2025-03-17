"use client";

import { getQRCodeOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/get-qr-code-options";
import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

export const useSurveyQRCode = (surveyUrl: string) => {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const qrInstance = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    try {
      if (!qrInstance.current) {
        qrInstance.current = new QRCodeStyling(getQRCodeOptions(70, 70));
      }

      if (surveyUrl && qrInstance.current) {
        qrInstance.current.update({ data: surveyUrl });

        if (qrCodeRef.current) {
          qrCodeRef.current.innerHTML = "";
          qrInstance.current.append(qrCodeRef.current);
        }
      }
    } catch (error) {
      toast.error("Failed to generate QR code.");
    }
  }, [surveyUrl]);

  const downloadQRCode = () => {
    try {
      const downloadInstance = new QRCodeStyling(getQRCodeOptions(500, 500));
      downloadInstance.update({ data: surveyUrl });
      downloadInstance.download({ name: "survey-qr", extension: "png" });
    } catch (error) {
      toast.error("Failed to download QR code.");
    }
  };

  return { qrCodeRef, downloadQRCode };
};
