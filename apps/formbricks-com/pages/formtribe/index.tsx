import ArrowSticker from "@/images/formtribe/arrow-stickers.png";
import DeputyBadge from "@/images/formtribe/deputy-batch.png";
import LegendBadge from "@/images/formtribe/legend-batch.png";
import PHLogo from "@/images/formtribe/ph-logo.png";
import PrimeBadge from "@/images/formtribe/prime-batch.png";
import RookieBadge from "@/images/formtribe/rookie-batch.png";
import HallOfFame from "@/pages/formtribe/HallOfFame";
import ProfileImage from "@/pages/formtribe/ProfileImage";
import Roadmap from "@/pages/formtribe/Roadmap";
import { Button } from "@formbricks/ui/Button";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import LayoutTribe from "./LayoutTribe";

const SideQuests = [
  {
    points: "Spread the Word Tweet (100 Points)",
    quest: "Tweet “🧱🚀” on the day of the ProductHunt launch to spread the word.",
    proof: "Share the link to the tweet in the “side-quest” channel.",
  },
  {
    points: "Meme Magic (50 Points + up to 100 Points)",
    quest:
      "Craft a meme where a brick plays a role. For extra points, tweet it, tag us and score +5 for each like.",
    proof: "Share meme or link to the tweet in the “side-quest” channel.",
  },
  {
    points: "GIF Magic (100 Points)",
    quest:
      "Create a branded gif related to Formbricks. Upload it to Giphy. For extra points, tweet it, tag us and score +5 for each like.",
    proof: "Share link to Giphy in the “side-quest” channel.",
  },
  {
    points: "Design a background (250 Points)",
    quest: "Illustrate a captivating background for survey enthusiasts (more infos on Notion).",
    proof: "Share the design in the “side-quest” channel.",
  },
  {
    points: "Starry-eyed Supporter (250 Points)",
    quest: "Get five friends to star our repository.",
    proof: "Share 5 screenshots of the chats where you asked them and they confirmed + their GitHub names",
  },
  {
    points: "Bug Hunter (100 Points)",
    quest:
      "Find and report any bugs in our core product. We will close all bugs on the landing page bc we don't have time for that before the launch :)",
    proof: "Open a bug issue in our repository.",
  },
  {
    points: "Brickify someone famous with AI (200 Points + up to 100 Points)",
    quest:
      "Find someone whose name would be funny as a play on words with “brick”. Then, with the help of AI, create a brick version of this person like Brick Astley, Brickj Minaj, etc. For extra points, tweet it, tag us and score +5 for each like.",
    proof: "Share your art or link to the tweet in the “side-quest” channel.",
  },
  {
    points: "Community Connector (50 points each, up to 250 points)",
    quest:
      "Introduce and onboard new members to the community. Have them join Discord and reply to their automated welcome message with your discord handle (in “say-hi” channel).",
    proof: "New member joined and commented with your Discord handle",
  },
  {
    points: "Feedback Fanatic (50 Points)",
    quest: "Fill out our feedback survey after the hackathon with suggestions for improvement.",
    proof: "Submit the survey.",
  },
  {
    points: "Side Quest Babo (500 Points)",
    quest: "Complete all side quests.",
    proof: "All quests marked as completed.",
  },
];

const TheDeal = [
  {
    os: "100% free",
    free: "Unlimited Surveys",
    pro: "Custom URL",
  },
  {
    os: "All features included",
    free: "Unlimited Submissions",
    pro: "Remove Branding",
  },
  {
    os: "It's your storage, go nuts!",
    free: "Upload Limit 10 MB",
    pro: "Unlimited Uploads",
  },
  {
    os: "Hook up your own Stripe",
    free: "Payments with 2% Mark Up",
    pro: "Remove Mark Up from Payments",
  },
  {
    os: "Your server, your rules",
    free: "Invite Team Members",
    pro: "",
  },
  {
    os: "The 'Do what you want' plan",
    free: "Verify Email before Submission",
    pro: "",
  },
  {
    os: "at this point I'm just filling rows",
    free: "Partial Submissions",
    pro: "",
  },
  {
    os: "I should stop",
    free: "Custom Thank You Page",
    pro: "",
  },

  {
    os: "ok one more",
    free: "Close Survey after Submission Limit",
    pro: "",
  },
  {
    os: "no flavor like free flavor",
    free: "Custom Survey Closed Message",
    pro: "",
  },
  {
    os: "...",
    free: "Close Survey on Date",
    pro: "",
  },
  {
    free: "Redirect on Completion",
    pro: "",
  },
  {
    free: "+ all upcoming community-built features",
    pro: "",
  },
];

const FAQ = [
  {
    question: "What is “FormTribe”?",
    answer: "The FormTribe is our community of contributors. Together",
  },
  {
    question: "Is this product part of Formbricks or its own, isolated tool?",
    answer:
      "The link survey is part of the Formbricks core product. The code is managed in the Formbricks mono repository.",
  },
  {
    question: "Why do I have to sign a CLA?",
    answer:
      "To assure this project to be financially viable, we have to be able to relicense the code for enterprise customers and governments. To be able to do so, we are legally obliged to have you sign a CLA.",
  },
  {
    question: "Where will this be hosted?",
    answer:
      "We offer a Formbricks Cloud hosted in Germany with a generous free plan but you can also easily self-host using Docker.",
  },
  {
    question: "Why is there a Commercial plan?",
    answer:
      "The commercial plan is for features who break the OSS WIN-WIN Loop or incur additional cost. We charge 29$ if you want a custom domain, remove Formbricks branding, collect large files in surveys or collect payments. We think that’s fair :)",
  },
  {
    question: "Are your in app surveys also free forever?",
    answer:
      "The in app surveys you can run with Formbricks are not part of this Deal. We offer a generous free plan but keep full control over the pricing in the long run. In app surveys are really powerful for products with thousands of users and something has to bring in the dollars.",
  },

  {
    question: "Can anyone join?",
    answer:
      "Yes! Even when you don’t know how to write code you can become part of the community completing side quests. As long as you know how to open a PR you are very welcome to take part irrespective of your age, gender, nationality, food preferences, taste in clothing and favorite Pokemon.",
  },
  {
    question: "How do I level up?",
    answer:
      "Every PR gives you points - doesn’t matter if it’s for code related tasks or non-code ones. With every point, you move closer to levelling up!",
  },
];

const roadmapDates = [
  {
    id: "earlywork",
    description: "Previously at Formbricks",
    period: "February until September 2023",
    events: [
      { name: "Formbricks team building surveying infrastructure for in-app surveying" },
      { name: "Loads of feature requests for Typeform-like surveying tool" },
    ],
  },
  {
    id: "hackathon",
    description: "Hackathon Kick-Off 🔥",
    period: "1st October 2023",
    events: [
      { name: "✅ Email Embeds", link: "https://google.com" },
      { name: "✅ Hidden Fields", link: "https://google.com" },
      { name: "✅ Question Type: Picture Choice", link: "https://google.com" },
      { name: "✅ Question Type: Welcome Card", link: "https://google.com" },
      { name: "✅ Add Image to Question", link: "https://google.com" },
      { name: "✅ Dynamic Link Previews", link: "https://google.com" },
      { name: "✅ Fullscreen Previews", link: "https://google.com" },
      { name: "✅ PIN protected surveys", link: "https://google.com" },
      { name: "✅ Source Tracking", link: "https://google.com" },
      { name: "✅ Time To Complete Indicator", link: "https://google.com" },
    ],
  },
  {
    id: "phlaunch",
    description: "Product Hunt Launch 🚀",
    period: "31st October 2023",
    events: [
      { name: "✅ Question Type: File Upload", link: "https://google.com" },
      { name: "✅ Notion Integration", link: "https://google.com" },
      { name: "✅ Media Backgrounds", link: "https://google.com" },
      { name: "⚙️ Custom Styling", link: "https://google.com" },
      { name: "⚙️ Recall Information", link: "https://google.com" },
      { name: "◯ Unsplash Backgrounds", link: "https://google.com" },
      { name: "◯ Question Type: Matrix", link: "https://google.com" },
      { name: "◯ Question Type: Collect payment", link: "https://google.com" },
      { name: "◯ Question Type: Schedule a call (Powered by Cal.com)", link: "https://google.com" },
      { name: "◯ Question Type: Signature (Powered by Documenso)", link: "https://google.com" },
    ],
  },
];

const members = [
  { name: "Piyush Gupta", githubId: "gupta123", points: "200", level: "prime" },
  { name: "Giyush Pupta", githubId: "gupta13", points: "500", level: "legend" },
  { name: "Ziyush Fupta", githubId: "gupta3", points: "100", level: "deputy" },
  { name: "Riyush Lupta", githubId: "gpta3", points: "50", level: "rookie" },
];

export default function FormTribeHackathon() {
  // dark mode fix
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return (
    <LayoutTribe
      title="Join the FormTribe"
      description="We build an Open Source Typeform alternative together and give it to the world. Join us!">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Kablammo:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>
      {/* Header */}

      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        <div className="py-24">
          <h1 className="mt-10 text-3xl font-bold text-slate-100 sm:text-4xl md:text-5xl">
            <span className="xl:inline">
              The Open Source Typeform Alternative for all. <br></br>Built as a community, free forever.
            </span>
          </h1>

          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-300 sm:text-lg md:mt-6 md:text-xl">
            The time is ripe, this is needed. So we ship it as a community - and give it back to the world!
            <br></br>Join our Tribe and make this possible. The Open Source gods are on our side 🤍
          </p>
        </div>
        <div className="grid grid-cols-8 gap-x-6 overflow-hidden pt-24">
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
          <ProfileImage />
        </div>
      </div>

      {/* Roadmap */}
      <div className="flex flex-col items-center justify-center bg-white pb-24 text-center">
        <div className="py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
            <span className="xl:inline">How it started, and how it’s going</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-600 sm:text-lg md:mt-6 md:text-xl">
            We kicked this off with a hackathon in October.
            <br></br>Today, you can cover 80% of survey use cases. Let’s ship the last 20% 🚀
          </p>
        </div>
        <Roadmap data={roadmapDates} />
      </div>

      {/* Levels */}
      <div className="mb-40 flex flex-col items-center justify-center text-center">
        <div className="py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-100 sm:text-3xl md:text-4xl">
            <span className="xl:inline">Level Up and Unlock Benefits</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-300 sm:text-lg md:mt-6 md:text-xl">
            The more you contribute, the higher you level up.
            <br></br>Unlock benefits like cash bounties, limited merch and more!
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4 px-12">
          <div className="group">
            <div className="flex w-full flex-col items-center rounded-t-xl bg-slate-700 p-10 transition-colors group-hover:bg-slate-600">
              <Image
                src={RookieBadge}
                alt="rookie batch"
                className="h-32 w-32 transition-all group-hover:scale-105"
              />
              <p className="mt-4 font-bold text-slate-200">Repository Rookie</p>
              <p className="text-sm leading-5 text-slate-400">10 points</p>
            </div>
            <div className="w-full rounded-b-xl bg-slate-600 p-10 text-left">
              <p className="text-sm font-bold text-slate-200">Easy issues</p>
              <p className="text-sm leading-5 text-slate-400">
                Warm up with the repo, get your first PR merged.
              </p>
              <p className="mt-4 text-sm font-bold text-slate-200">DevRel tasks</p>
              <p className="text-sm leading-5 text-slate-400">
                Write docs and manuals for better understanding.
              </p>
            </div>
          </div>
          <div className="group">
            <div className="flex w-full flex-col items-center rounded-t-xl bg-slate-700 p-10 transition-colors group-hover:bg-slate-600">
              <Image
                src={DeputyBadge}
                alt="rookie batch"
                className="h-32 w-32 transition-all group-hover:scale-105"
              />
              <p className="mt-4 font-bold text-slate-200">Deploy Deputy</p>
              <p className="text-sm leading-5 text-slate-400">100 points</p>
            </div>
            <div className="w-full rounded-b-xl bg-slate-600 p-10 text-left">
              <p className="text-sm font-bold text-slate-200">Core Contributions</p>
              <p className="text-sm leading-5 text-slate-400">Work on more complex issues. Get guidance.</p>
              <p className="mt-4 text-sm font-bold text-slate-200">Work with core team</p>
              <p className="text-sm leading-5 text-slate-400">
                Work closely with the core team, learn faster.
              </p>
            </div>
          </div>
          <div className="group">
            <div className="flex w-full flex-col items-center rounded-t-xl bg-slate-700 p-10 transition-colors group-hover:bg-slate-600">
              <Image
                src={PrimeBadge}
                alt="rookie batch"
                className="h-32 w-32 transition-all group-hover:scale-105"
              />
              <p className="mt-4 font-bold text-slate-200">Pushmaster Prime</p>
              <p className="text-sm leading-5 text-slate-400">500 points</p>
            </div>
            <div className="w-full rounded-b-xl bg-slate-600 p-10 text-left">
              <p className="text-sm font-bold text-slate-200">Cash Bounties</p>
              <p className="text-sm leading-5 text-slate-400">Get access to issues with $$$ bounties.</p>
              <p className="mt-4 text-sm font-bold text-slate-200">Job Listings</p>
              <p className="text-sm leading-5 text-slate-400">
                We hire from our contributors. Hear about jobs first.
              </p>
            </div>
          </div>
          <div className="group">
            <div className="flex w-full flex-col items-center rounded-t-xl bg-slate-700 p-10 transition-colors group-hover:bg-slate-600">
              <Image
                src={LegendBadge}
                alt="rookie batch"
                className="h-32 w-32 transition-all group-hover:scale-105"
              />
              <p className="mt-4 font-bold text-slate-200">FormTribe Legend</p>
              <p className="text-sm leading-5 text-slate-400">Special Honor</p>
            </div>
            <div className=" w-full rounded-b-xl bg-slate-600 p-10 text-left">
              <p className="text-sm font-bold text-slate-200">Unconditional Love</p>
              <p className="text-sm leading-5 text-slate-400">from the community and core team 🤍</p>
              <p className="mt-4 text-sm font-bold text-slate-200">&nbsp;</p>
              <p className="text-sm leading-5 text-slate-400">&nbsp;</p>
              <p className="text-sm leading-5 text-slate-400">&nbsp;</p>
            </div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 px-32">
          <div>
            <p className="text-lg font-bold text-slate-300">Get a Sticker Set</p>
            <Image
              src={ArrowSticker}
              alt="rookie batch"
              className="w-full transition-all group-hover:scale-105"
            />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-300">Get a Hoodie</p>
            <Image
              src={ArrowSticker}
              alt="rookie batch"
              className="w-full transition-all group-hover:scale-105"
            />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-300">Get a Special Gift</p>
            <Image
              src={ArrowSticker}
              alt="rookie batch"
              className="w-full transition-all group-hover:scale-105"
            />
          </div>
        </div>
      </div>

      {/* Become a Legend */}
      <div className="flex flex-col items-center justify-center bg-white pb-24 text-center">
        <div className="py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
            <span className="xl:inline">Become a Legend</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-600 sm:text-lg md:mt-6 md:text-xl">
            This is your wall of fame. We’re honoured to be in this together!
          </p>
        </div>
        <HallOfFame members={members} />
      </div>

      {/* Our values */}
      <div className="mb-40 flex flex-col items-center justify-center text-center">
        <div className="py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-100 sm:text-3xl md:text-4xl">
            <span className="xl:inline">Our values</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-300 sm:text-lg md:mt-6 md:text-xl">
            Apart from being decent human beings, this is what we value:
          </p>
        </div>
        <div className="grid grid-cols-3 gap-x-6 px-16">
          <ValueCard
            title="Less is more."
            description="Like with friends, we’re about forming deep and meaningful relationships within our community. If you want to merge a PR with improved punctuation to catch a green square, this is likely not the right place for you :)"
          />
          <ValueCard
            title="Show up & Pull through."
            description="When you pick a task up, please make sure to complete it in timely manner. The longer it floats around, the more merge conflicts arise."
          />
          <ValueCard
            title="Only bite off what you can chew."
            description="Open source is all about learning and so is our community. We love help you learn but have to manage our resources well. Please don’t take up tasks far outside your area of competence."
          />
        </div>
      </div>

      {/* Side Quests 
      <div className="mt-16" id="side-quests">
        <h3 className="font-kablammo my-4 text-4xl text-slate-800">🏰 Side Quests: Increase your chances</h3>
        <p className="w-3/4 text-slate-600">
          While code contributions are what gives the most points, everyone gets to bump up their chance of
          winning. Here is a list of side quests you can complete:
        </p>
        <div className="mt-8">
          <TooltipProvider delayDuration={50}>
            {SideQuests.map((quest) => (
              <div key={quest.points}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="mb-2 flex items-center gap-x-6">
                      <div className="text-2xl">✅</div>
                      <p className="text-left font-bold text-slate-700">
                        {quest.points}: <span className="font-normal">{quest.quest}</span>
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side={"top"}>
                    <p className="py-2 text-center text-slate-500 dark:text-slate-400">
                      <p className="mt-1 text-sm text-slate-600">Proof: {quest.proof}</p>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </TooltipProvider>
        </div>
        <Button
          variant="darkCTA"
          href="https://formbricks.notion.site/FormTribe-Side-Quests-4ab3b294cfa04e94b77dfddd66378ea2?pvs=4"
          target="_blank"
          className="mt-6 bg-gradient-to-br from-[#032E1E] via-[#032E1E] to-[#013C27] text-white ">
          Keep track with Notion Template
        </Button>
      </div> */}

      {/* The Promise */}
      <div className="flex flex-col items-center justify-center bg-white pb-24 text-center">
        <div className="py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
            <span className="xl:inline">The Deal</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-600 sm:text-lg md:mt-6 md:text-xl">
            We&apos;re kinda making a handshake deal here. This is it:
          </p>
        </div>
        <div className="mx-auto max-w-4xl bg-white">
          <div>
            <div className="grid grid-cols-3 items-end rounded-t-lg border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-bold text-slate-800 sm:text-base">
              <div>Self-hosted</div>
              <div>Formbricks Cloud</div>
              <TooltipProvider delayDuration={50}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      Formbricks Cloud Pro{" "}
                      <span className="ml-1 hidden rounded-full bg-slate-700 px-2 text-xs font-normal text-white sm:inline">
                        Why tho?
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={5} className="max-w-lg font-normal">
                    You can always self-host to get all features free.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {TheDeal.map((feature) => (
              <div
                key={feature.free}
                className="grid grid-cols-3 gap-x-2 border-x border-b border-slate-200 px-6 py-3 text-sm text-slate-900 last:rounded-b-lg">
                <div>{feature.os}</div>
                <div>{feature.free}</div>
                <div>{feature.pro}</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg-12 mt-6 grid-cols-6 rounded-lg bg-slate-100 py-12 sm:grid">
            <div className="col-span-1 mr-8 flex items-center justify-center sm:justify-end">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-3xl">
                🤓
              </div>
            </div>
            <div className="col-span-5 px-8 text-left sm:px-0">
              <h3 className="mt-4 text-lg font-semibold text-slate-700 sm:mt-0">
                Are Formbricks in-app surveys also free?
              </h3>
              <p className="text-slate-500 sm:pr-16">
                Just a heads-up: this deal doesn&apos;t cover Formbricks&apos; in-app surveys. We&apos;ve got
                a solid free plan, but we&apos;ve gotta keep some control over pricing to keep things running
                long-term.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Get started */}
      <div className="mb-40 flex flex-col items-center justify-center text-center">
        <div className="py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-100 sm:text-3xl md:text-4xl">
            <span className="xl:inline">Get started</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base italic text-slate-300 sm:text-lg md:mt-6 md:text-xl">
            We&apos;re still setting things up,{" "}
            <Link
              href="https://formbricks.com/discord"
              className="underline decoration-pink-500 underline-offset-2">
              join our Discord
            </Link>{" "}
            to stay in the loop :)
          </p>
        </div>
        <LoadingSpinner />
      </div>

      {/* FAQ */}
      <div id="faq" className=" bg-white px-32 pb-24">
        <div className="py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
            <span className="xl:inline">FAQ</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-600 sm:text-lg md:mt-6 md:text-xl">
            Anything unclear?
          </p>
        </div>

        {FAQ.map((question) => (
          <div key={question.question} className="">
            <div>
              <h3 className="mt-6 text-lg font-bold text-slate-700">{question.question} </h3>
              <p className="text-slate-600">{question.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </LayoutTribe>
  );
}

const SectionHeading = ({ title, descriptionLine1, descriptionLine2, id }) => {
  return (
    <div id={id} className="py-24">
      <h2 className="mt-10 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
        <span className="xl:inline">{title}</span>
      </h2>
      <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-600 sm:text-lg md:mt-6 md:text-xl">
        {descriptionLine1}
        <br></br>
        {descriptionLine2}
      </p>
    </div>
  );
};

const ValueCard = ({ title, description }) => {
  return (
    <div className="rounded-xl bg-slate-800 p-3 text-left">
      <div className="mb-4 h-24 rounded-xl border border-slate-600 bg-slate-700"></div>
      <h2 className="text-xl font-bold text-slate-300">
        <span className="xl:inline">{title}</span>
      </h2>
      <p className="text-sm leading-5 text-slate-400">{description}</p>
    </div>
  );
};

const Breaker = ({ icon, title }) => {
  return (
    <div id="join">
      <div className="rounded-lg-12 mt-12 rounded-lg bg-slate-200 px-4 py-12 shadow-inner sm:mt-20 sm:grid sm:grid-cols-6">
        <div className="col-span-2 mr-8 flex items-center justify-center sm:justify-end">
          <div className="h-24 w-24 rounded-full bg-white"></div>
          <div className="absolute -mt-4 animate-bounce text-[6rem]">{icon}</div>
        </div>
        <div className="col-span-4">
          <h3 className="mt-8 text-xl font-bold sm:mt-0">{title}</h3>
          <p className="mb-4 mt-1 text-slate-500">Get notified on launch plus a weekly update:</p>
          <form method="post" action="https://listmonk.formbricks.com/subscription/form">
            <div className="hidden">
              <input type="hidden" name="nonce" />
              <input
                id="5d65b"
                type="checkbox"
                name="l"
                checked
                value="5d65bc6e-e685-4694-8c8e-9b20d7be6c40"
              />
            </div>
            <div className="mt-2 sm:flex">
              <div className="">
                <input
                  type="email"
                  name="email"
                  placeholder="Your email"
                  aria-placeholder="your-email"
                  required
                  className="block h-12 w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 sm:mr-4 sm:h-full sm:w-64"
                />
              </div>
              <Button
                variant="highlight"
                type="submit"
                className="mt-2 inline w-full justify-center bg-gradient-to-br from-[#032E1E] via-[#032E1E] to-[#013C27] text-white sm:ml-2 sm:mt-0 sm:w-40 ">
                Join the Tribe
              </Button>
            </div>
          </form>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center">
        <Image src={PHLogo} alt="ph-logo" className="mr-2 h-8 w-8" />
        <a
          href="https://www.producthunt.com/posts/formbricks"
          target="_blank"
          className="text-sm font-semibold text-[#ff6154]">
          Get notified on Product Hunt.
        </a>
      </div>
    </div>
  );
};
