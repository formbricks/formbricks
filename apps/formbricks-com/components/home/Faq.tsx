import HeadingCentered from "@/components/shared/HeadingCentered";
import SeoFaq from "@/components/shared/lawl/okcool";

const FAQs = [
  {
    question: "What is Formbricks?",
    answer:
      "Formbricks is an experience management platform built on top of the fastest growing open source survey infrastructure out there. It aims to assist businesses in capturing and understanding customer insights and emotions towards their products and services. Designed to integrate seamlessly with various platforms, Formbricks focuses on user research, emphasizing data privacy and requiring minimal development effort for integration.",
  },
  {
    question: "How do I integrate Formbricks into my application?",
    answer:
      "Integrating Formbricks into an application is effortless. For web applications, it involves adding a simple script tag to the HTML head. For applications built with modern frameworks such as React, Vue, or Svelte, Formbricks can be installed via NPM. Initialization with specific environment details completes the setup. Detailed instructions and framework guides are readily available in the detailed Formbricks documentation.",
  },
  {
    question: "Is Formbricks GDPR compliant?",
    answer:
      "Indeed, Formbricks ensures full GDPR compliance, emphasizing the protection of user data privacy. It offers both cloud-based solutions and self-hosting options, adhering to data privacy regulations and making it a trusted choice for secure open source survey tool deployment.",
  },
  {
    question: "Can I self-host Formbricks?",
    answer:
      "Certainly! Formbricks encourages self-hosting, providing users with greater control over their data and compliance. This option underscores Formbricks' commitment to offering versatile and free open source experience management software, ensuring users can adapt the platform to their unique requirements. Detailed self-hosting documentation is available for users seeking to leverage this capability.",
  },
  {
    question: "How does Formbricks pricing work?",
    answer:
      "Formbricks introduces a 'Free forever' plan, showcasing its commitment to making open source survey platforms universally accessible. This plan features unlimited surveys and in-product surveys, among other functionalities. Self-hosting users can enjoy all the benefits of the free plan with additional features at no extra cost. For those seeking advanced features Formbricks invites you to explore the pricing section for more information.",
  },
  {
    question: "How does Formbricks make money?",
    answer:
      "Formbricks employs the 'Open Core' business model. The core of the Formbricks application is offered for free. Formbricks monetizes by providing advanced features and services, typically catering to the needs of larger clients, thereby generating revenue.",
  },
  {
    question: "What is the best open source survey software available?",
    answer:
      "Identifying the best open source survey software requires evaluating features, flexibility, and support. Formbricks is a noteworthy contender, offering comprehensive experience management solutions. This platform excels in enabling businesses to delve into customer insights and feedback, offering versatility and ease of system integration.",
  },
  {
    question: "Can open source survey platforms be customized for my business needs?",
    answer:
      "Definitely. Platforms like Formbricks exemplify the customizability of open source survey tools, allowing for extensive tailoring to meet specific business requirements. Access to the source code enables deep customization, from branding adjustments to complex integrations with existing systems, underscoring the flexibility of open source experience management solutions.",
  },
  {
    question:
      "What advantages does using an experience management platform offer over traditional survey tools?",
    answer:
      "Experience management platforms, especially those built on open source foundations, offer a more holistic view of customer interactions compared to traditional survey tools. They enable real-time collection, analysis, and application of customer feedback, ensuring a thorough understanding of the customer journey. This comprehensive insight facilitates informed decision-making and boosts customer satisfaction.",
  },
];

export default function FAQ() {
  return (
    <div>
      <HeadingCentered heading="Frequently asked questions" teaser="FAQ" />
      <SeoFaq
        faqs={FAQs}
        headline="Open Source Experience Management Platform"
        description="Formbricks is an Experience Management Platform built of top of the largest open source survey infrastructure worldwide."
        datePublished="2023-10-11"
        dateModified="2024-03-12"
      />
    </div>
  );
}
