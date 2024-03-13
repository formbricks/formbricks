import { ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa6";

import { Button } from "@formbricks/ui/Button";

interface Event {
  name: string;
  link?: string;
  contributorAvatarUrl?: string;
}

interface EventBlock {
  id: string;
  description: string;
  period: string;
  events: Event[];
}

interface RoadmapProps {
  data: EventBlock[];
}

export const Roadmap: React.FC<RoadmapProps> = ({ data }) => {
  return (
    <div className="px-6 text-left">
      {data?.map((eventblock) => (
        <div key={eventblock.id} className="relative mb-6 border-l-2 border-slate-400 pb-2 pl-12">
          <h3 className="my-4 hidden pt-2 font-semibold text-slate-800 md:block">
            {eventblock.description} • <span className="font-normal">{eventblock.period}</span>
          </h3>
          <h3 className="my-4 block pt-2 font-semibold text-slate-800 md:hidden">
            {eventblock.description} <br></br> <span className="font-normal">{eventblock.period}</span>
          </h3>
          {eventblock?.events?.map((event) => (
            <div key={event.name}>
              {event.link ? (
                <Link
                  href={event.link}
                  target="_blank"
                  className="group mb-2 flex max-w-fit items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 text-slate-700 transition-all hover:scale-105 hover:border-slate-300 hover:bg-slate-200">
                  {event.name}
                  <div className="relative inline-block">
                    {event.contributorAvatarUrl && (
                      <Image
                        src={event.contributorAvatarUrl}
                        alt="contributor power"
                        width={32}
                        height={32}
                        className="ml-2 transform rounded-full transition-all delay-200 group-hover:scale-0 "
                      />
                    )}
                    <FaGithub
                      className="absolute left-2 top-0 h-8 w-8 scale-0 transform text-slate-800 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100"
                      style={{ transitionDelay: "0.2s" }}
                    />
                  </div>
                </Link>
              ) : (
                <div className="mb-2 block max-w-fit rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 text-slate-700 transition-all">
                  {event.name}
                </div>
              )}
            </div>
          ))}
          {eventblock.id === "phlaunch" && (
            <Button
              href="https://formbricks.com/discord"
              target="_blank"
              variant="darkCTA"
              className="rounded-xl px-5 py-2 text-base transition-all hover:scale-105">
              What’s next? Request Features
            </Button>
          )}
          <ChevronDownIcon className="absolute -left-[17px] -mt-3 h-8 w-8 text-slate-400" />
        </div>
      ))}
      <h3 className="text-xl font-bold">Internet Domination 😇</h3>
    </div>
  );
};

export default Roadmap;
