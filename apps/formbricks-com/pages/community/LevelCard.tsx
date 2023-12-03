import Image from "next/image";
import React from "react";

const BadgeCard = ({ badgeSrc, badgeAlt, title, points, tasks }) => (
  <div className="group">
    <div className="flex w-full flex-col items-center rounded-t-xl bg-slate-700 p-10 transition-colors">
      <Image
        src={badgeSrc}
        alt={badgeAlt}
        className="h-32 w-32 transition-all delay-100 duration-300 group-hover:-rotate-6 group-hover:scale-110"
      />
      <p className="mt-4 text-lg font-bold text-slate-200">{title}</p>
      <p className="text-sm leading-5 text-slate-400">{points}</p>
    </div>
    <div className="w-full rounded-b-xl bg-slate-600 p-10 text-left">
      {tasks.map((task, index) => (
        <React.Fragment key={index}>
          <p className="font-bold text-slate-200">{task.title}</p>
          <p className="mb-6 leading-5 text-slate-400">{task.description}</p>
        </React.Fragment>
      ))}
    </div>
  </div>
);

export default BadgeCard;
