"use client";

import { Button } from "@/modules/ui/components/button";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

export default function SentryTestPage() {
  const [sentryStatus, setSentryStatus] = useState<string>("Checking...");
  const [sentryDsn, setSentryDsn] = useState<string | null>(null);

  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    setSentryDsn(dsn || null);

    // Check if Sentry is initialized
    const isSentryInit = Boolean(
      typeof window !== "undefined" && (window as any).__SENTRY__ && (window as any).__SENTRY__.hub
    );

    setSentryStatus(isSentryInit ? "Active ✅" : "Inactive ❌");
  }, []);

  const handleTestError = () => {
    try {
      throw new Error(`Test error from Formbricks at ${new Date().toISOString()}`);
    } catch (error) {
      Sentry.captureException(error);
      alert("Error sent to Sentry! Check your dashboard.");
    }
  };

  const handleTestMessage = () => {
    Sentry.captureMessage(`Test message from Formbricks at ${new Date().toISOString()}`);
    alert("Message sent to Sentry! Check your dashboard.");
  };

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-4 text-2xl font-bold">Sentry Integration Test</h1>

      <div className="mb-6 rounded-md bg-gray-50 p-4">
        <p className="mb-2">
          <strong>Environment DSN:</strong> {sentryDsn ? sentryDsn : "Not configured"}
        </p>
        <p className="mb-2">
          <strong>Sentry Status:</strong> {sentryStatus}
        </p>
        <p className="text-sm text-gray-500">
          {sentryDsn
            ? "Sentry should capture events when you click the test buttons."
            : "NEXT_PUBLIC_SENTRY_DSN is not set. Sentry should be inactive."}
        </p>
      </div>

      <div className="space-x-4">
        <Button variant="default" onClick={handleTestError}>
          Test Error Event
        </Button>

        <Button variant="secondary" onClick={handleTestMessage}>
          Test Message Event
        </Button>
      </div>
    </div>
  );
}
