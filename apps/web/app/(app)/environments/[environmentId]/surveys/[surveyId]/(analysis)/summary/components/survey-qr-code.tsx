"use client";

import { getQRCodeOptions } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/getQRCodeOptions";
import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

interface SurveyQRCodeProps {
  surveyUrl: string;
}

export const SurveyQRCode = ({ surveyUrl }: SurveyQRCodeProps) => {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const qrInstance = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!qrInstance.current) {
      qrInstance.current = new QRCodeStyling(getQRCodeOptions(65, 65));
    }

    qrInstance.current.update({ data: surveyUrl });

    if (qrCodeRef.current) {
      qrCodeRef.current.innerHTML = "";
      qrInstance.current.append(qrCodeRef.current);
    }
  }, [surveyUrl]);

  const downloadQRCode = () => {
    try {
      const downloadInstance = new QRCodeStyling(getQRCodeOptions(500, 500));
      downloadInstance.update({ data: surveyUrl });
      downloadInstance.download({ name: "survey-qr", extension: "png" });
    } catch (error) {
      toast.error("Error downloading QR code");
    }
  };

  return { qrCodeRef, downloadQRCode };
};
