import Script from "next/script";
import { FAQPage, WithContext } from "schema-dts";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@formbricks/ui/Accordion";

interface Answer {
  "@type": "Answer";
  text: string;
}

interface Question {
  "@type": "Question";
  name: string;
  acceptedAnswer: Answer;
}

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQ[];
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
}

const SeoFaq: React.FC<FAQSchemaProps> = ({ faqs, headline, description, datePublished, dateModified }) => {
  const FAQMainEntity: Question[] = faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  }));

  const FAQjsonld: WithContext<FAQPage> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: `Frequently Asked Questions around ${headline}`,
    mainEntity: FAQMainEntity,
    headline,
    description,
    author: {
      "@type": "Person",
      name: "Johannes Dancker",
      url: "https://formbricks.com",
    },
    image: "",
    datePublished,
    dateModified,
  };

  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FAQjsonld),
        }}
      />

      <Accordion type="single" collapsible className="px-4 sm:px-0">
        {faqs.map((faq, index) => (
          <AccordionItem key={`item-${index}`} value={`item-${index + 1}`}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
};

export default SeoFaq;
