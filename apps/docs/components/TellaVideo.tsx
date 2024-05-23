import React from "react";

export const TellaVideo = ({ tellaVideoIdentifier }: { tellaVideoIdentifier: string }) => {
  return (
    <div>
      <iframe
        className="aspect-video"
        style={{
          width: "100%",
          height: "100%",
          border: 0,
        }}
        src={`https://www.tella.tv/video/${tellaVideoIdentifier}/embed?b=0&title=0&a=1&loop=0&autoPlay=true&t=0&muted=1&wt=0`}
        allowFullScreen={true}
        title="Tella Video Help"></iframe>
    </div>
  );
};
