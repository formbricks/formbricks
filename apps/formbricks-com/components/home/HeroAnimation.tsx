import type { LottiePlayer } from "lottie-web";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export const HeroAnimation: React.FC<any> = ({ fallbackImage, ...props }) => {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [lottie, setLottie] = useState<LottiePlayer | null>(null);

  useEffect(() => {
    import("lottie-web").then((Lottie) => setLottie(Lottie.default));
  }, []);

  useEffect(() => {
    if (lottie && ref.current) {
      const animation = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "/animations/opensource-xm-platform-formbricks.json",
      });

      animation.addEventListener("DOMLoaded", () => {
        setLoaded(true);
      });

      return () => animation.destroy();
    }
  }, [lottie]);

  return (
    <div className="relative" {...props}>
      <div ref={ref} />
      {!loaded && (
        <div className="absolute inset-0">
          <Image
            priority
            src={fallbackImage}
            alt="Fallback Image"
            className="transition-opacity duration-300"
            style={{ opacity: loaded ? 0 : 1 }}
          />
        </div>
      )}
    </div>
  );
};

export default HeroAnimation;
