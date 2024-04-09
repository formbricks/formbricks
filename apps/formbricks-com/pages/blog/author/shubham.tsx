import LayoutMdx from "@/components/shared/LayoutMdx";
import Shubham from "@/images/blog/shubham-engineer.png";
import { GithubIcon, LinkedinIcon, LucideTwitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const meta = {
  title: "Shubham Palriwala",
  description: "Full-Stack Engineer and Open Source Enthusiast",
  date: "2024-03-21",
  publishedTime: "2024-03-21T12:00:00",
  authors: ["Shubham"],
  section: "Authors",
  tags: ["Commecial Open Source", "Entrepreneurship", "Open Source"],
  ogImage: "/social-image.png",
};

export default function AuthorBox({}) {
  return (
    <LayoutMdx meta={meta}>
      <div className="mb-8 flex items-center space-x-4 rounded-lg border border-slate-200 bg-slate-100 p-6 ">
        <div className="flex w-full items-end justify-between">
          <div>
            <Image
              alt="Shubham Palriwala"
              className="m-0 rounded-lg"
              src={Shubham}
              width={150}
              height={150}
              quality={100}
              placeholder="blur"
              style={{ objectFit: "contain" }}
            />
            <p className="!mb-0 !mt-6 !text-xl font-medium text-slate-600">Shubham Palriwala</p>
            <p className="!m-0 text-sm text-slate-500">Full-Stack Engineer and Open Source Enthusiast</p>
          </div>
          <div className=" text-right">
            <Link href="https://twitter.com/ShubhamInTech" target="_blank">
              <p className="!m-0 flex items-center justify-end font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300">
                Twitter
                <LucideTwitter className="ml-3" />
              </p>
            </Link>
            <Link href="https://github.com/shubhampalriwala" target="_blank">
              <p className="!m-0 flex items-center justify-end font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300">
                GitHub
                <GithubIcon className="ml-3" />
              </p>
            </Link>
            <Link href="https://www.linkedin.com/in/shubhampalriwala/" target="_blank">
              <p className="!m-0 flex items-center justify-end font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300">
                LinkedIn
                <LinkedinIcon className="ml-3" />
              </p>
            </Link>
          </div>
        </div>
      </div>
    </LayoutMdx>
  );
}
