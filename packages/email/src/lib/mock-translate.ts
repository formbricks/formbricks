// Mock translation function for React Email preview server
// Returns English strings extracted from apps/web/locales/en-US.json

type TranslationKey = string;
type TranslationValue = string;

const translations: Record<TranslationKey, TranslationValue> = {
  "emails.accept": "Accept",
  "emails.click_or_drag_to_upload_files": "Click or drag to upload files.",
  "emails.email_customization_preview_email_heading": "Hey {userName}",
  "emails.email_customization_preview_email_subject": "Formbricks Email Customization Preview",
  "emails.email_customization_preview_email_text":
    "This is an email preview to show you which logo will be rendered in the emails.",
  "emails.email_footer_text_1": "Have a great day!",
  "emails.email_footer_text_2": "The Formbricks Team",
  "emails.email_template_text_1": "This email was sent via Formbricks.",
  "emails.embed_survey_preview_email_didnt_request": "Didn't request this?",
  "emails.embed_survey_preview_email_environment_id": "Environment ID",
  "emails.embed_survey_preview_email_fight_spam":
    "Help us fight spam and forward this mail to hola@formbricks.com",
  "emails.embed_survey_preview_email_heading": "Preview Email Embed",
  "emails.embed_survey_preview_email_subject": "Formbricks Email Survey Preview",
  "emails.embed_survey_preview_email_text": "This is how the code snippet looks embedded into an email:",
  "emails.forgot_password_email_change_password": "Change password",
  "emails.forgot_password_email_did_not_request": "If you didn't request this, please ignore this email.",
  "emails.forgot_password_email_heading": "Change password",
  "emails.forgot_password_email_link_valid_for_24_hours": "The link is valid for 24 hours.",
  "emails.forgot_password_email_subject": "Reset your Formbricks password",
  "emails.forgot_password_email_text":
    "You have requested a link to change your password. You can do this by clicking the link below:",
  "emails.hidden_field": "Hidden field",
  "emails.imprint": "Imprint",
  "emails.invite_accepted_email_heading": "Hey",
  "emails.invite_accepted_email_subject": "You've got a new organization member!",
  "emails.invite_accepted_email_text_par1": "Just letting you know that",
  "emails.invite_accepted_email_text_par2": "accepted your invitation. Have fun collaborating!",
  "emails.invite_email_button_label": "Join organization",
  "emails.invite_email_heading": "Hey",
  "emails.invite_email_text_par1": "Your colleague",
  "emails.invite_email_text_par2":
    "invited you to join them at Formbricks. To accept the invitation, please click the link below:",
  "emails.invite_member_email_subject": "You're invited to collaborate on Formbricks!",
  "emails.new_email_verification_text": "To verify your new email address, please click the button below:",
  "emails.number_variable": "Number variable",
  "emails.password_changed_email_heading": "Password changed",
  "emails.password_changed_email_text": "Your password has been changed successfully.",
  "emails.password_reset_notify_email_subject": "Your Formbricks password has been changed",
  "emails.privacy_policy": "Privacy Policy",
  "emails.reject": "Reject",
  "emails.render_email_response_value_file_upload_response_link_not_included":
    "Link to uploaded file is not included for data privacy reasons",
  "emails.response_data": "Response data",
  "emails.response_finished_email_subject": "A response for {surveyName} was completed ✅",
  "emails.response_finished_email_subject_with_email":
    "{personEmail} just completed your {surveyName} survey ✅",
  "emails.schedule_your_meeting": "Schedule your meeting",
  "emails.select_a_date": "Select a date",
  "emails.survey_response_finished_email_congrats":
    "Congrats, you received a new response to your survey! Someone just completed your survey: {surveyName}",
  "emails.survey_response_finished_email_dont_want_notifications": "Don't want to get these notifications?",
  "emails.survey_response_finished_email_hey": "Hey 👋",
  "emails.survey_response_finished_email_turn_off_notifications_for_all_new_forms":
    "Turn off notifications for all newly created forms",
  "emails.survey_response_finished_email_turn_off_notifications_for_this_form":
    "Turn off notifications for this form",
  "emails.survey_response_finished_email_view_more_responses": "View {responseCount} more responses",
  "emails.survey_response_finished_email_view_survey_summary": "View survey summary",
  "emails.text_variable": "Text variable",
  "emails.verification_email_click_on_this_link": "You can also click on this link:",
  "emails.verification_email_heading": "Almost there!",
  "emails.verification_email_hey": "Hey 👋",
  "emails.verification_email_if_expired_request_new_token":
    "If it has expired please request a new token here:",
  "emails.verification_email_link_valid_for_24_hours": "The link is valid for 24 hours.",
  "emails.verification_email_request_new_verification": "Request new verification",
  "emails.verification_email_subject": "Please verify your email to use Formbricks",
  "emails.verification_email_survey_name": "Survey name",
  "emails.verification_email_take_survey": "Take survey",
  "emails.verification_email_text": "To start using Formbricks please verify your email below:",
  "emails.verification_email_thanks": "Thanks for validating your email!",
  "emails.verification_email_to_fill_survey": "To fill out the survey please click on the button below:",
  "emails.verification_email_verify_email": "Verify email",
  "emails.verification_new_email_subject": "Email change verification",
  "emails.verification_security_notice":
    "If you did not request this email change, please ignore this email or contact support immediately.",
  "emails.verified_link_survey_email_subject": "Your survey is ready to be filled out.",
};

// Simple string replacement for placeholders like {userName}, {surveyName}, etc.
const replacePlaceholders = (text: string, replacements?: Record<string, string>): string => {
  if (!replacements) return text;

  let result = text;
  Object.entries(replacements).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  });

  return result;
};

/**
 * Mock translation function for preview server
 * @param key - Translation key (e.g., "emails.forgot_password_email_heading")
 * @param replacements - Optional object with placeholder replacements
 * @returns Translated string with placeholders replaced
 */
export const t = (key: string, replacements?: Record<string, string>): string => {
  const translation = translations[key] || key;
  return replacePlaceholders(translation, replacements);
};
