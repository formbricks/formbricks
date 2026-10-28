import { useMemo } from "react";
import { Loading } from "../../shared/ui";
import { useToolView } from "../../shared/use-tool-view";
import { ResponsesBrowser } from "./ResponsesBrowser";
import { parseShowResponses } from "./parse";
import "./responses.css";
import { resultKey } from "./state";

const Failure = ({ message }: Readonly<{ message: string }>) => (
  <div className="fb-notice fb-notice-danger" role="alert">
    {message}
  </div>
);

export const App = () => {
  const { app, isConnected, connectionError, result, cancelledReason, hostContext } = useToolView();
  const parsed = useMemo(() => (result ? parseShowResponses(result) : undefined), [result]);

  if (connectionError)
    return <Failure message={`Could not connect to the host: ${connectionError.message}`} />;
  if (cancelledReason) return <Failure message="The request was cancelled before any responses loaded." />;
  if (!isConnected || !parsed) return <Loading label="Loading responses…" />;
  if (!parsed.ok) return <Failure message={parsed.message} />;

  return (
    <ResponsesBrowser
      key={resultKey(parsed.value)}
      app={app}
      initial={parsed.value}
      display={{ locale: hostContext?.locale ?? "en-US", timeZone: hostContext?.timeZone ?? "UTC" }}
    />
  );
};
