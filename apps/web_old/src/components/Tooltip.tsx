interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  return (
    <div className="group relative flex">
      <div>{children}</div>
      <span
        className="absolute left-1/2 m-4 mx-auto w-32 -translate-x-1/2 translate-y-full rounded-md bg-slate-700 px-1 
    text-center text-xs text-slate-100 opacity-0 transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </div>
  );
}
