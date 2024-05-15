// ResponsiveVideo.js
export const ResponsiveVideo = ({ src, title }) => {
  return (
    <div className="relative w-full overflow-hidden pt-[56.25%]">
      <iframe
        src={src}
        title={title}
        frameBorder="0"
        className="absolute left-0 top-0 h-full w-full"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen></iframe>
    </div>
  );
};
