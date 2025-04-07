interface ResponsiveVideoProps {
  src: string;
  title?: string;
}

export const ResponsiveVideo: React.FC<ResponsiveVideoProps> = ({ src, title }: ResponsiveVideoProps) => {
  return (
    <div className="relative" style={{ paddingTop: "56.25%" }}>
      <iframe
        className="absolute top-0 left-0 h-full w-full rounded-sm"
        src={src}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen></iframe>
    </div>
  );
};
