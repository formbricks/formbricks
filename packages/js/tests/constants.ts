const generateUserId = () => {
  const min = 1000;
  const max = 9999;
  const randomNum = Math.floor(Math.random() * (max - min + 1) + min);
  return randomNum.toString();
};

const generateEmailId = () => {
  const domain = "formbricks.test";
  const randomString = Math.random().toString(36).substring(2);
  const emailId = `${randomString}@${domain}`;
  return emailId;
};

const generateRandomString = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const maxLength = 8;

  let randomString = "";
  for (let i = 0; i < maxLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }
  return randomString;
};

const getOneDayExpiryTime = () => {
  var ms = new Date().getTime();
  var oneDayMs = 24 * 60 * 60 * 1000; // Number of milliseconds in one day
  var expiryOfOneDay = ms + oneDayMs;
  return expiryOfOneDay;
};

export const constants = {
  environmentId: "mockedEnvironmentId",
  apiHost: "mockedApiHost",
  sessionId: generateRandomString(),
  expiryTime: getOneDayExpiryTime(),
  surveyId: generateRandomString(),
  questionOneId: generateRandomString(),
  questionTwoId: generateRandomString(),
  choiceOneId: generateRandomString(),
  choiceTwoId: generateRandomString(),
  choiceThreeId: generateRandomString(),
  choiceFourId: generateRandomString(),
  initialPersonUid: generateRandomString(),
  newPersonUid: generateRandomString(),
  initialUserId: generateUserId(),
  initialUserEmail: generateEmailId(),
  updatedUserEmail: generateEmailId(),
  customAttributeKey: generateRandomString(),
  customAttributeValue: generateRandomString(),
  userIdAttributeId: generateRandomString(),
  userInitialEmailAttributeId: generateRandomString(),
  userCustomAttrAttributeId: generateRandomString(),
  userUpdatedEmailAttributeId: generateRandomString(),
  eventIdForEventTracking: generateRandomString(),
  eventIdForRouteChange: generateRandomString(),
} as const;
