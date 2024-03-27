import LayoutMdx from "@/components/shared/LayoutMdx";
import Johannes from "@/images/blog/johannes-co-founder-formbricks-small.jpg";
import { LinkedinIcon, LucideTwitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const meta = {
  title: "Johannes",
  description: "Co-Founder and CEO @ Formbricks GmbH",
  date: "2024-03-21",
  publishedTime: "2024-03-21T12:00:00",
  authors: ["Johannes Dancker"],
  section: "Authors",
  tags: ["Commecial Open Source", "Entrepreneurship"],
  ogImage: "/social-image.png",
};

export default function AuthorBox({}) {
  return (
    <LayoutMdx meta={meta}>
      <div className="mb-8 flex items-center space-x-4 rounded-lg border border-slate-200 bg-slate-100 p-6 ">
        <div className="flex w-full items-end justify-between">
          <div>
            <Image
              alt="Johannes Dancker"
              className="m-0 rounded-lg"
              src={Johannes}
              width={150}
              height={150}
              quality={100}
              placeholder="blur"
              style={{ objectFit: "contain" }}
            />
            <p className="!mb-0 !mt-6 !text-xl font-medium text-slate-600">Johannes Dancker</p>
            <p className="!m-0 text-sm text-slate-500">Co-Founder and CEO, Formbricks GmbH</p>
          </div>
          <div className=" text-right">
            <Link href="https://www.linkedin.com/in/johannes-dancker/" target="_blank">
              <p className="!m-0 flex items-center justify-end font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300">
                LinkedIn
                <LinkedinIcon className="ml-3" />
              </p>
            </Link>
            <Link href="https://twitter.com/jobenjada" target="_blank">
              <p className="!m-0 flex items-center justify-end font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300">
                Twitter
                <LucideTwitter className="ml-3" />
              </p>
            </Link>
          </div>
        </div>
      </div>
    </LayoutMdx>
  );
}
