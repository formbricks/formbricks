-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_environmentId_idx" ON "ApiKey"("environmentId");

-- CreateIndex
CREATE INDEX "AttributeClass_environmentId_idx" ON "AttributeClass"("environmentId");

-- CreateIndex
CREATE INDEX "Display_surveyId_idx" ON "Display"("surveyId");

-- CreateIndex
CREATE INDEX "Display_personId_idx" ON "Display"("personId");

-- CreateIndex
CREATE INDEX "Environment_productId_idx" ON "Environment"("productId");

-- CreateIndex
CREATE INDEX "Integration_environmentId_idx" ON "Integration"("environmentId");

-- CreateIndex
CREATE INDEX "Invite_teamId_idx" ON "Invite"("teamId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_teamId_idx" ON "Membership"("teamId");

-- CreateIndex
CREATE INDEX "Person_environmentId_idx" ON "Person"("environmentId");

-- CreateIndex
CREATE INDEX "Product_teamId_idx" ON "Product"("teamId");

-- CreateIndex
CREATE INDEX "Response_surveyId_created_at_idx" ON "Response"("surveyId", "created_at");

-- CreateIndex
CREATE INDEX "Response_surveyId_idx" ON "Response"("surveyId");

-- CreateIndex
CREATE INDEX "ResponseNote_responseId_idx" ON "ResponseNote"("responseId");

-- CreateIndex
CREATE INDEX "Survey_environmentId_idx" ON "Survey"("environmentId");

-- CreateIndex
CREATE INDEX "SurveyAttributeFilter_surveyId_idx" ON "SurveyAttributeFilter"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyAttributeFilter_attributeClassId_idx" ON "SurveyAttributeFilter"("attributeClassId");

-- CreateIndex
CREATE INDEX "SurveyTrigger_surveyId_idx" ON "SurveyTrigger"("surveyId");

-- CreateIndex
CREATE INDEX "Tag_environmentId_idx" ON "Tag"("environmentId");

-- CreateIndex
CREATE INDEX "TagsOnResponses_responseId_idx" ON "TagsOnResponses"("responseId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Webhook_environmentId_idx" ON "Webhook"("environmentId");

-- RenameIndex
ALTER INDEX "email_teamId_unique" RENAME TO "Invite_email_teamId_idx";
