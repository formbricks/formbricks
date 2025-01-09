"use client";

import { type MotionValue, motion, useMotionTemplate, useMotionValue } from "framer-motion";
import Link from "next/link";
import { GridPattern } from "@/components/grid-pattern";
import { Heading } from "@/components/heading";
import { ChatBubbleIcon } from "@/components/icons/chat-bubble-icon";
import { EnvelopeIcon } from "@/components/icons/envelope-icon";
import { UserIcon } from "@/components/icons/user-icon";
import { UsersIcon } from "@/components/icons/users-icon";

interface TResource {
  href: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  pattern: Omit<React.ComponentPropsWithoutRef<typeof GridPattern>, "width" | "height" | "x">;
}

const resources: TResource[] = [
  {
    href: "/contacts",
    name: "Contacts",
    description:
      "Learn about the contact model and how to create, retrieve, update, delete, and list contacts.",
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
    href: "/conversations",
    name: "Conversations",
    description:
      "Learn about the conversation model and how to create, retrieve, update, delete, and list conversations.",
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
    href: "/messages",
    name: "Messages",
    description:
      "Learn about the message model and how to create, retrieve, update, delete, and list messages.",
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
    href: "/groups",
    name: "Groups",
    description: "Learn about the group model and how to create, retrieve, update, delete, and list groups.",
    icon: UsersIcon,
    pattern: {
      y: 22,
      squares: [[0, 1]],
    },
  },
];

function ResourceIcon({ icon: Icon }: { icon: TResource["icon"] }) {
  return (
    <div className="dark:bg-white/7.5 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/5 ring-1 ring-zinc-900/25 backdrop-blur-[2px] transition duration-300 group-hover:bg-white/50 group-hover:ring-zinc-900/25 dark:ring-white/15 dark:group-hover:bg-teal-300/10 dark:group-hover:ring-teal-400">
      <Icon className="h-5 w-5 fill-zinc-700/10 stroke-zinc-700 transition-colors duration-300 group-hover:stroke-zinc-900 dark:fill-white/10 dark:stroke-zinc-400 dark:group-hover:fill-teal-300/10 dark:group-hover:stroke-teal-400" />
    </div>
  );
}

function ResourcePattern({
  mouseX,
  mouseY,
  ...gridProps
}: TResource["pattern"] & {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}) {
  const maskImage = useMotionTemplate`radial-gradient(180px at ${mouseX}px ${mouseY}px, white, transparent)`;
  const style = { maskImage, WebkitMaskImage: maskImage };

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
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#D7EDEA] to-[#F4FBDF] opacity-0 transition duration-300 group-hover:opacity-100 dark:from-[#202D2E] dark:to-[#303428]"
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

function Resource({ resource }: { resource: TResource }): React.JSX.Element {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const onMouseMove = ({ currentTarget, clientX, clientY }: React.MouseEvent<HTMLDivElement>) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  return (
    <div
      key={resource.href}
      onMouseMove={onMouseMove}
      className="dark:bg-white/2.5 group relative flex rounded-2xl bg-zinc-50 transition-shadow hover:shadow-md hover:shadow-zinc-900/5 dark:hover:shadow-black/5">
      <ResourcePattern {...resource.pattern} mouseX={mouseX} mouseY={mouseY} />
      <div className="ring-zinc-900/7.5 absolute inset-0 rounded-2xl ring-1 ring-inset group-hover:ring-zinc-900/10 dark:ring-white/10 dark:group-hover:ring-white/20" />
      <div className="relative rounded-2xl px-4 pb-4 pt-16">
        <ResourceIcon icon={resource.icon} />
        <h3 className="mt-4 text-sm font-semibold leading-7 text-zinc-900 dark:text-white">
          <Link href={resource.href}>
            <span className="absolute inset-0 rounded-2xl" />
            {resource.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{resource.description}</p>
      </div>
    </div>
  );
}

export function Resources(): React.JSX.Element {
  return (
    <div className="my-16 xl:max-w-none">
      <Heading level={2} id="resources">
        Resources
      </Heading>
      <div className="not-prose mt-4 grid grid-cols-1 gap-8 border-t border-zinc-900/5 pt-10 sm:grid-cols-2 xl:grid-cols-4 dark:border-white/5">
        {resources.map((resource) => (
          <Resource key={resource.href} resource={resource} />
        ))}
      </div>
    </div>
  );
}
