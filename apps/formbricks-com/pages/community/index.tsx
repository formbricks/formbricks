import ArrowGift from "@/images/formtribe/arrow-gift.png";
import ArrowSticker from "@/images/formtribe/arrow-stickers.png";
import DeputyBadge from "@/images/formtribe/deputy-batch.png";
import HoodieSticker from "@/images/formtribe/hoodie-stickers.png";
import LegendBadge from "@/images/formtribe/legend-batch.png";
import PrimeBadge from "@/images/formtribe/prime-batch.png";
import RookieBadge from "@/images/formtribe/rookie-batch.png";
import HallOfFame from "@/pages/community/HallOfFame";
import Roadmap from "@/pages/community/Roadmap";
import LoadingSpinner from "@formbricks/ui/LoadingSpinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import ContributorGrid from "./ContributorGrid";
import LayoutTribe from "./LayoutTribe";
import LevelCard from "./LevelCard";
import LevelsGrid from "./LevelsGrid";

/* const SideQuests = [
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
]; */

const LevelsData = [
  {
    badgeSrc: RookieBadge,
    badgeAlt: "Rookie Badge",
    title: "Repository Rookie",
    points: "Level 1",
    tasks: [
      { title: "Easy issues", description: "Warm up with the repo, get your first PR merged." },
      { title: "DevRel tasks", description: "Write docs and manuals for better understanding." },
    ],
  },
  {
    badgeSrc: DeputyBadge,
    badgeAlt: "Deputy Badge",
    title: "Deploy Deputy",
    points: "Level 2",
    tasks: [
      { title: "Core Contributions", description: "Work on more complex issues. Get guidance." },
      { title: "Work with core team", description: "Work closely with the core team, learn faster." },
    ],
  },
  {
    badgeSrc: PrimeBadge,
    badgeAlt: "Prime Badge",
    title: "Pushmaster Prime",
    points: "Level 3",
    tasks: [
      { title: "Cash Bounties", description: "Get access to issues with $$$ bounties." },
      { title: "Job Listings", description: "We hire top contributors. Hear about new jobs first!" },
    ],
  },
  {
    badgeSrc: LegendBadge,
    badgeAlt: "Legend Badge",
    title: "Formbricks Legend",
    points: "Special Honor",
    tasks: [{ title: "Unconditional Love", description: "Finally. From the community and core team 🤍" }],
  },
];

const TheDeal = [
  {
    os: "100% free",
    free: "Unlimited Surveys",
    pro: "Custom URL",
  },
  {
    os: "All community features included",
    free: "Unlimited Link Survey Submissions",
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
    events: [{ name: "Formbricks team building out surveying infrastructure" }],
  },
  {
    id: "hackathon",
    description: "Hackathon Kick-Off 🔥",
    period: "1st October 2023",
    events: [
      { name: "✅ Email Embeds", link: "https://github.com/formbricks/formbricks/pull/873" },
      { name: "✅ Hidden Fields", link: "https://github.com/formbricks/formbricks/pull/1144" },
      {
        name: "✅ Question Type: Picture Choice",
        link: "https://github.com/formbricks/formbricks/pull/1388",
      },
      { name: "✅ Question Type: Welcome Card", link: "https://github.com/formbricks/formbricks/pull/1073" },
      { name: "✅ Add Image to Question", link: "https://github.com/formbricks/formbricks/pull/1305" },
      { name: "✅ Dynamic Link Previews", link: "https://github.com/formbricks/formbricks/pull/1093" },
      { name: "✅ Fullscreen Previews", link: "https://github.com/formbricks/formbricks/pull/898" },
      { name: "✅ PIN protected surveys", link: "https://github.com/formbricks/formbricks/pull/1142" },
      { name: "✅ Source Tracking", link: "https://github.com/formbricks/formbricks/pull/1486" },
      { name: "✅ Time To Complete Indicator", link: "https://github.com/formbricks/formbricks/pull/1461" },
    ],
  },
  {
    id: "phlaunch",
    description: "Product Hunt Launch 🚀",
    period: "31st October 2023",
    events: [
      { name: "✅ Question Type: File Upload", link: "https://github.com/formbricks/formbricks/pull/1277" },
      { name: "✅ Notion Integration", link: "https://github.com/formbricks/formbricks/pull/1197" },
      { name: "✅ Media Backgrounds", link: "https://github.com/formbricks/formbricks/pull/1515" },
      { name: "🚧 Custom Styling", link: "https://github.com/formbricks/formbricks/pull/916" },
      { name: "🚧 Recall Information", link: "https://github.com/formbricks/formbricks/issues/884" },
      { name: "⏳ Unsplash Backgrounds" },
      { name: "⏳ Question Type: Matrix" },
      { name: "⏳ Question Type: Collect payment" },
      { name: "⏳Question Type: Schedule a call (Powered by Cal.com)" },
      { name: "⏳ Question Type: Signature (Powered by Documenso)" },
    ],
  },
];

const members = [
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
    level: "rookie",
    imgUrl: "https://avatars.githubusercontent.com/u/26919832?v=4",
  },
  {
    name: "Ankur Datta",
    githubId: "Ankur-Datta-4",
    points: "100",
    level: "rookie",
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
    level: "deputy",
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
    level: "deputy",
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
    level: "deputy",
    imgUrl: "https://avatars.githubusercontent.com/u/72537293?v=4",
  },
  {
    name: "Nafees Nazik",
    githubId: "G3root",
    points: "100",
    level: "deputy",
    imgUrl: "https://avatars.githubusercontent.com/u/84864519?v=4",
  },
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
      {/* Header */}

      <div className="flex h-full w-full flex-col items-center justify-center overflow-clip text-center">
        <div className="py-16 md:py-24">
          <h1 className="mt-10 px-6 text-3xl font-bold text-slate-100 sm:text-4xl md:text-5xl">
            <span className="xl:inline">
              Beautiful Open Source Surveys. <br className="hidden md:block"></br>Built as a community, free
              forever.
            </span>
          </h1>

          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-300 sm:text-lg md:mt-6 md:text-xl">
            The time is ripe, this is needed. So we ship it as a community - and give it back to the world!
            <br></br>Join us and build surveying infrastructure for millions - free and open source.
          </p>
        </div>
        <ContributorGrid contributors={members} />
      </div>

      {/* Roadmap */}
      <div
        className="flex flex-col items-center justify-center bg-gradient-to-br from-white to-slate-100 pb-12 text-center md:pb-24"
        id="roadmap">
        <div className="py-16 md:py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
            <span className="xl:inline">
              First Things First: <br></br>An Open Source Typeform Alternative
            </span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-600 sm:text-lg md:mt-6 md:text-xl">
            It&apos;s been requested many times over, so Typeform-like surveys is where we start.
            <br></br>In October, we kicked it off in style with a 30-day hackathon.
          </p>
        </div>
        <Roadmap data={roadmapDates} />
      </div>

      {/* Levels */}
      <div
        className="mb-12 flex flex-col items-center justify-center overflow-clip text-center lg:mb-40"
        id="levels">
        <LevelsGrid contributors={members} />
        <div className="py-16 md:py-24">
          <h2 className="mt-10 px-8 text-2xl font-bold text-slate-100 sm:text-3xl md:text-4xl">
            <span className="xl:inline">Write Code, Level Up and Unlock Benefits</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-300 sm:text-lg md:mt-6 md:text-xl">
            The more you contribute, the more points you collect.
            <br className="hidden md:block"></br> Unlock benefits like cash bounties, limited merch and more!
          </p>
        </div>
        <div className="max-w-8xl grid gap-6 px-8 md:grid-cols-4 lg:px-24">
          {LevelsData.map((badge, index) => (
            <LevelCard key={index} {...badge} />
          ))}
        </div>
        <div className="max-w-8xl mt-8 grid grid-cols-3 gap-4 px-56">
          <div className="px-8">
            <p className="h-0 text-lg font-bold text-slate-300">+ Sticker Set</p>
            <Image src={ArrowSticker} alt="rookie batch" className="" />
          </div>
          <div className="px-8">
            <p className="h-0 text-lg font-bold text-slate-300">+ Hoodie</p>
            <Image src={HoodieSticker} alt="rookie batch" className="" />
          </div>
          <div className="px-8">
            <p className="h-0 text-lg font-bold text-slate-300">+ Handmade Gift</p>
            <Image src={ArrowGift} alt="rookie batch" className="" />
          </div>
        </div>
      </div>

      {/* Become a Legend */}
      <div
        className="flex flex-col items-center justify-center bg-gradient-to-br from-white to-slate-100  pb-24 text-center"
        id="hof">
        <div className="py-16 md:py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
            <span className="xl:inline">
              Become a<br className="md:hidden"></br> Formbricks Legend
            </span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-600 sm:text-lg md:mt-6 md:text-xl">
            This is your wall of fame. We’re honoured to be in this together!
          </p>
        </div>
        <HallOfFame members={members} />
      </div>

      {/* Our values */}
      <div className="mb-24 flex flex-col items-center justify-center text-center md:mb-40">
        <div className="py-16 md:py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-100 sm:text-3xl md:text-4xl">
            <span className="xl:inline">Our values</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-300 sm:text-lg md:mt-6 md:text-xl">
            Apart from being decent human beings, this is what we value:
          </p>
        </div>
        <div className="max-w-8xl grid gap-x-6 gap-y-6 px-8 md:grid-cols-3 md:px-16">
          <ValueCard
            emoji="🧘‍♂️"
            title="Less is more."
            description="Like with friends, we’re about forming deep and meaningful relationships within our community. If you want to merge a PR with improved punctuation to catch a green square, this is likely not the right place for you :)"
          />
          <ValueCard
            emoji="🤝"
            title="Show up & Pull through."
            description="When you pick a task up, please make sure to complete it in timely manner. The longer it floats around, the more merge conflicts arise."
          />
          <ValueCard
            emoji="🍔"
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
      <div className="flex flex-col items-center justify-center bg-gradient-to-br from-white to-slate-100  pb-24 text-center">
        <div className="py-16 md:py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-800 sm:text-3xl md:text-4xl">
            <span className="xl:inline">The Deal</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-600 sm:text-lg md:mt-6 md:text-xl">
            We&apos;re kinda making a handshake agreement here. This is it:
          </p>
        </div>
        <div className="mx-auto max-w-4xl px-4">
          <div>
            <div className="grid grid-cols-2 items-end rounded-t-lg border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-bold text-slate-800 sm:text-base md:grid-cols-3">
              <div>Self-hosted</div>
              <div>Formbricks Cloud</div>
              <TooltipProvider delayDuration={50}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="hidden md:block">
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
                className="grid grid-cols-2 gap-x-2 border-x border-b border-slate-200 px-6 py-3 text-sm text-slate-900 last:rounded-b-lg md:grid-cols-3">
                <div>{feature.os}</div>
                <div>{feature.free}</div>
                <div className="hidden md:block">{feature.pro}</div>
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
      <div className=" mb-40 flex flex-col items-center justify-center text-center">
        <div className="py-16 md:py-24">
          <h2 className="mt-10 text-2xl font-bold text-slate-100 sm:text-3xl md:text-4xl">
            <span className="xl:inline">Get started</span>
          </h2>
          <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base italic text-slate-300 sm:text-lg md:mt-6 md:text-xl">
            We&apos;re still setting things up,{" "}
            <Link
              href="https://formbricks.com/discord"
              className="decoration-brand-dark underline underline-offset-2">
              join our Discord
            </Link>{" "}
            to stay in the loop :)
          </p>
        </div>
        <LoadingSpinner />
      </div>

      {/* FAQ */}
      <div id="faq" className="bg-gradient-to-br from-white to-slate-100 px-8 pb-24 lg:px-32 ">
        <div className="max-w-6xl">
          <div className="py-16 md:py-24 ">
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
      </div>
    </LayoutTribe>
  );
}

const ValueCard = ({ title, description, emoji }) => {
  return (
    <div className="rounded-xl bg-slate-800 p-3 text-left">
      <div className="mb-4 flex h-24 items-center justify-center rounded-xl border border-slate-600 bg-slate-700 text-6xl">
        {emoji}
      </div>
      <div className="px-2">
        <h2 className="text-xl font-bold text-slate-300">
          <span className="xl:inline">{title}</span>
        </h2>
        <p className=" leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
};
