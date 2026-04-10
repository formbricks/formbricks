"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";

interface OfflineAlertProps {
  readonly isOnline: boolean;
  readonly isSyncing: boolean;
  readonly pendingSyncCount: number;
}

export function OfflineAlert({ isOnline, isSyncing, pendingSyncCount }: OfflineAlertProps) {
  const { t } = useTranslation();
  const [showSyncDone, setShowSyncDone] = useState(false);
  const [wasSyncing, setWasSyncing] = useState(false);

  useEffect(() => {
    if (isSyncing || pendingSyncCount > 0) {
      setWasSyncing(true);
    } else if (wasSyncing && isOnline) {
      setShowSyncDone(true);
      const timer = setTimeout(() => {
        setShowSyncDone(false);
        setWasSyncing(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, pendingSyncCount, isOnline, wasSyncing]);

  const isVisible = !isOnline || isSyncing || pendingSyncCount > 0 || showSyncDone;

  if (!isVisible) return null;

  if (!isOnline) {
    return (
      <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <Alert variant="warning" size="small" className="w-fit max-w-[calc(100vw-2rem)]">
          <AlertDescription className="flex items-center gap-2 whitespace-normal text-xs sm:text-sm">
            <svg
              className="h-4 w-4 shrink-0 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {t("common.offline_you_are_offline")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isSyncing || pendingSyncCount > 0) {
    return (
      <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <Alert variant="info" size="small" className="w-fit max-w-[calc(100vw-2rem)]">
          <AlertDescription className="whitespace-normal text-xs sm:text-sm">
            {t("common.offline_syncing_responses")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <Alert variant="success" size="small" className="w-fit max-w-[calc(100vw-2rem)]">
        <AlertDescription className="whitespace-normal text-xs sm:text-sm">
          {t("common.offline_all_responses_synced")}
        </AlertDescription>
      </Alert>
    </div>
  );
}
