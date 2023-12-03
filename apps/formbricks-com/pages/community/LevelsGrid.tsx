import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa6";

type Contributor = {
  githubId: string;
  imgUrl: string;
  name: string;
};

type LevelGridProps = {
  contributors: Contributor[];
};

const LevelGrid: React.FC<LevelGridProps> = ({ contributors }) => {
  return (
    <div className="-mt-64 grid scale-105 grid-cols-4 gap-6 md:-mt-32 md:grid-cols-8">
      {contributors?.map((contributor, index) => (
        <div key={index} className={`col-span-1 ${index % 2 !== 0 ? "-mt-8" : ""}`}>
          <Link
            href={`https://github.com/${contributor.githubId}`}
            target="_blank"
            className="group transition-transform">
            <div className="bg-brand-dark  mx-auto -mb-12 flex w-fit max-w-[90%] items-center justify-center rounded-t-xl px-4 pb-3 pt-1 text-sm text-slate-100 transition-all group-hover:-mt-12 group-hover:mb-0">
              <FaGithub className="mr-2 h-4 w-4" />
              <p className="max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">
                {contributor.githubId}
              </p>
            </div>
            <Image
              src={contributor.imgUrl}
              alt={contributor.name}
              className="ring-brand-dark rounded-lg ring-offset-4 ring-offset-slate-900 transition-all hover:scale-110 hover:ring-1"
              width={500}
              height={500}
            />
          </Link>
        </div>
      ))}
    </div>
  );
};

export default LevelGrid;
