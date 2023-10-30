import { useState } from "react";
// import fs from 'fs';
// import {k} from '/animated-bgs/4k/1_4k'
import { useRouter } from "next/navigation";
export default function AnimatedSurveyBg({ localSurvey, handleBgChange, animationsFiles }) {
  const [color, setColor] = useState(localSurvey.surveyBackground?.bgColor || "#ffff");
  const router = useRouter();
  const [hoveredVideo, setHoveredVideo] = useState<number | null>(null);

  // const animationsFiles = [
  //   "http://localhost:3000/storage/clobsi16y0009kezgiea5k71o/public/1_4k.mp4",
  //   "http://localhost:3000/storage/clobsi16y0009kezgiea5k71o/public/2_4k.mp4",
  //   // "/animated-bgs/4K/3_4k.mp4",
  //   // "/animated-bgs/4K/4_4k.mp4",
  //   // "/animated-bgs/4K/5_4k.mp4",
  //   // "/animated-bgs/4K/6_4k.mp4",
  //   // "/animated-bgs/4K/7_4k.mp4",
  //   // "/animated-bgs/4K/8_4k.mp4",
  //   // "/animated-bgs/4K/9_4k.mp4",
  //   // "/animated-bgs/4K/10_4k.mp4",
  //   // "/animated-bgs/4K/11_4k.mp4",
  //   // "/animated-bgs/4K/12_4k.mp4",
  //   // "/animated-bgs/4K/13_4k.mp4",
  //   // "/animated-bgs/4K/14_4k.mp4",
  //   // "/animated-bgs/4K/15_4k.mp4",
  //   // "/animated-bgs/4K/16_4k.mp4",
  //   // "/animated-bgs/4K/17_4k.mp4",
  //   // "/animated-bgs/4K/18_4k.mp4",
  //   // "/animated-bgs/4K/19_4k.mp4",
  //   // "/animated-bgs/4K/20_4k.mp4",
  //   // "/animated-bgs/4K/21_4k.mp4",
  //   // "/animated-bgs/4K/22_4k.mp4",
  //   // "/animated-bgs/4K/23_4k.mp4",
  //   // "/animated-bgs/4K/24_4k.mp4",
  //   // "/animated-bgs/4K/25_4k.mp4",
  //   // "/animated-bgs/4K/26_4k.mp4",
  //   // "/animated-bgs/4K/27_4k.mp4",
  //   // "/animated-bgs/4K/28_4k.mp4",
  //   // "/animated-bgs/4K/29_4k.mp4",
  //   // "/animated-bgs/4K/30_4k.mp4",
  // ];

  const handleMouseEnter = (index: number) => {
    setHoveredVideo(index);
    playVideo(index);
  };

  const handleMouseLeave = (index: number) => {
    setHoveredVideo(null);
    pauseVideo(index);
  };

  // Function to play the video
  const playVideo = (index: number) => {
    const video = document.getElementById(`video-${index}`) as HTMLVideoElement;
    if (video) {
      video.play();
    }
  };

  // Function to pause the video
  const pauseVideo = (index: number) => {
    const video = document.getElementById(`video-${index}`) as HTMLVideoElement;
    if (video) {
      video.pause();
    }
  };

  const handleBg = (x: string) => {
    setColor(x);
    handleBgChange(x, "animation");
  };
  return (
    <div>
      <div className="mt-4 grid grid-cols-6 gap-4">
        {animationsFiles.map((x, index) => {
          return (
            <div
              key={index}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={() => handleMouseLeave(index)}
              onClick={() => handleBg(x)}
              className="cursor-pointer">
              <video
                id={`video-${index}`}
                autoPlay={hoveredVideo === index}
                className="h-46 w-96  rounded-lg">
                <source src={`${x}`} type="video/mp4" />
              </video>
            </div>
          );
        })}
      </div>
    </div>
  );
}
