import { getResultText } from "../../shared/tool-result";
import { Card, Loading } from "../../shared/ui";
import { useToolView } from "../../shared/use-tool-view";

// Placeholder until the feedback-chart view is built.
export const App = () => {
  const { isConnected, result } = useToolView();

  if (!isConnected || !result) {
    return <Loading label="Loading…" />;
  }

  return (
    <Card>
      <h1 className="fb-title">Feedback chart</h1>
      <p className="fb-muted">{getResultText(result)}</p>
    </Card>
  );
};
