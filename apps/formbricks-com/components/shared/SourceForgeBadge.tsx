import React, { useEffect } from "react";

const SourceForgeBadge: React.FC = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://b.sf-syn.com/badge_js?sf_id=3747607&variant_id=sf";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode?.insertBefore(script, firstScript);

    return () => {
      // Clean up the script when the component unmounts
      firstScript.parentNode?.removeChild(script);
    };
  }, []);

  return (
    <div
      data-id="3747607"
      data-badge="heart-badge-white"
      data-variant-id="sf"
      style={{ width: "75px" }}
      className="p-0.5">
      <a
        href="https://sourceforge.net/software/product/Formbricks/"
        target="_blank"
        rel="noopener noreferrer">
        Formbricks Reviews
      </a>
    </div>
  );
};

export default SourceForgeBadge;
