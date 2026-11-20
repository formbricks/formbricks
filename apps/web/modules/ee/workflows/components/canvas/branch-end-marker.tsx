import { cn } from "@/lib/cn";
import {
  type TWorkflowCanvasDirection,
  WORKFLOW_CANVAS_CONNECTOR,
} from "@/modules/ee/workflows/lib/canvas-geometry";

const barStyle = (length: number, isHorizontal: boolean) => ({
  width: isHorizontal ? WORKFLOW_CANVAS_CONNECTOR.width : length,
  height: isHorizontal ? length : WORKFLOW_CANVAS_CONNECTOR.width,
  background: WORKFLOW_CANVAS_CONNECTOR.color,
});

/**
 * The end of an If/else or Switch branch with no step, when no step can be added there (pan mode, a
 * read-only workflow): two bars, like a flowchart's end mark, so the line doesn't just stop. The `+`
 * takes its place while editing. A path that ends on a step has none: the card is its end.
 */
export const BranchEndMarker = ({
  direction = "vertical",
}: Readonly<{ direction?: TWorkflowCanvasDirection }>) => {
  const isHorizontal = direction === "horizontal";
  return (
    <div aria-hidden="true" className={cn("flex items-center gap-1", isHorizontal ? "flex-row" : "flex-col")}>
      <div style={barStyle(20, isHorizontal)} />
      <div style={barStyle(10, isHorizontal)} />
    </div>
  );
};
