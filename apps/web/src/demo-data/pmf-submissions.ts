const improvements = [
  "Please provide a mobile app so I can check my account balance on the go",
  "Make it possible to archive old transactions",
  "Make it possible to add a note to a transaction",
  "A mobile app would be awesome",
  "I would like to be able to add a note to a transaction",
  "I would like to be able to archive old transactions",
  "I think a cool feature would be if I could organize my transactions into categories",
];

const mainBenefits = [
  "I like that I can see my account balance",
  "I like that I can see my transactions at a glance",
  "getting a notification when I receive money",
  "Seeing all my transactions in one place",
  "I like that I can see my account balance",
  "Totally love the notifications when I receive money",
  "The best is that I can get an overview of all my transactions",
  "Love the notifications when I receive money",
  "The notifications when I receive money are great",
];

const roles = ["founder", "executive", "productManager", "productOwner", "softwareEngineer"];

const disappointments = [
  "veryDisappointed",
  "veryDisappointed",
  "veryDisappointed",
  "somewhatDisappointed",
  "somewhatDisappointed",
  "notDisappointed",
];

const benefitingUserss = [
  "Founders",
  "Executives",
  "Product Managers",
  "Product Owners",
  "Software Engineers",
  "Designers",
  "Other founders",
  "Other executives",
  "Other product managers",
  "Other product owners",
  "My befriended software engineers",
  "My befriended designers",
  "My befriended founders",
  "I think other founders would like this",
  "I think other executives would like this",
  "I think other product managers would like this",
];

export const getPmfSubmissions = () => {
  const submissions = [];
  for (let i = 0; i < 28; i++) {
    submissions.push({
      id: `demo-pmf-submission-${i}`,
      createdAt: "2023-02-08T11:04:04.084Z",
      updatedAt: "2023-02-08T11:04:09.752Z",
      finished: true,
      archived: false,
      formId: "demo-pmf",
      customerEmail: "user@example.com",
      customerOrganisationId: "demo-organisation",
      data: {
        improvement: getRandomItem(improvements),
        mainBenefit: getRandomItem(mainBenefits),
        role: getRandomItem(roles),
        disappointment: getRandomItem(disappointments),
        benefitingUsers: getRandomItem(benefitingUserss),
      },
      meta: {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
      },
    });
  }
  return submissions;
};

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
