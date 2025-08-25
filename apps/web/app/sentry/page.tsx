// Create or modify a test page: apps/web/app/test-sentry/page.tsx
"use client";

import { useState } from "react";

export default function TestSentryPage() {
  const [shouldError, setShouldError] = useState(false);

  const triggerError = () => {
    // This will trigger an error that should show up in Sentry with sourcemaps
    throw new Error("Test error for sourcemap validation - this should show original source location!");
  };

  const triggerAsyncError = async () => {
    // Test async error
    await new Promise(resolve => setTimeout(resolve, 100));
    throw new Error("Async test error for sourcemap validation!");
  };

  if (shouldError) {
    triggerError();
  }

  return (
    <div className="p-8">
      <h1>Sentry Sourcemap Test</h1>
      <div className="space-y-4">
        <button 
          onClick={() => setShouldError(true)}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Trigger Sync Error
        </button>
        
        <button 
          onClick={triggerAsyncError}
          className="bg-orange-500 text-white px-4 py-2 rounded"
        >
          Trigger Async Error
        </button>

        <button 
          onClick={() => {
            // Test console error
            console.error("Console error test", { data: "test-data" });
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Log Error to Console
        </button>
      </div>
    </div>
  );
}