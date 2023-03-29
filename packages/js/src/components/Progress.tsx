import { h } from "preact";

export default function Progress({ progress, brandColor }: { progress: number; brandColor: string }) {
  return (
    <div className="fb-h-1 fb-w-full fb-rounded-full bg-slate-200">
      <div
        className="fb-h-1 fb-rounded-full"
        style={{ backgroundColor: brandColor, width: `${Math.floor(progress * 100)}%` }}></div>
    </div>
  );
}
