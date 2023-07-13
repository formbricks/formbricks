"use server";

import { prisma } from "@formbricks/database";
import { Team } from "@prisma/client";
import { QuestionType } from "@formbricks/types/questions";
import { createId } from "@paralleldrive/cuid2";

export async function createTeam(teamName: string, ownerUserId: string): Promise<Team> {
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
      products: {
        create: [
          {
            name: "My Product",
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
              ],
            },
          },
          {
            name: "Demo Product",
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
              ],
            },
          },
        ],
      },
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

  // call addDemoData with new team's id
  await addDemoData(newTeam.id);

  return newTeam;
}

export async function addDemoData(teamId: string): Promise<void> {
  // find the team
  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
    include: {
      products: {
        include: {
          environments: true,
        },
      },
    },
  });

  if (team === null) {
    throw new Error(`No team found with ID ${teamId}`);
  }

  // find the product
  const product = team.products.find((product) => product.name === "Demo Product");

  if (!product) {
    throw new Error(`No product named 'My Product' found in team ${teamId}`);
  }

  const prodEnvironment = product.environments.find((environment) => environment.type === "production");
  // add attributes to each environment of the product
  // dont add dev environment

  const updatedEnvironment = await prisma.environment.update({
    where: { id: prodEnvironment?.id },
    data: {
      eventClasses: {
        create: [
          {
            name: "Created New Event",
            description: "Person created a new event",
            type: "code",
          },
          {
            name: "Updated Availability",
            description: "Person updated their availability",
            type: "code",
          },
          {
            name: "Received Booking Request",
            description: "Person received a booking request",
            type: "code",
          },
          {
            name: "Invited Team Member",
            description: "Person invited a team member",
            type: "noCode",
            noCodeConfig: { type: "innerHtml", innerHtml: { value: "Add Team Member" } },
          },
          {
            name: "Created New Workflow",
            description: "Person setup a new workflow",
            type: "noCode",
            noCodeConfig: { type: "innerHtml", innerHtml: { value: "Create Workflow" } },
          },
          {
            name: "Viewed Insight",
            description: "Person viewed the insights dashboard",
            type: "noCode",
            noCodeConfig: { type: "pageUrl", pageUrl: { rule: "contains", value: "insights" } },
          },
        ],
      },
      attributeClasses: {
        create: [
          {
            name: "Name",
            description: "Full Name of the Person",
            type: "code",
          },
          {
            name: "Role",
            description: "Current role of the person",
            type: "code",
          },
          {
            name: "Company",
            description: "The company they work at",
            type: "code",
          },
          {
            name: "Experience",
            description: "Level of experience of the person",
            type: "code",
          },
          {
            name: "Usage Frequency",
            description: "Frequency of product usage",
            type: "automatic",
          },
          {
            name: "Company Size",
            description: "Company size",
            type: "code",
          },
          {
            name: "Product Satisfaction Score",
            description: "Level of product satisfaction of the person",
            type: "automatic",
          },
          {
            name: "Recommendation Likelihood",
            description: "Likehood of recommending the product",
            type: "automatic",
          },
        ],
      },
    },
    include: {
      attributeClasses: true, // include attributeClasses
    },
  });

  // check if updatedEnvironment exists and it has attributeClasses
  if (!updatedEnvironment || !updatedEnvironment.attributeClasses) {
    throw new Error("Attribute classes could not be created");
  }

  // CREATING DEMO DATA
  // Create 20 People with Attributes
  const people: any[] = [];
  const attributeClasses = updatedEnvironment.attributeClasses;

  const names = [
    "Wei Zhu",
    "Akiko Yamada",
    "Elena Petrova",
    "Sophia Johnson",
    "Jorge Sanchez",
    "Fatima Al Zahra",
    "Ravi Kumar",
    "Maria Silva",
    "Amahle Dlamini",
    "Antonio García",
    "Leon Müller",
    "Chloe Lefevre",
    "Alessia Rossi",
    "Eva Svendsen",
    "Sara Eriksson",
    "Liam O'Brien",
    "Anastasia Sokolova",
    "Yara van der Heijden",
    "Zeynep Gündoğan",
    "Gabriella Mészáros",
  ];

  const companies = [
    "Google",
    "Apple",
    "Microsoft",
    "Amazon",
    "Facebook",
    "Tesla",
    "Netflix",
    "Oracle",
    "Adobe",
    "IBM",
    "McDonald's",
    "Coca-Cola",
    "Pepsi",
    "Samsung",
    "Intel",
    "Nvidia",
    "Visa",
    "MasterCard",
    "Paypal",
    "Spotify",
  ];

  // A function to generate attribute values based on attribute class name, person's name, and company information
  function generateAttributeValue(
    attributeClassName: string,
    name: string,
    company: string,
    domain: string,
    i: number
  ): string {
    switch (attributeClassName) {
      case "userId":
        return `CYO${Math.floor(Math.random() * 999)}`; // Company size from 0 to 5000 employees
      case "email":
        return `${name.split(" ")[0].toLowerCase()}@${domain}`;
      case "Name":
        return name;
      case "Role":
        const roles = ["Manager", "Employee", "Developer", "Designer", "Product Manager", "Marketing"];
        return roles[i % roles.length]; // This ensures even distribution of roles among the people
      case "Experience":
        return `${Math.floor(Math.random() * 11)} years`; // Experience from 0 to 10 years
      case "Usage Frequency":
        const frequencies = ["Daily", "Weekly", "Monthly", "Yearly"];
        return frequencies[i % frequencies.length]; // This ensures even distribution of frequencies among the people
      case "Company Size":
        return `${Math.floor(Math.random() * 5001)} employees`; // Company size from 0 to 5000 employees
      case "Product Satisfaction Score":
        return `${Math.floor(Math.random() * 101)}`; // Satisfaction score from 0 to 100
      case "Recommendation Likelihood":
        return `${Math.floor(Math.random() * 11)}`; // Likelihood from 0 to 10
      case "Company Name":
        return company;
      default:
        return "Unknown";
    }
  }

  for (let i = 0; i < 20; i++) {
    // for each person, create a set of attributes that link to the attributeClasses
    const attributes = attributeClasses.map((attributeClass) => {
      let value = generateAttributeValue(
        attributeClass.name,
        names[i],
        companies[i],
        `${companies[i].toLowerCase().split(" ").join("")}.com`,
        i
      );
      return {
        attributeClass: { connect: { id: attributeClass.id } },
        value: value,
      };
    });

    const person = await prisma.person.create({
      data: {
        environment: { connect: { id: product.environments[0].id } },
        attributes: { create: attributes },
      },
    });
    people.push(person);
  }

  // Create Surveys with Display and Responses

  // PMF survey
  const PMFSurvey = {
    name: "Product Market Fit",
    type: "link",
    status: "inProgress",
    questions: [
      {
        id: "survey-cta",
        html: "We would love to understand your user experience better. Sharing your insight helps a lot!",
        type: QuestionType.CTA,
        logic: [{ condition: "skipped", destination: "end" }],
        headline: "You are one of our power users! Do you have 5 minutes?",
        required: false,
        buttonLabel: "Happy to help!",
        buttonExternal: false,
        dismissButtonLabel: "No, thanks.",
      },
      {
        id: "disappointment-score",
        type: QuestionType.MultipleChoiceSingle,
        headline: "How disappointed would you be if you could no longer use CalendYo?",
        subheader: "Please select one of the following options:",
        required: true,
        choices: [
          {
            id: createId(),
            label: "Not at all disappointed",
          },
          {
            id: createId(),
            label: "Somewhat disappointed",
          },
          {
            id: createId(),
            label: "Very disappointed",
          },
        ],
      },
      {
        id: "roles",
        type: QuestionType.MultipleChoiceSingle,
        headline: "What is your role?",
        subheader: "Please select one of the following options:",
        required: true,
        choices: [
          {
            id: createId(),
            label: "Founder",
          },
          {
            id: createId(),
            label: "Executive",
          },
          {
            id: createId(),
            label: "Product Manager",
          },
          {
            id: createId(),
            label: "Product Owner",
          },
          {
            id: createId(),
            label: "Software Engineer",
          },
        ],
      },
      {
        id: "who-benefits-most",
        type: QuestionType.OpenText,
        headline: "What type of people do you think would most benefit from CalendYo?",
        required: true,
      },
      {
        id: "main-benefit",
        type: QuestionType.OpenText,
        headline: "What is the main benefit your receive from CalendYo?",
        required: true,
      },
      {
        id: "improve-demo",
        type: QuestionType.OpenText,
        headline: "How can we improve CalendYo for you?",
        subheader: "Please be as specific as possible.",
        required: true,
      },
    ],
  };

  const PMFResponses = [
    {
      roles: "Software Engineer",
      "survey-cta": "clicked",
      "improve-demo": "Integration with more third-party apps would be great",
      "main-benefit": "Allows for seamless coordination between different time zones",
      "who-benefits-most": "Freelancers who work with international clients",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Founder",
      "survey-cta": "clicked",
      "improve-demo": "I'd love to see an offline mode",
      "main-benefit": "Streamlines the appointment scheduling process saving us hours each week",
      "who-benefits-most": "Startup founders who juggle a lot of meetings",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Product Manager",
      "survey-cta": "clicked",
      "improve-demo": "User interface could be more intuitive",
      "main-benefit": "Allows for easy scheduling and rescheduling of team meetings",
      "who-benefits-most": "Project managers with large teams",
      "disappointment-score": "Somewhat disappointed",
    },
    {
      roles: "Product Owner",
      "survey-cta": "clicked",
      "improve-demo": "An option to add more personalized messages would be great",
      "main-benefit": "Allows clients to schedule meetings according to their convenience",
      "who-benefits-most": "Consultants who manage multiple clients",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Software Engineer",
      "survey-cta": "clicked",
      "improve-demo": "The mobile app could use some improvements",
      "main-benefit": "Takes care of scheduling so I can focus more on coding",
      "who-benefits-most": "Developers in a distributed team",
      "disappointment-score": "Somewhat disappointed",
    },
    {
      roles: "Executive",
      "survey-cta": "clicked",
      "improve-demo": "A group scheduling feature would be nice",
      "main-benefit": "Simplifies managing my busy schedule",
      "who-benefits-most": "Executives with back-to-back meetings",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Product Manager",
      "survey-cta": "clicked",
      "improve-demo": "Maybe a lighter theme for the UI?",
      "main-benefit": "A unified view of all my appointments in one place",
      "who-benefits-most": "Professionals who have to manage multiple projects",
      "disappointment-score": "Not at all disappointed",
    },
    {
      roles: "Product Owner",
      "survey-cta": "clicked",
      "improve-demo": "Add options for non-business hours scheduling for flexible work",
      "main-benefit": "Easily coordinating meetings across different departments",
      "who-benefits-most": "Teams working in shifts",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Software Engineer",
      "survey-cta": "clicked",
      "improve-demo": "In-app notifications for upcoming meetings would be beneficial",
      "main-benefit": "Eases cross-team collaborations for product development",
      "who-benefits-most": "Developers in a cross-functional team setup",
      "disappointment-score": "Somewhat disappointed",
    },
    {
      roles: "Founder",
      "survey-cta": "clicked",
      "improve-demo": "Option for booking slots for different services would be helpful",
      "main-benefit": "Helps organize client calls without back-and-forth emails",
      "who-benefits-most": "Service-based business owners",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Executive",
      "survey-cta": "clicked",
      "improve-demo": "More customization options for calendar integration",
      "main-benefit": "Synchronizes all my appointments in one place",
      "who-benefits-most": "Professionals juggling between different calendars",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Product Manager",
      "survey-cta": "clicked",
      "improve-demo": "Capability to export calendar would be a great addition",
      "main-benefit": "Simplifies planning and tracking of meetings",
      "who-benefits-most": "Project managers handling multiple schedules",
      "disappointment-score": "Somewhat disappointed",
    },
    {
      roles: "Product Owner",
      "survey-cta": "clicked",
      "improve-demo": "Better handling of time zone differences would be appreciated",
      "main-benefit": "Ensures smooth coordination for product development",
      "who-benefits-most": "Product owners in a global setup",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Software Engineer",
      "survey-cta": "clicked",
      "improve-demo": "Better error handling and alerts when conflicts occur",
      "main-benefit": "Facilitates efficient scheduling of scrum meetings",
      "who-benefits-most": "Developers in an agile team",
      "disappointment-score": "Somewhat disappointed",
    },
    {
      roles: "Founder",
      "survey-cta": "clicked",
      "improve-demo": "Adding video call links directly would be a good addition",
      "main-benefit": "Saves time in coordinating for meetings, especially investor pitches",
      "who-benefits-most": "Startups looking for investments",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Executive",
      "survey-cta": "clicked",
      "improve-demo": "More control over look and feel for customer facing scheduling page",
      "main-benefit": "Enhances productivity by removing manual coordination",
      "who-benefits-most": "Business leaders frequently interacting with stakeholders",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Product Manager",
      "survey-cta": "clicked",
      "improve-demo": "Better analytics for usage and peak scheduling hours",
      "main-benefit": "Easily track and manage all team meetings",
      "who-benefits-most": "Managers overseeing multiple projects",
      "disappointment-score": "Somewhat disappointed",
    },
    {
      roles: "Product Owner",
      "survey-cta": "clicked",
      "improve-demo": "Add reminders for upcoming scheduled meetings",
      "main-benefit": "Facilitates effective planning and scheduling of product reviews",
      "who-benefits-most": "Product owners overseeing product development lifecycle",
      "disappointment-score": "Very disappointed",
    },
    {
      roles: "Software Engineer",
      "survey-cta": "clicked",
      "improve-demo": "Add integrations with more project management tools",
      "main-benefit": "Helps me to align with my team and stakeholders on meeting schedules",
      "who-benefits-most": "Developers in larger teams who need to synchronize their work schedules",
      "disappointment-score": "Somewhat disappointed",
    },
    {
      roles: "Executive",
      "survey-cta": "clicked",
      "improve-demo": "Add a feature for automated meeting minutes and follow-up task assignments",
      "main-benefit": "Helps me streamline the scheduling process with different teams and stakeholders",
      "who-benefits-most": "Leaders and managers who need to effectively manage their time",
      "disappointment-score": "Very disappointed",
    },
  ];

  const OnboardingSurvey = {
    name: "Onboarding Survey",
    type: "link",
    status: "inProgress",
    questions: [
      {
        id: "intention",
        type: QuestionType.MultipleChoiceSingle,
        headline: "What are you here for?",
        required: true,
        choices: [
          {
            id: createId(),
            label: "Schedule calls with clients",
          },
          {
            id: createId(),
            label: "Offer self-serve appointments",
          },
          {
            id: createId(),
            label: "Organize my team internally",
          },
          {
            id: createId(),
            label: "Build scheduling into my tool",
          },
          {
            id: createId(),
            label: "Organize group meetings",
          },
        ],
      },
      {
        id: "company-size",
        type: QuestionType.MultipleChoiceSingle,
        headline: "What's your company size?",
        subheader: "Please select one of the following options:",
        required: true,
        choices: [
          {
            id: createId(),
            label: "only me",
          },
          {
            id: createId(),
            label: "1-5 employees",
          },
          {
            id: createId(),
            label: "6-10 employees",
          },
          {
            id: createId(),
            label: "11-100 employees",
          },
          {
            id: createId(),
            label: "over 100 employees",
          },
        ],
      },
      {
        id: "first-contact",
        type: QuestionType.MultipleChoiceSingle,
        headline: "How did you hear about us first?",
        subheader: "Please select one of the following options:",
        required: true,
        choices: [
          {
            id: createId(),
            label: "Recommendation",
          },
          {
            id: createId(),
            label: "Social Media",
          },
          {
            id: createId(),
            label: "Ads",
          },
          {
            id: createId(),
            label: "Google Search",
          },
          {
            id: createId(),
            label: "In a Podcast",
          },
        ],
      },
    ],
  };

  const OnboardingResponses = [
    {
      intention: "Schedule calls with clients",
      "company-size": "only me",
      "first-contact": "Google Search",
    },
    {
      intention: "Offer self-serve appointments",
      "company-size": "1-5 employees",
      "first-contact": "Social Media",
    },
    {
      intention: "Organize my team internally",
      "company-size": "6-10 employees",
      "first-contact": "Recommendation",
    },
    {
      intention: "Build scheduling into my tool",
      "company-size": "only me",
      "first-contact": "Ads",
    },
    {
      intention: "Organize group meetings",
      "company-size": "11-100 employees",
      "first-contact": "In a Podcast",
    },
    {
      intention: "Schedule calls with clients",
      "company-size": "over 100 employees",
      "first-contact": "Recommendation",
    },
    {
      intention: "Offer self-serve appointments",
      "company-size": "1-5 employees",
      "first-contact": "Social Media",
    },
    {
      intention: "Organize my team internally",
      "company-size": "only me",
      "first-contact": "Social Media",
    },
    {
      intention: "Build scheduling into my tool",
      "company-size": "6-10 employees",
      "first-contact": "Social Media",
    },
    {
      intention: "Schedule calls with clients",
      "company-size": "1-5 employees",
      "first-contact": "Recommendation",
    },
    {
      intention: "Schedule calls with clients",
      "company-size": "11-100 employees",
      "first-contact": "Social Media",
    },
    {
      intention: "Offer self-serve appointments",
      "company-size": "over 100 employees",
      "first-contact": "Google Search",
    },
    {
      intention: "Organize my team internally",
      "company-size": "only me",
      "first-contact": "Recommendation",
    },
    {
      intention: "Offer self-serve appointments",
      "company-size": "1-5 employees",
      "first-contact": "Ads",
    },
    {
      intention: "Schedule calls with clients",
      "company-size": "6-10 employees",
      "first-contact": "Recommendation",
    },
    {
      intention: "Schedule calls with clients",
      "company-size": "11-100 employees",
      "first-contact": "Social Media",
    },
    {
      intention: "Offer self-serve appointments",
      "company-size": "over 100 employees",
      "first-contact": "Google Search",
    },
    {
      intention: "Organize my team internally",
      "company-size": "only me",
      "first-contact": "Recommendation",
    },
    {
      intention: "Offer self-serve appointments",
      "company-size": "1-5 employees",
      "first-contact": "Ads",
    },
    {
      intention: "Schedule calls with clients",
      "company-size": "6-10 employees",
      "first-contact": "Recommendation",
    },
  ];

  // Define possible user agents
  const userAgents = [
    { os: "Windows", browser: "Chrome" },
    { os: "MacOS", browser: "Safari" },
    { os: "Linux", browser: "Firefox" },
    { os: "Windows", browser: "Edge" },
    { os: "iOS", browser: "Safari" },
    { os: "Android", browser: "Chrome" },
    { os: "MacOS", browser: "Chrome" },
    { os: "Windows", browser: "Firefox" },
  ];

  // Create a function that generates responses and displays
  const generateResponsesAndDisplays = (people, detailedResponses, userAgents) => {
    const responses: any = [];
    const displays: any = [];

    people.forEach((person, index) => {
      responses.push({
        finished: true,
        data: detailedResponses[index % detailedResponses.length],
        meta: { userAgent: userAgents[Math.floor(Math.random() * userAgents.length)] },
        person: { connect: { id: person.id } },
      });
      displays.push({
        person: { connect: { id: person.id } },
        status: "responded",
      });
    });

    return { responses, displays };
  };

  // Create a function that creates a survey
  const createSurvey = async (survey, responses, displays) => {
    return await prisma.survey.create({
      data: {
        ...survey,
        environment: { connect: { id: product.environments[0].id } },
        questions: survey.questions as any,
        responses: { create: responses },
        displays: { create: displays },
      },
    });
  };

  // Generate responses and displays for PMF survey
  const PMFResults = generateResponsesAndDisplays(people, PMFResponses, userAgents);

  // Generate responses and displays for Onboarding survey
  const OnboardingResults = generateResponsesAndDisplays(people, OnboardingResponses, userAgents);

  // Create the surveys
  await createSurvey(PMFSurvey, PMFResults.responses, PMFResults.displays);
  await createSurvey(OnboardingSurvey, OnboardingResults.responses, OnboardingResults.displays);
}
