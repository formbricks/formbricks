import { useState } from "react";
// import fs from 'fs';
// import {k} from '/animated-bgs/4k/1_4k'

export default function AnimatedSurveyBg({ localSurvey, handleBgColorChange }) {
  const [color, setColor] = useState(localSurvey.surveyBackground?.bgColor || "#ffff");
  const animationsFiles = ["/animated-bgs/1_4k", "/animated-bgs/2_4k"];
  // const animations = fs.readdirSync(animationsFiles);

  const handleBg = (x: string) => {
    setColor(x);
    handleBgColorChange(x);
  };
  return (
    <div>
      <div className="grid grid-cols-6 gap-4">
        {/* {animationsFiles.map((x) => {
          return (
            <video  muted loop >         
                <source src={x} type="video/mp4"/>       
            </video>
          );
        })} */}
        {/* <video  muted loop >         
        <source src="/animated-bgs/4k/1_4k.mp4" type="video/mp4"/>     
            </video> */}
        <video src="/public/animated-bgs/4K/1_4k.mp4" loop muted className=""></video>
      </div>
    </div>
  );
}
