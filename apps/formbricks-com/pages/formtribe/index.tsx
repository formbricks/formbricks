import LayoutLight from "@/pages/formtribe/LayoutLight";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui";
import Head from "next/head";
import Image from "next/image";

import Dhru from "@/images/formtribe/dhru.jpeg";
import Jojo from "@/images/formtribe/jojo.jpeg";
import Matti from "@/images/formtribe/matti.jpeg";
import OSSLoop from "@/images/formtribe/oss-loop.png";
import Mac from "@/images/formtribe/package.jpeg";
import Pandey from "@/images/formtribe/pandeyman.jpeg";
import Shubham from "@/images/formtribe/shubham.jpeg";
import Timeline from "@/images/formtribe/timeline.png";
import { useEffect } from "react";

const HowTo = [
  {
    step: "1",
    header: "Pick a 'FormTribe 🔥' issue in our repository and comment.",
    link: "https://formbricks.com/github",
  },
  {
    step: "2",
    header: "Be the first to comment and get the issue assigned.",
  },
  {
    step: "3",
    header: "You now have 24h to open a draft PR ⏲️",
  },
  {
    step: "4",
    header: "If your PR looks promising, we'll work with you to get it merged.",
  },
  {
    step: "5",
    header: "For every merged PR you collect points ✨",
  },
  {
    step: "6",
    header: "Solve side quests to increase your chances on the MacBook 👀",
    link: "#prizes",
  },
  {
    step: "7",
    header: "Join our Discord to ask questions (and submit side quests).",
    link: "https://formbricks.com/discord",
  },
];

const SideQuests = [
  {
    points: "Join the Tribe Tweet (100 Points)",
    quest: "Tweet a single “🧱” emoji before the 7th of October EOD to join the #FormTribe.",
    proof: "Share the link to the tweet in the “side-quest” channel.",
  },
  {
    points: "Spread the Word Tweet (100 Points)",
    quest: "Tweet “🧱🚀” on the day of the ProductHunt launch to spread the word.",
    proof: "Share the link to the tweet in the “side-quest” channel.",
  },
  {
    points: "Setup Insights (200 Points)",
    quest: "Screen record yourself setting up the Formbricks dev environment.",
    proof: "Upload to WeTransfer and send to johannes@formbricks.com",
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
    points: "Transform Animation to CSS (350 Points per background)",
    quest: "Animate an existing background to CSS versions (more infos on Notion).",
    proof: "Share the animated background.",
  },
  {
    points: "Enhance Docs (50-250 Points)",
    quest:
      "Add a new section to our docs where you see gaps. Follow the current style of documentation incl. code snippets and screenshots. Pls no spam.",
    proof: "Open a PR with “docs” in the title",
  },
  {
    points: "Starry-eyed Supporter (250 Points)",
    quest: "Get five friends to star our repository.",
    proof: "Share 5 screenshots of the chats where you asked them and they confirmed + their GitHub names",
  },
  {
    points: "Bug Hunter (50-250 Points)",
    quest: "Find and report any functionality bugs.",
    proof: "Open a bug issue in our repository.",
  },
  {
    points: "Brickify someone famous with AI (200 Points + up to 100 Points)",
    quest:
      "Find someone whose name would be funny as a play on words with “brick”. Then, with the help of AI, create a brick version of this person like Brick Astley, Brickj Minaj, etc. For extra points, tweet it, tag us and score +5 for each like.",
    proof: "Share your art or link to the tweet in the “side-quest” channel.",
  },
  {
    points: "SEO Sage (50-250 Points)",
    quest: "Provide detailed SEO recommendations or improvements for our main website.",
    proof: "Share your insights.",
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
    question: "Is this part of Formbricks or a different tool?",
    answer:
      "The link survey is part of the Formbricks core product. The code is managed in the Formbricks mono repository.",
  },
  {
    question: "Why are there only 30ish issues to work on?",
    answer:
      "We believe in Quality over Quantity. We’re a small team and want to be able to pay enough attention to each of the contributors.",
  },
  {
    question: "Can everyone win?",
    answer:
      "There are 64 prizes. Every contributor can only win 1 prize, so there will be 64 winners. Every contributor has a chance to win. The more points you make, the higher your chance to win.",
  },
  {
    question: "Why do I have to sign a CLA?",
    answer:
      "To assure this project to be financially viable, we have to be able to relicense the code for enterprise customers and governments. To be able to do so, we are legally obliged to have you sign a CLA.",
  },
  {
    question: "Where will this be hosted?",
    answer:
      "We offer a Formbricks Cloud with a generous free plan but you can also easily self-host using Docker.",
  },
  {
    question: "What is the FormTribe?",
    answer: "The FormTribe is what we call our community of contributors.",
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
    question: "Do I need to pay duty for the SWAG?",
    answer: "No, we cover that.",
  },
  {
    question: "How long will it take to receive the swag?",
    answer: "30-60 days.",
  },
  {
    question: "How does it work?",
    answer: "Here are detailed instructions, please read through them.",
  },
  {
    question: "What's in it for me?",
    answer: "A Macbook Air M2 or AirPods if your lucky, and life long friends for sure.",
  },
  {
    question: "When is the event happening?",
    answer: "1st of October until 31st of October",
  },
  {
    question: "Can everyone participate?",
    answer:
      "Yes! Even when you don’t know how to write code you can take part completing side quests. As long as you can open a PR you are very welcome to take part irrespective of your age, gender, nationality, food preferences, taste in clothing and favorite Pokemon.",
  },
];

const Leaderboard = [
  {
    name: "Piyush",
    points: "550",
    link: "https://github.com/gupta-piyush19",
  },
  {
    name: "Suman",
    points: "200",
  },
  {
    name: "Subhdeep",
    points: "100",
  },
  {
    name: "Pratik",
    points: "250",
  },
  {
    name: "Karuppiah",
    points: "100",
  },
  {
    name: "Arth",
    points: "100",
  },
  {
    name: "Neztep",
    points: "100",
  },
  {
    name: "Kelvin Parmar",
    points: "200",
  },
  {
    name: "Naitik Kapadia (Arjun)",
    points: "200",
  },
  {
    name: "Yashhhh",
    points: "200",
  },
  {
    name: "vishleshak",
    points: "100",
  },
  {
    name: "Ashu999",
    points: "100",
  },
  {
    name: "Sachin H",
    points: "100",
  },
  {
    name: "Suraj Jadhav",
    points: "100",
  },
  {
    name: "Vishrut",
    points: "250",
  },
  {
    name: "cataxcab",
    points: "100",
  },
  {
    name: "Eldemarkki",
    points: "500",
  },
  {
    name: "Suyash",
    points: "100",
  },
  {
    name: "Rohan Gupta",
    points: "100",
  },
  {
    name: "Nafees Nazik",
    points: "100",
  },
  {
    name: "monk",
    points: "100",
  },
  {
    name: "Pratik Tiwari (Pratik)",
    points: "100",
  },
  {
    name: "Ardash Malviya",
    points: "100",
  },
  {
    name: "Aditya Deshlahre",
    points: "550",
    link: "https://github.com/adityadeshlahre",
  },
  {
    name: "Rutam",
    points: "350",
  },
  {
    name: "Sagnik Sahoo",
    points: "100",
  },
  {
    name: "Prasoon Mahawar",
    points: "100",
  },
  {
    name: "Dushmanta",
    points: "100",
  },
  {
    name: "Arjavv",
    points: "100",
  },
  {
    name: "Ashish Khare",
    points: "100",
  },
  {
    name: "Rohit Mondal",
    points: "100",
  },
  {
    name: "noobcoder",
    points: "100",
  },
  {
    name: "Rayyan Alam (Rayy)",
    points: "100",
  },
  {
    name: "Ayush",
    points: "100",
  },
  {
    name: "Zechariah",
    points: "100",
  },
  {
    name: "Rajarshi Misra",
    points: "100",
  },
];

export default function FormTribeHackathon() {
  // dark mode fix
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return (
    <LayoutLight
      title="FormTribe Hackathon"
      description="Can we ship an Open Source Typeform alternative in 30 days?">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Kablammo:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>
      {/* Header */}

      <div className="px-4 pb-16 pt-16 text-center sm:px-6 lg:px-8 lg:pb-32 lg:pt-20">
        <a href="#how" className=" rounded-full border bg-slate-100 px-4 py-1.5 text-sm text-slate-500">
          Write code, win a Macbook 🔥
        </a>
        <h1 className="mt-10 text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200 sm:text-4xl md:text-5xl">
          <span className="xl:inline">Let&apos;s ship Open Source Typeform during Hacktoberfest</span>
        </h1>

        <p className="xs:max-w-none mx-auto mt-3 max-w-xs text-base text-slate-500 dark:text-slate-400 sm:text-lg md:mt-6 md:text-xl">
          Can we build an open source Typeform alternative in 30 days?
        </p>
      </div>

      {/* Video + Nutshell */}
      <div className="flex flex-col p-4 md:flex-row">
        {/* Left Column: YouTube Video */}
        <div className="mb-4 overflow-hidden rounded-lg md:mb-0 md:w-1/2">
          <iframe
            width="100%"
            height="315"
            src="https://www.youtube-nocookie.com/embed/zed8IIQWZLk?si=pfma3e9isiviKq2j&amp;controls=0"
            title="Formbricks goes Hacktoberfest"></iframe>
        </div>

        {/* Right Column: Headline + Ordered List */}
        <div className="flex items-center justify-center sm:pl-12 md:w-1/2">
          <div className="space-y-5">
            <h1 className="font-kablammo text-3xl font-bold text-slate-800">In a nutshell</h1>
            <ol className="list-inside list-decimal space-y-3 text-slate-700">
              <li>
                <strong>As a community,</strong> we will ship all link survey features for a Typeform like
                experience in 30 days <span className="text-lg"> 🚢</span>
              </li>
              <li>
                All code and non-code contributors have a chance to win a <strong>MacBook Air M2</strong>
                <span className="text-lg"> 💻</span>
              </li>
              <li>
                The link surveys will be <strong>100% free to use</strong> - from the community, for the
                community <span className="text-lg"> 🫶</span>
              </li>
            </ol>
            <Button
              variant="highlight"
              href="#join"
              className="mt-4 bg-gradient-to-br from-[#032E1E] via-[#032E1E] to-[#013C27]">
              Join the Tribe
            </Button>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="sm:mt-32v mt-24 rounded-lg shadow-2xl ">
        <div className="flex h-10 w-full items-center rounded-t-lg bg-slate-200 ">
          <div className="flex space-x-1 pl-3">
            <div className="h-4 w-4 rounded-full bg-red-400"></div>
            <div className="h-4 w-4 rounded-full bg-amber-400"></div>
            <div className="h-4 w-4 rounded-full bg-green-400"></div>
          </div>
        </div>
        <div className=" w-full items-center space-y-5 rounded-b-lg bg-amber-50 px-8 py-6 text-slate-800 sm:px-24 sm:py-12">
          <h3 className="text-xl font-bold text-slate-800 sm:text-2xl">What is this? (And are we 🥜?)</h3>
          <p>
            Charlie Munger famously said <strong>“Show me the incentives and I show you the outcome”.</strong>
          </p>

          <p>
            The beauty of Open Source Software (and the reason for its inevitable domination) is that
            incentives between the different groups of users and developers are perfectly aligned.
          </p>

          <p>Let’s have a look:</p>

          <Image src={OSSLoop} alt="oss loop" />

          <p>With open-source software, everyone wins:</p>

          <p>
            The community of contributors gets to learn on the job working on a real product with real users.
            The free users get to use a feature-complete product free of charge. we don’t have to pay insane
            sales people salaries to sell our enterprise solution in the future.{" "}
            <strong>Welcome to the OSS win-win loop™</strong>
          </p>

          <p>
            This is why we have decided to spend the complete month of Hacktoberfest hacking away with you,
            our community!
          </p>

          <p className="text-lg font-semibold sm:text-xl">But why would you hack with us?</p>

          <p>There’s a couple of reasons, but let’s first nail this down:</p>

          <p>
            The time for an elegant <strong>👏</strong>, open source <strong>👏</strong> survey builder has
            come. It has been tried before, but it has never been maintained long enough because it’s hard to
            make money with a free tool.
          </p>

          <p>This is why the FormTribe is coming together this October!</p>

          <p>And you can be a part of it!</p>

          <p>
            Imagine yourself flexing on a date that your code is used by thousands and soon millions of
            people!
          </p>

          <p className="text-lg font-semibold sm:text-xl">
            Apart from you dating life levelling up, here are some proper reasons:
          </p>
          <p></p>

          <ul className="list-disc space-y-1 pl-4">
            <li>
              You can win a new <b>MacBook Air M2 💻</b>
            </li>
            <li>
              You can win limited <b>hoodies, t-shirts and stickers!</b>
            </li>
            <li>
              You can complete official <b>Hacktoberfest PRs</b>
            </li>
            <li>You’ll earn your spot of honour on our Community page on formbricks.com</li>
            <li>
              You’ll be working closely with the Formbricks team, shipping features which have been requested
              since this was called snoopForms
            </li>
            <li>You’ll join an active community of open source fans, connect and learn together</li>
          </ul>
          <p></p>
          <p>Doesn’t this sound like fun?</p>

          <p>It does! And I almost forgot the most important part:</p>

          <p className="text-lg font-semibold sm:text-xl">The grande finale is a ProductHunt launch 🚀</p>

          <p>What are you waiting for?</p>

          <p>Roll up your sleeves, pick one of the issues linked below and join us!</p>
          <p className="font-kablammo pt-6 text-2xl text-slate-800">
            Matti, Johannes, Anshuman, Shubham & Dhruwang
          </p>
          <div className="flex space-x-2">
            <Image src={Matti} alt="matti" className="h-12 w-12 rounded-full " />
            <Image src={Jojo} alt="jojo" className="h-12 w-12 rounded-full " />
            <Image src={Pandey} alt="pandey" className="h-12 w-12 rounded-full " />
            <Image src={Shubham} alt="shubh" className="h-12 w-12 rounded-full " />
            <Image src={Dhru} alt="dhru" className="h-12 w-12 rounded-full " />
          </div>
        </div>
      </div>

      {/* Breaker 1 */}
      <Breaker icon="🤸" title="Don’t miss the kick-off!" />

      {/* Prizes */}
      <SectionHeading
        id="prizes"
        subTitle="🏆"
        title="Prizes"
        description="We give back to our community with the slickest laptop made by human kind: A MacBook Air M2!"
      />
      <div className="grid-cols-2 sm:grid">
        <Image src={Mac} alt="macbook air m2" className="rounded-lg p-10" />
        <div className="flex items-center justify-center space-y-5 p-2">
          <ul className="list-inside space-y-3 text-center text-2xl sm:text-left ">
            <li>🎉 1 x MacBook Air M2</li>
            <li>🎉 3 x Limited FormTribe Premium Hoodie</li>
            <li>🎉 10 x Limited FormTribe Premium Shirt</li>
            <li>🎉 10 x 250h for Gitpod</li>
            <li>🎉 50 x Sets of Formbricks Stickers</li>
          </ul>
        </div>
      </div>

      <div className="rounded-lg-12 mt-6 grid-cols-6 rounded-lg border border-slate-200 bg-slate-100 py-12 sm:grid">
        <div className="col-span-1 mr-8 flex items-center justify-center sm:justify-end">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-3xl">🍀</div>
        </div>
        <div className="col-span-5 px-6">
          <h3 className="my-4 text-lg font-semibold text-slate-700 sm:my-0">
            Every participant can win! How?
          </h3>
          <p className="pr-16 text-slate-500">
            For every point you make, your name will be added to a virtual jar. From this jar we will draw the
            winners. An example:
          </p>
          <ul className="list-disc py-4 pl-5 text-slate-500 ">
            <li>
              Lola makes 200 points for a PR and a total of 100 points with side quests. Lola’s name will be
              added 300x to the jar.{" "}
            </li>
            <li>Bricky completes side quests for 50 points, so his name will be added 50x to the jar.</li>
          </ul>
          <p className="pr-16 text-slate-500">
            In a live stream we will pull a name from the jar for each of the prizes. Since Lola has 6x more
            points than Bricky, her chance of winning is 6x higher.
          </p>
        </div>
      </div>

      {/* Here is how */}
      <div className="relative">
        <SectionHeading
          id="how"
          subTitle="💻"
          title="Write code, win a MacBook"
          description="We want to give back to our community of developers. What would be better than the best laptop ever designed by human kind? A MacBook Air M2!"
        />
      </div>
      <div className="mx-auto max-w-2xl">
        {HowTo.map((offer) => (
          <div key={offer.step} className="mb-2 flex items-center gap-x-4">
            <div className=" flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 p-7 text-2xl font-semibold text-slate-500">
              <p className="font-kablammo bg-gradient-to-br from-[#032E1E] via-[#032E1E] to-[#013C27] bg-clip-text text-transparent">
                {offer.step}
              </p>
            </div>
            <div>
              {offer.link ? (
                <a
                  href={offer.link}
                  className="text-lg text-slate-700 decoration-[#013C27] underline-offset-4 hover:underline">
                  {offer.header}
                </a>
              ) : (
                <h4 className="text-lg text-slate-700">{offer.header}</h4>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <Button
          variant="darkCTA"
          href="https://github.com/formbricks/formbricks/issues"
          target="_blank"
          className="mx-auto mt-12 bg-gradient-to-br from-[#032E1E] via-[#032E1E] to-[#013C27] px-20 text-white ">
          View FormTribe Issues on GitHub
        </Button>
      </div>

      {/* Side Quests */}
      <div className="mt-16" id="side-quests">
        <h3 className="font-kablammo my-4 text-4xl font-bold text-slate-800">
          🏰 Side Quests: Increase your chances
        </h3>
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
      </div>

      {/* The Leaderboard */}

      <SectionHeading
        id="leaderboard"
        subTitle="👀"
        title="The Leaderboard"
        description="We keep track of all contributions and side quests in Discord. Join to take part!"
      />
      <div className="rounded-lg border border-slate-200">
        <div className=" grid grid-cols-2 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="m-2 pl-6">User</div>
          <div className="m-2 pr-6 text-right">Points</div>
        </div>
        {Leaderboard.sort((a, b) => parseInt(b.points) - parseInt(a.points)).map((player) => (
          <a href={player.link} key={player.name} className="w-full" target="_blank">
            <div className="m-4 grid grid-cols-2 content-center rounded-lg hover:bg-slate-100">
              <div className="flex items-center  text-sm">
                <div className="m-2 font-medium text-slate-900">{player.name}</div>
              </div>
              <div className="m-2 my-auto text-right text-sm text-slate-900">{player.points} Points</div>
            </div>
          </a>
        ))}
      </div>

      {/* The Timeline */}

      <SectionHeading
        id="timeline"
        subTitle="📅"
        title="The Timeline"
        description="(Germans do nothing without one)"
      />
      <Image src={Timeline} alt="timeline" />

      {/* Breaker 1 */}
      <Breaker icon="🚀" title="Don’t miss the launch!" />

      {/* The Deal */}
      <div className=" mx-auto max-w-4xl">
        <SectionHeading
          id="deal"
          subTitle="🤝"
          title="The Deal"
          description="We're kinda making a handshake agreement here. Let’s outline the terms:"
        />
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
          <div className="col-span-5 px-8 sm:px-0">
            <h3 className="mt-4 text-lg font-semibold text-slate-700 sm:mt-0">
              Are Formbricks in-app surveys also free?
            </h3>
            <p className="text-slate-500 sm:pr-16">
              Just a heads-up: this deal doesn&apos;t cover Formbricks&apos; in-app surveys. We&apos;ve got a
              solid free plan, but we&apos;ve gotta keep some control over pricing to keep things running
              long-term.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-32" id="faq">
        <h3 className="font-kablammo my-4 text-4xl font-bold text-slate-800">FAQ</h3>
        <p className="w-3/4 text-slate-600">Anything unclear?</p>
        <div className="mt-8">
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
      <Button className="mt-4 " variant="secondary" href="https://formbricks.com/discord" target="_blank">
        Join Discord and ask away
      </Button>
      {/* Breaker 3 */}
      <Breaker icon="👋" title="Join the Tribe!" />
    </LayoutLight>
  );
}

const SectionHeading = ({ title, subTitle, description, id }) => {
  return (
    <div id={id} className="lg:pt-18 mt-32 px-4 pb-12 text-center sm:px-6 lg:px-8 ">
      <p className=" text-[3rem] text-slate-500">{subTitle}</p>
      <h1 className="font-kablammo mb-8 mt-4 bg-gradient-to-br from-[#032E1E] via-[#032E1E] to-[#013C27] bg-clip-text text-6xl text-transparent">
        {title}
      </h1>
      <p className="mx-auto mt-4 text-slate-700 sm:w-3/4">{description}</p>
    </div>
  );
};

const Breaker = ({ icon, title }) => {
  return (
    <div
      id="join"
      className="rounded-lg-12 mt-12 rounded-lg bg-slate-200 px-4 py-12 shadow-inner sm:mt-20 sm:grid sm:grid-cols-6">
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
            <input id="5d65b" type="checkbox" name="l" checked value="5d65bc6e-e685-4694-8c8e-9b20d7be6c40" />
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
  );
};
