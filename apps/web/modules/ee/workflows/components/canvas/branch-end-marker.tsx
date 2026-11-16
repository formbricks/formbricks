import { WORKFLOW_CANVAS_CONNECTOR } from "@/modules/ee/workflows/lib/canvas-geometry";

const barStyle = (width: number) => ({
  width,
  height: WORKFLOW_CANVAS_CONNECTOR.width,
  background: WORKFLOW_CANVAS_CONNECTOR.color,
});

/**
 * Where a path ends when no step can be added there (pan mode, a read-only workflow): two bars,
 * like a flowchart's end mark, so the line doesn't just stop. The `+` takes its place while editing.
 */
export const BranchEndMarker = () => (
  <div aria-hidden="true" className="flex flex-col items-center gap-1">
    <div style={barStyle(20)} />
    <div style={barStyle(10)} />
  </div>
);
