import { Button } from "@formbricks/ui/Button";
import Link from "next/link";

interface RoadmapProps {
  data: Object;
}

export const Roadmap: React.FC<RoadmapProps> = ({ data }) => {
  return (
    <div className="text-left">
      {data.map((eventblock) => (
        <div key={eventblock.id} className="">
          <h3 className="my-4 pt-4 font-semibold text-slate-800">
            {eventblock.description} • <span className="font-normal">{eventblock.period}</span>
          </h3>
          {eventblock.events.map((event) => (
            <div key={event.name}>
              {event.link ? (
                <Link
                  href="ok"
                  target="_blank"
                  className="mb-2 block rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 text-slate-700 transition-all hover:scale-105 hover:border-slate-300 hover:bg-slate-200">
                  {event.name}
                </Link>
              ) : (
                <div className="mb-2 block rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 text-slate-700 transition-all">
                  {event.name}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <Button
        href="https://formbricks.com/discord"
        target="_blank"
        className="rounded-xl border-pink-600 bg-pink-500 px-6 py-3 text-base transition-all hover:scale-105">
        What’s next? Request features on Discord
      </Button>
    </div>
  );
};

export default Roadmap;
