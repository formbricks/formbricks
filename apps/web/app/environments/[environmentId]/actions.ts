"use server";

import { prisma } from "@formbricks/database";
import { Team } from "@prisma/client";
import { templates } from "./surveys/templates/templates";

export async function createTeamWithProduct(teamName: string, ownerUserId: string): Promise<Team> {
  const newTeam = await prisma.team.create({
    data: {
      name: teamName,
      memberships: {
        create: {
          user: { connect: { id: ownerUserId } },
          role: "owner",
          accepted: true,
        },
      },
      products: createDefaultProductData("My Product"),
    },
    include: {
      memberships: true,
      products: {
        include: {
          environments: true,
        },
      },
    },
  });

  return newTeam;
}

export async function addDemoData(teamId: string): Promise<void> {
  const newProduct = await prisma.product.create({
    data: {
      ...createDefaultProductData("Demo Product"),
      team: { connect: { id: teamId } },
    },
    include: {
      environments: true,
    },
  });

  // Attribute Values
  const roles = ["Product Manager", "UX Designer", "Software Engineer", "QA Tester", "Business Analyst"];
  const experiences = ["Less than a year", "1-2 years", "3-5 years", "More than 5 years"];
  const productUsageFrequencies = ["Daily", "Weekly", "Monthly", "Rarely"];
  const companySizes = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
  const productSatisfactionLevels = [
    "Very Unsatisfied",
    "Unsatisfied",
    "Neutral",
    "Satisfied",
    "Very Satisfied",
  ];
  const recommendationLikelihoods = ["Very Unlikely", "Unlikely", "Neutral", "Likely", "Very Likely"];

  // Survey Submissions
  let easSubmissions = [
    {
      recommended: "Yes",
      recommendReason: "CalendYo has streamlined our scheduling process. It's a must-have for any team!",
      discouraged: "No",
      discourageReason: "",
    },
    {
      recommended: "No",
      recommendReason: "",
      discouraged: "Yes",
      discourageReason: "The user interface was a bit confusing for me.",
    },
    {
      recommended: "Yes",
      recommendReason: "It's very convenient to set up and manage meetings using CalendYo.",
      discouraged: "No",
      discourageReason: "",
    },
    {
      recommended: "No",
      recommendReason: "",
      discouraged: "Yes",
      discourageReason: "I experienced some technical issues while using CalendYo.",
    },
    {
      recommended: "Yes",
      recommendReason: "I love how it integrates with my Google Calendar. Makes scheduling super easy.",
      discouraged: "No",
      discourageReason: "",
    },
    {
      recommended: "Yes",
      recommendReason: "The time zone support is excellent. Great for our remote team!",
      discouraged: "No",
      discourageReason: "",
    },
    {
      recommended: "No",
      recommendReason: "",
      discouraged: "Yes",
      discourageReason: "I think the price point is too high for smaller teams.",
    },
    {
      recommended: "Yes",
      recommendReason: "The features offered by CalendYo are comprehensive and cover all our needs.",
      discouraged: "No",
      discourageReason: "",
    },
    {
      recommended: "No",
      recommendReason: "",
      discouraged: "Yes",
      discourageReason: "I find the mobile experience not as good as the web one.",
    },
    {
      recommended: "Yes",
      recommendReason: "Very reliable, never missed a meeting because of it.",
      discouraged: "No",
      discourageReason: "",
    },
    {
      recommended: "No",
      recommendReason: "",
      discouraged: "Yes",
      discourageReason: "Lack of integration with other productivity tools we use.",
    },
    {
      recommended: "Yes",
      recommendReason: "CalendYo's interface is intuitive and easy to navigate.",
      discouraged: "No",
      discourageReason: "",
    },
    {
      recommended: "No",
      recommendReason: "",
      discouraged: "Yes",
      discourageReason: "I had issues with customer support, didn't resolve my problem quickly.",
    },
    {
      recommended: "Yes",
      recommendReason: "Great for managing group events and appointments. Really effective!",
      discouraged: "No",
      discourageReason: "",
    },
    {
      recommended: "No",
      recommendReason: "",
      discouraged: "Yes",
      discourageReason: "Experienced a few syncing issues with my other calendars.",
    },
  ];

  let churnSubmissions = [
    { reason: "Difficult to use", feedback: "The user interface could be more intuitive." },
    { reason: "It's too expensive", feedback: "" },
    { reason: "I am missing features", feedback: "Integration with other calendars could be improved." },
    { reason: "Poor customer service", feedback: "" },
    { reason: "I just didn't need it anymore", feedback: "" },
    { reason: "Difficult to use", feedback: "Adding new events is a bit complicated." },
    { reason: "It's too expensive", feedback: "" },
    { reason: "I am missing features", feedback: "I would appreciate a better mobile app." },
    { reason: "Poor customer service", feedback: "" },
    { reason: "I just didn't need it anymore", feedback: "" },
    { reason: "Difficult to use", feedback: "I couldn't figure out how to sync with my work calendar." },
    { reason: "It's too expensive", feedback: "" },
    {
      reason: "I am missing features",
      feedback: "It would be great to have a feature to customize the look and feel.",
    },
    { reason: "Poor customer service", feedback: "" },
    { reason: "I just didn't need it anymore", feedback: "" },
    { reason: "Difficult to use", feedback: "The system for managing time zones was confusing." },
    { reason: "It's too expensive", feedback: "" },
    { reason: "I am missing features", feedback: "Would love to see better integration with Slack." },
    { reason: "Poor customer service", feedback: "" },
    { reason: "I just didn't need it anymore", feedback: "" },
    { reason: "Difficult to use", feedback: "Had issues with setting up recurring events." },
    { reason: "It's too expensive", feedback: "" },
  ];

  // Submissions
  let onboardingSubmissions = [
    { role: "Founder", companySize: "only me", discoveryMethod: "Google Search" },
    { role: "Executive", companySize: "11-100 employees", discoveryMethod: "Recommendation" },
    { role: "Product Manager", companySize: "1-5 employees", discoveryMethod: "Social Media" },
    { role: "Product Owner", companySize: "over 100 employees", discoveryMethod: "Ads" },
    { role: "Software Engineer", companySize: "6-10 employees", discoveryMethod: "In a Podcast" },
    { role: "Founder", companySize: "1-5 employees", discoveryMethod: "Google Search" },
    { role: "Executive", companySize: "only me", discoveryMethod: "Recommendation" },
    { role: "Product Manager", companySize: "6-10 employees", discoveryMethod: "Social Media" },
    { role: "Product Owner", companySize: "11-100 employees", discoveryMethod: "Ads" },
    { role: "Software Engineer", companySize: "over 100 employees", discoveryMethod: "In a Podcast" },
    { role: "Founder", companySize: "only me", discoveryMethod: "Google Search" },
    { role: "Executive", companySize: "1-5 employees", discoveryMethod: "Recommendation" },
    { role: "Product Manager", companySize: "6-10 employees", discoveryMethod: "Social Media" },
    { role: "Product Owner", companySize: "over 100 employees", discoveryMethod: "Ads" },
    { role: "Software Engineer", companySize: "11-100 employees", discoveryMethod: "In a Podcast" },
    { role: "Founder", companySize: "only me", discoveryMethod: "Google Search" },
    { role: "Executive", companySize: "1-5 employees", discoveryMethod: "Recommendation" },
    { role: "Product Manager", companySize: "6-10 employees", discoveryMethod: "Social Media" },
    { role: "Product Owner", companySize: "11-100 employees", discoveryMethod: "Ads" },
    { role: "Software Engineer", companySize: "over 100 employees", discoveryMethod: "In a Podcast" },
    { role: "Founder", companySize: "only me", discoveryMethod: "Google Search" },
    { role: "Executive", companySize: "1-5 employees", discoveryMethod: "Recommendation" },
    { role: "Product Manager", companySize: "6-10 employees", discoveryMethod: "Social Media" },
    { role: "Product Owner", companySize: "over 100 employees", discoveryMethod: "Ads" },
    { role: "Software Engineer", companySize: "11-100 employees", discoveryMethod: "In a Podcast" },
    { role: "Founder", companySize: "only me", discoveryMethod: "Google Search" },
    { role: "Executive", companySize: "1-5 employees", discoveryMethod: "Recommendation" },
    { role: "Product Manager", companySize: "6-10 employees", discoveryMethod: "Social Media" },
    { role: "Product Owner", companySize: "11-100 employees", discoveryMethod: "Ads" },
    { role: "Software Engineer", companySize: "over 100 employees", discoveryMethod: "In a Podcast" },
    { role: "Founder", companySize: "only me", discoveryMethod: "Google Search" },
    { role: "Executive", companySize: "1-5 employees", discoveryMethod: "Recommendation" },
    { role: "Product Manager", companySize: "6-10 employees", discoveryMethod: "Social Media" },
    { role: "Product Owner", companySize: "over 100 employees", discoveryMethod: "Ads" },
    { role: "Software Engineer", companySize: "11-100 employees", discoveryMethod: "In a Podcast" },
  ];

  let productMarketFitSubmissions = [
    {
      disappointment: "Very disappointed",
      role: "Founder",
      whoBenefits: "Small business owners who have a lot of meetings",
      mainBenefit: "CalendYo saves me a lot of time scheduling meetings",
      improvement: "I wish there was an option to auto-schedule follow up meetings",
    },
    {
      disappointment: "Somewhat disappointed",
      role: "Executive",
      whoBenefits: "Executives who have to juggle many different schedules",
      mainBenefit: "The integration with my existing calendar system is seamless",
      improvement: "The interface could be a bit more intuitive",
    },
    {
      disappointment: "Not at all disappointed",
      role: "Product Manager",
      whoBenefits: "Project managers who need to coordinate with many team members",
      mainBenefit: "Allows me to set meeting times that suit all team members",
      improvement: "It would be great if there was an option to schedule recurring meetings",
    },
    {
      disappointment: "Very disappointed",
      role: "Product Owner",
      whoBenefits: "Individuals who need a flexible scheduling tool for their projects",
      mainBenefit: "It has helped reduce the confusion around scheduling",
      improvement: "I would like to see more customization options for meeting invitations",
    },
    {
      disappointment: "Somewhat disappointed",
      role: "Software Engineer",
      whoBenefits: "Developers who want a simple solution for scheduling meetings",
      mainBenefit: "It simplifies the process of scheduling a meeting",
      improvement: "Would love to see an API for integrating with other services",
    },
    {
      disappointment: "Very disappointed",
      role: "Software Engineer",
      whoBenefits: "Freelancers juggling multiple clients",
      mainBenefit: "It's great for managing different time zones",
      improvement: "Integration with a wider variety of calendars would be great",
    },
    {
      disappointment: "Not at all disappointed",
      role: "Founder",
      whoBenefits: "Anyone managing a lot of meetings in their personal or professional life",
      mainBenefit: "The automation features are a lifesaver",
      improvement: "A desktop app would be a nice addition",
    },
    {
      disappointment: "Very disappointed",
      role: "Product Owner",
      whoBenefits: "Remote teams spread across different time zones",
      mainBenefit: "The ease of scheduling meetings across multiple time zones is impressive",
      improvement: "It could offer better suggestions for optimal meeting times",
    },
    {
      disappointment: "Somewhat disappointed",
      role: "Executive",
      whoBenefits: "Startups needing a robust but easy-to-use scheduling tool",
      mainBenefit: "Keeps everything organized and everyone on the same page",
      improvement: "I'd like to see more robust reporting features",
    },
    {
      disappointment: "Somewhat disappointed",
      role: "Product Manager",
      whoBenefits: "Project leads coordinating with multiple stakeholders",
      mainBenefit: "Simplifies coordination with internal and external team members",
      improvement: "I wish there was a built-in video conferencing feature",
    },
    {
      disappointment: "Very disappointed",
      role: "Software Engineer",
      whoBenefits: "Individuals managing large-scale projects",
      mainBenefit: "Makes it easy to schedule and reschedule as needed",
      improvement: "Ability to assign tasks within the calendar could be useful",
    },
    {
      disappointment: "Not at all disappointed",
      role: "Founder",
      whoBenefits: "Entrepreneurs who need to balance a variety of tasks",
      mainBenefit: "Streamlines the process of organizing my work day",
      improvement: "I'd like more customization options for the user interface",
    },
    {
      disappointment: "Very disappointed",
      role: "Product Owner",
      whoBenefits: "Project managers overseeing complex timelines",
      mainBenefit: "The reminders and notifications keep me on track",
      improvement: "Integration with task management tools could be deeper",
    },
    {
      disappointment: "Somewhat disappointed",
      role: "Executive",
      whoBenefits: "Management staff who need to oversee schedules",
      mainBenefit: "Helps me keep track of my team's availability",
      improvement: "More intuitive navigation would be appreciated",
    },
    {
      disappointment: "Somewhat disappointed",
      role: "Product Manager",
      whoBenefits: "Teams that are working on a tight schedule",
      mainBenefit: "Prevents overbooking and double-booking",
      improvement: "More granular control over availability would be nice",
    },
    {
      disappointment: "Very disappointed",
      role: "Software Engineer",
      whoBenefits: "Individuals who want to automate their scheduling",
      mainBenefit: "Saves time and reduces scheduling errors",
      improvement: "A chatbot for instant scheduling could be a good addition",
    },
    {
      disappointment: "Not at all disappointed",
      role: "Founder",
      whoBenefits: "Entrepreneurs with a small but growing team",
      mainBenefit: "Helps me efficiently allocate my time",
      improvement: "A mobile app for on-the-go scheduling would be useful",
    },
    {
      disappointment: "Somewhat disappointed",
      role: "Product Owner",
      whoBenefits: "Anyone who wants to streamline their scheduling process",
      mainBenefit: "It makes managing multiple schedules easy",
      improvement: "I'd like to see some tutorial videos for new features",
    },
  ];

  // Generate 30 unique people
  const people: any[] = [];
  for (let i = 0; i < 30; i++) {
    const person = await prisma.person.create({
      data: {
        environment: { connect: { id: newProduct.environments[0].id } },
        email: `user${i}@demo.com`, // unique email
        userId: `userId${i}`, // unique user id
        attributeClasses: {
          // assigning 6 attribute classes
          create: [
            { name: "role", value: roles[Math.floor(Math.random() * roles.length)] }, // "role" is assigned randomly from roles array
            { name: "experience", value: experiences[Math.floor(Math.random() * experiences.length)] }, // "experience" is assigned randomly from experiences array
            {
              name: "product_usage_frequency",
              value: productUsageFrequencies[Math.floor(Math.random() * productUsageFrequencies.length)],
            }, // "product_usage_frequency" is assigned randomly from productUsageFrequencies array
            { name: "company_size", value: companySizes[Math.floor(Math.random() * companySizes.length)] }, // "company_size" is assigned randomly from companySizes array
            {
              name: "product_satisfaction_level",
              value: productSatisfactionLevels[Math.floor(Math.random() * productSatisfactionLevels.length)],
            }, // "product_satisfaction_level" is assigned randomly from productSatisfactionLevels array
            {
              name: "recommendation_likelihood",
              value: recommendationLikelihoods[Math.floor(Math.random() * recommendationLikelihoods.length)],
            }, // "recommendation_likelihood" is assigned randomly from recommendationLikelihoods array
          ],
        },
      },
    });
    people.push(person);
  }

  // Create surveys using the templates and submissions data
  await Promise.all(templates.map(async (templateData) => {
    const { category, description, preset, ...template } = templateData;

    // Generate responses and displays for each person
    const responses = [];
    const displays = [];
    people.forEach((person, index) => {
      responses.push({
        finished: true,
        data: {}, // replace this with appropriate data
        meta: {},
        person: {
          connect: {
            id: person.id,
          },
        },
      });
      displays.push({
        person: {
          connect: {
            id: person.id,
          },
        },
        status: "responded",
      });
    });

    // Create a survey
    await prisma.survey.create({
      data: {
        ...template,
        status: "inProgress",
        environment: { connect: { id: newProduct.environments[0].id } },
        questions: preset.questions as any,
        responses: {
          create: responses,
        },
        displays: {
          create: displays,
        },
      },
    });
  }));
} catch (error) {
  console.error(error)
}

function createDefaultProductData(productName: string) {
  return [
    {
      name: productName,
      environments: {
        create: [
          {
            type: "production",
            eventClasses: {
              create: [
                {
                  name: "New Session",
                  description: "Gets fired when a new session is created",
                  type: "automatic",
                },
                {
                  name: "Exit Intent (Desktop)",
                  description: "A user on Desktop leaves the website with the cursor.",
                  type: "automatic",
                },
                {
                  name: "50% Scroll",
                  description: "A user scrolled 50% of the current page",
                  type: "automatic",
                },
              ],
            },
            attributeClasses: {
              create: [
                {
                  name: "userId",
                  description: "The internal ID of the person",
                  type: "automatic",
                },
                {
                  name: "email",
                  description: "The email of the person",
                  type: "automatic",
                },
              ],
            },
          },
          {
            type: "development",
            eventClasses: {
              create: [
                {
                  name: "New Session",
                  description: "Gets fired when a new session is created",
                  type: "automatic",
                },
              ],
            },
            attributeClasses: {
              create: [
                {
                  name: "userId",
                  description: "The internal ID of the person",
                  type: "automatic",
                },
                {
                  name: "email",
                  description: "The email of the person",
                  type: "automatic",
                },
              ],
            },
          },
        ],
      },
    },
  ];
}
