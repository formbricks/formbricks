import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa6";

const levels = [
  {
    name: "Shubham Palriwala",
    githubId: "ShubhamPalriwala",
    points: "100",
    level: "prime",
    imgUrl: "https://avatars.githubusercontent.com/u/55556994?v=4",
  },
  {
    name: "Rotimi Best",
    githubId: "rotimi-best",
    points: "100",
    level: "prime",
    imgUrl: "https://avatars.githubusercontent.com/u/31730715?v=4",
  },
  {
    name: "Dhruwang Jariwala",
    githubId: "Dhruwang",
    points: "100",
    level: "prime",
    imgUrl: "https://avatars.githubusercontent.com/u/67850763?v=4",
  },
  {
    name: "Piyush Gupta",
    githubId: "gupta-piyush19",
    points: "100",
    level: "prime",
    imgUrl: "https://avatars.githubusercontent.com/u/56182734?v=4",
  },
  {
    name: "Naitik Kapadia",
    githubId: "KapadiaNaitik",
    points: "100",
    level: "deputy",
    imgUrl: "https://avatars.githubusercontent.com/u/88614335?v=4",
  },
  {
    name: "Anshuman Pandey",
    githubId: "pandeymangg",
    points: "100",
    level: "prime",
    imgUrl: "https://avatars.githubusercontent.com/u/54475686?v=4",
  },
  {
    name: "Midka",
    githubId: "kymppi",
    points: "100",
    level: "deputy",
    imgUrl: "https://avatars.githubusercontent.com/u/48528700?v=4",
  },
  {
    name: "Meet Patel",
    githubId: "Meetcpatel",
    points: "100",
    level: "deputy",
    imgUrl: "https://avatars.githubusercontent.com/u/26919832?v=4",
  },
  {
    name: "Ankur Datta",
    githubId: "Ankur-Datta-4",
    points: "100",
    level: "deputy",
    imgUrl: "https://avatars.githubusercontent.com/u/75306530?v=4",
  },
  {
    name: "Abhinav Arya",
    githubId: "itzabhinavarya",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/95561280?v=4",
  },
  {
    name: "Anjy Gupta",
    githubId: "anjy7",
    points: "100",
    level: "deputy",
    imgUrl: "https://avatars.githubusercontent.com/u/92802904?v=4",
  },
  {
    name: "Aditya Deshlahre",
    githubId: "adityadeshlahre",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/132184385?v=4",
  },
  {
    name: "Ashutosh Bhadauriya",
    githubId: "Ashutosh-Bhadauriya",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/62984427?v=4",
  },
  {
    name: "Bilal Mirza",
    githubId: "bilalmirza74",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/84387676?v=4",
  },
  {
    name: "Timothy",
    githubId: "timothyde",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/13225886?v=4",
  },
  {
    name: "Jonas Höbenreich",
    githubId: "jonas-hoebenreich",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/64426524?v=4",
  },
  {
    name: "Pratik Awaik",
    githubId: "PratikAwaik",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/54103265?v=4",
  },
  {
    name: "Rohan Gupta",
    githubId: "rohan9896",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/56235204?v=4",
  },
  {
    name: "Shubham Khunt",
    githubId: "shubhamkhunt04",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/55044317?v=4",
  },
  {
    name: "Joe",
    githubId: "joe-shajan",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/69904519?v=4",
  },
  {
    name: "Ty Kerr",
    githubId: "ty-kerr",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/17407010?v=4",
  },
  {
    name: "Olasunkanmi Balogun",
    githubId: "SiR-PENt",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/80556643?v=4",
  },
  {
    name: "Ronit Panda",
    githubId: "rtpa25",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/72537293?v=4",
  },
  {
    name: "Nafees Nazik",
    githubId: "G3root",
    points: "100",
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/84864519?v=4",
  },
];

const GridComponent = ({}) => {
  return (
    <div className="-mt-64 grid scale-105 grid-cols-4 gap-6 md:-mt-32 md:grid-cols-8">
      {levels.map((contributor, index) => (
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

export default GridComponent;
