import { useId } from "react";

export function GridPattern({
  width,
  height,
  x,
  y,
  squares,
  ...props
}: React.ComponentPropsWithoutRef<"svg"> & {
  width: number;
  height: number;
  x: string | number;
  y: string | number;
  squares: [x: number, y: number][];
}): React.JSX.Element {
  const patternId = useId();

  return (
    <svg aria-hidden="true" {...props}>
      <defs>
        <pattern id={patternId} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height.toString()}V.5H${width.toString()}`} fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${patternId})`} />
      {squares.length > 0 ? (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([sqX, sqY]) => (
            <rect
              strokeWidth="0"
              key={`${sqX.toString()}-${sqY.toString()}`}
              width={width + 1}
              height={height + 1}
              x={sqX * width}
              y={sqY * height}
            />
          ))}
        </svg>
      ) : null}
    </svg>
  );
}
