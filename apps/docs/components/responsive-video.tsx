// ResponsiveVideo.tsx
export function ResponsiveVideo({ src, title }: { src: string; title: string }): React.JSX.Element {
  return (
    <div className="max-w-[1280px]">
      <div className="relative w-full overflow-hidden pt-[56.25%]">
        <iframe
          src={src}
          title={title}
          frameBorder="0"
          className="absolute left-0 top-0 h-full w-full"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen />
      </div>
    </div>
  );
}
