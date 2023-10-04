"use client";

import Link from "next/link";
import { type MotionValue, motion, useMotionTemplate, useMotionValue } from "framer-motion";

import { GridPattern } from "./GridPattern";
import { Heading } from "./Heading";
import { ChatBubbleIcon } from "@/components/docs/icons/ChatBubbleIcon";
import { EnvelopeIcon } from "@/components/docs/icons/EnvelopeIcon";
import { UserIcon } from "@/components/docs/icons/UserIcon";
import { UsersIcon } from "@/components/docs/icons/UsersIcon";

interface BestPractice {
  href: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  pattern: Omit<React.ComponentPropsWithoutRef<typeof GridPattern>, "width" | "height" | "x">;
}

const bestPractices: Array<BestPractice> = [
  {
    href: "/docs/best-practices/cancel-subscription",
    name: "Learn from Churn",
    description: "Churn is hard, but can teach you a lot. These insights are pure gold to reduce churn.",
    icon: UserIcon,
    pattern: {
      y: 16,
      squares: [
        [0, 1],
        [1, 3],
      ],
    },
  },
  {
    href: "/docs/best-practices/pmf-survey",
    name: "Product Market Fit",
    description:
      "Measuring and understanding your PMF helps you understand what users like, what they’re missing and what to build next.",
    icon: ChatBubbleIcon,
    pattern: {
      y: -6,
      squares: [
        [-1, 2],
        [1, 3],
      ],
    },
  },
  {
    href: "/docs/best-practices/improve-trial-cr",
    name: "Improve Trial Conversion",
    description: "When a user doesn't convert, you want to know why.",
    icon: EnvelopeIcon,
    pattern: {
      y: 32,
      squares: [
        [0, 2],
        [1, 4],
      ],
    },
  },
  {
    href: "/docs/best-practices/feedback-box",
    name: "Feedback Box",
    description: "The Feedback Box gives your users a direct channel to share their feedback and feel heard.",
    icon: UsersIcon,
    pattern: {
      y: 22,
      squares: [[0, 1]],
    },
  },
];

function BestPracticeIcon({ icon: Icon }: { icon: BestPractice["icon"] }) {
  return (
    <div className="dark:bg-white/7.5 dark:ring-white/15 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/5 ring-1 ring-slate-900/25 backdrop-blur-[2px] transition duration-300 group-hover:bg-white/50 group-hover:ring-slate-900/25 dark:group-hover:bg-emerald-300/10 dark:group-hover:ring-emerald-400">
      <Icon className="h-5 w-5 fill-slate-700/10 stroke-slate-700 transition-colors duration-300 group-hover:stroke-slate-900 dark:fill-white/10 dark:stroke-slate-400 dark:group-hover:fill-emerald-300/10 dark:group-hover:stroke-emerald-400" />
    </div>
  );
}

function BestPracticePattern({
  mouseX,
  mouseY,
  ...gridProps
}: BestPractice["pattern"] & {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}) {
  let maskImage = useMotionTemplate`radial-gradient(180px at ${mouseX}px ${mouseY}px, white, transparent)`;
  let style = { maskImage, WebkitMaskImage: maskImage };

  return (
    <div className="pointer-events-none">
      <div className="absolute inset-0 rounded-2xl transition duration-300 [mask-image:linear-gradient(white,transparent)] group-hover:opacity-50">
        <GridPattern
          width={72}
          height={56}
          x="50%"
          className="dark:fill-white/1 dark:stroke-white/2.5 absolute inset-x-0 inset-y-[-30%] h-[160%] w-full skew-y-[-18deg] fill-black/[0.02] stroke-black/5"
          {...gridProps}
        />
      </div>
      <motion.div
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#D7EDEA] to-[#F4FBDF] opacity-0 transition duration-300 group-hover:opacity-100 dark:from-[#152e30] dark:to-[#303428]"
        style={style}
      />
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 mix-blend-overlay transition duration-300 group-hover:opacity-100"
        style={style}>
        <GridPattern
          width={72}
          height={56}
          x="50%"
          className="dark:fill-white/2.5 absolute inset-x-0 inset-y-[-30%] h-[160%] w-full skew-y-[-18deg] fill-black/50 stroke-black/70 dark:stroke-white/10"
          {...gridProps}
        />
      </motion.div>
    </div>
  );
}

function BestPractice({ resource }: { resource: BestPractice }) {
  let mouseX = useMotionValue(0);
  let mouseY = useMotionValue(0);

  function onMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent<HTMLDivElement>) {
    let { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      key={resource.href}
      onMouseMove={onMouseMove}
      className="dark:bg-white/2.5 group relative flex rounded-2xl bg-slate-50 transition-shadow hover:shadow-md hover:shadow-slate-900/5 dark:hover:shadow-black/5">
      <BestPracticePattern {...resource.pattern} mouseX={mouseX} mouseY={mouseY} />
      <div className="ring-slate-900/7.5 absolute inset-0 rounded-2xl ring-1 ring-inset group-hover:ring-slate-900/10 dark:ring-white/10 dark:group-hover:ring-white/20" />
      <div className="relative rounded-2xl px-4 pb-4 pt-16">
        <BestPracticeIcon icon={resource.icon} />
        <h3 className="mt-4 text-sm font-semibold leading-7 text-slate-900 dark:text-white">
          <Link href={resource.href}>
            <span className="absolute inset-0 rounded-2xl" />
            {resource.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{resource.description}</p>
      </div>
    </div>
  );
}

export default function BestPractices() {
  return (
    <div className="my-16 xl:max-w-none">
      <Heading level={2} id="resources">
        Best Practices
      </Heading>
      <div className="not-prose mt-4 grid grid-cols-1 gap-8 border-t border-slate-900/5 pt-10 dark:border-white/5 sm:grid-cols-2 xl:grid-cols-4">
        {bestPractices.map((resource) => (
          <BestPractice key={resource.href} resource={resource} />
        ))}
      </div>
    </div>
  );
}
