import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@formbricks/ui/Accordion";
import { FaqJsonLdComponent } from "./FAQPageJsonLd";

const FAQ_DATA = [
  {
    question: "What is an environment ID?",
    answer: () => (
      <>
        The environment ID is a unique identifier associated with each Environment in Formbricks,
        distinguishing between different setups like production, development, etc.
      </>
    ),
  },
  {
    question: "How can I implement authentication for the Formbricks API?",
    answer: () => (
      <>
        Formbricks provides 2 types of API keys for each environment ie development and production. You can
        generate, view, and manage these keys in the Settings section on the Admin dashboard. Include the API
        key in your requests to authenticate and gain access to Formbricks functionalities.
      </>
    ),
  },
  {
    question: "Can I run the deployment shell script on any server?",
    answer: () => (
      <>
        You can run it on any machine you own as long as its running a <b> Linux Ubuntu </b> distribution. And
        to forward the requests, make sure you have an <b>A record</b> setup for your domain pointing to the
        server.
      </>
    ),
  },
  {
    question: "Can I self-host Formbricks?",
    answer: () => (
      <>
        Absolutely! We provide an option for users to host Formbricks on their own server, ensuring even more
        control over data and compliance. And the best part? Self-hosting is available for free, always. For
        documentation on self hosting, click{" "}
        <a href="/docs/self-hosting/deployment" className="text-brand-dark dark:text-brand-light">
          here
        </a>
        .
      </>
    ),
  },
  {
    question: "How can I change Button texts in my survey?",
    answer: () => (
      <>
        For the question that you want to change the button text, click on the <b>Show Advanced Settings</b>{" "}
        toggle and change the button label in the <b>Button Text</b> field.
      </>
    ),
  },
];

export const faqJsonLdData = FAQ_DATA.map((faq) => ({
  questionName: faq.question,
  acceptedAnswerText: faq.answer(),
}));

export const FAQ = () => {
  return (
    <>
      <FaqJsonLdComponent data={faqJsonLdData} />
      <Accordion type="single" collapsible>
        {FAQ_DATA.map((faq, index) => (
          <AccordionItem key={`item-${index}`} value={`item-${index + 1}`} className="not-prose mb-0 mt-0">
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer()}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
};
