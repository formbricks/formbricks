import LayoutMdx from "@/components/shared/LayoutMdx";
import Sudhanshu from "@/images/blog/sudhanshu-engineer.jpeg";
import { GithubIcon, LinkedinIcon, LucideTwitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const meta = {
  title: "Sudhanshu Pandey",
  description: "Cloud Engineer",
  date: "2024-03-21",
  publishedTime: "2024-03-21T12:00:00",
  authors: ["Sudhanshu Pandey"],
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
              alt="Sudhanshu Pandey"
              className="m-0 rounded-lg"
              src={Sudhanshu}
              width={150}
              height={150}
              quality={100}
              placeholder="blur"
              style={{ objectFit: "contain" }}
            />
            <p className="!mb-0 !mt-6 !text-xl font-medium text-slate-600">Sudhanshu Pandey</p>
            <p className="!m-0 text-sm text-slate-500">Cloud Engineer</p>
          </div>
          <div className=" text-right">
            <Link href="https://twitter.com/s_pandey101" target="_blank">
              <p className="!m-0 flex items-center justify-end font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300">
                Twitter
                <LucideTwitter className="ml-3" />
              </p>
            </Link>
            <Link href="https://github.com/sp6370" target="_blank">
              <p className="!m-0 flex items-center justify-end font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300">
                GitHub
                <GithubIcon className="ml-3" />
              </p>
            </Link>
            <Link href="https://www.linkedin.com/in/sp6370/" target="_blank">
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
