"use client";

import { FAQPageJsonLd } from "next-seo";

export default function FaqJsonLdComponent({ data }) {
  const faqEntities = data.map(({ question, answer }) => ({
    questionName: question,
    acceptedAnswerText: answer,
  }));

  return <FAQPageJsonLd mainEntity={faqEntities} />;
}
