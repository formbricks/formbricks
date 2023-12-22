import AuthorJohannes from "@/images/blog/johannes-co-founder-formbricks-small.jpg";
import AuthorOla from "@/images/blog/ola-content-writer.png";
import Image from "next/image";

interface AuthorBoxProps {
  name: string;
  title: string;
  date: string;
  duration: string;
  author: string;
}

export default function AuthorBox({ name, title, date, duration, author }: AuthorBoxProps) {
  return (
    <div className="mb-8 flex items-center space-x-4 rounded-lg border border-slate-200 bg-slate-100 px-6 py-3 dark:border-slate-700 dark:bg-slate-800">
      <Image
        className="m-0 rounded-full"
        src={author === "Johannes" ? AuthorJohannes : AuthorOla}
        alt={name}
        width={45}
        height={45}
        quality={100}
        // placeholder="blur"
        style={{ objectFit: "contain" }}
      />
      <div className="flex w-full items-end justify-between">
        <div>
          <p className="leading-0 !m-0  font-medium text-slate-600 dark:text-slate-300">{name}</p>
          <p className="!m-0 text-sm text-slate-400">{title}</p>
        </div>
        <div className="text-right">
          <p className="!m-0 font-medium text-slate-600 dark:text-slate-300">{duration} Minutes</p>
          <p className="!m-0 text-sm text-slate-400">{date}</p>
        </div>
      </div>
    </div>
  );
}
