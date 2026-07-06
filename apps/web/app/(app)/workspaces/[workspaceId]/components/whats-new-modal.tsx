"use client";

import Image, { type StaticImageData } from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/modules/ui/components/dialog";

interface WhatsNewHighlight {
  title: string;
  description: string;
}

interface WhatsNewEntry {
  id: string;
  tag: string;
  title: string;
  body: string;
  /** Optional hero image. Use a static import or a path under /public. */
  image?: string | StaticImageData;
  imageAlt?: string;
  highlights: WhatsNewHighlight[];
}

// Newest first — add new announcements at the top of this list.
export const WHATS_NEW_ENTRIES: WhatsNewEntry[] = [
  {
    id: "in-app-surveys",
    tag: "What's New",
    title: "In-app surveys are here",
    body: "Formbricks now runs its own surveys inside the app. Reach users in context and trigger targeted surveys from the dashboard — no redirects, no separate tools.",
    highlights: [
      {
        title: "Trigger on any action",
        description:
          "Fire a code action from anywhere in the app and target a survey to it from the Formbricks dashboard.",
      },
      {
        title: "Share feedback, instantly",
        description:
          'The "Share feedback" menu item now opens a survey in-app instead of sending you to GitHub.',
      },
      {
        title: "Onboarding nudges",
        description:
          "Surveys can be triggered on milestones like publishing your second survey, so you can ask the right question at the right moment.",
      },
    ],
  },
];

const WHATS_NEW_COOKIE = "fb_whats_new_seen";
const WHATS_NEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Number of announcements the user hasn't seen yet. The cookie stores the id of the
// last-seen (top) entry; everything above it in the list is newer and counts as unread.
export const getUnreadWhatsNewCount = (): number => {
  if (typeof document === "undefined") return 0;
  const seenId = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${WHATS_NEW_COOKIE}=`))
    ?.split("=")[1];
  if (!seenId) return WHATS_NEW_ENTRIES.length;
  const seenIndex = WHATS_NEW_ENTRIES.findIndex((entry) => entry.id === seenId);
  return seenIndex === -1 ? WHATS_NEW_ENTRIES.length : seenIndex;
};

// Marks the latest announcement as seen so the unread badge clears.
export const markWhatsNewSeen = (): void => {
  if (typeof document === "undefined" || WHATS_NEW_ENTRIES.length === 0) return;
  const latestId = WHATS_NEW_ENTRIES[0].id;
  document.cookie = `${WHATS_NEW_COOKIE}=${latestId}; path=/; max-age=${WHATS_NEW_COOKIE_MAX_AGE}; SameSite=Lax`;
};

interface WhatsNewModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const WhatsNewModal = ({ open, setOpen }: WhatsNewModalProps) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent width="default" className="gap-0 overflow-y-auto p-0">
        <DialogTitle className="sr-only">What&apos;s New</DialogTitle>
        <div className="flex flex-col divide-y divide-slate-100">
          {WHATS_NEW_ENTRIES.map((entry) => (
            <article key={entry.id} className="p-6">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <span className="inline-block size-2 rounded-full bg-slate-400" />
                {entry.tag}
              </div>
              <h2 className="text-lg font-semibold text-slate-900">{entry.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{entry.body}</p>

              {entry.image && (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  <Image
                    src={entry.image}
                    alt={entry.imageAlt ?? entry.title}
                    width={800}
                    height={400}
                    className="h-auto w-full"
                  />
                </div>
              )}

              {entry.highlights.length > 0 && (
                <>
                  <h3 className="mt-6 text-sm font-semibold text-slate-900">Highlights</h3>
                  <ul className="mt-2 space-y-3">
                    {entry.highlights.map((highlight) => (
                      <li key={highlight.title} className="flex gap-2 text-sm text-slate-600">
                        <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-slate-400" />
                        <span>
                          <span className="font-semibold text-slate-900">{highlight.title}</span> —{" "}
                          {highlight.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
