INSERT INTO public."User" (id, created_at, updated_at, name, email, email_verified, password, "identityProvider",
                           "identityProviderAccountId", "groupId", objective, role, "onboardingCompleted",
                           "notificationSettings", "backupCodes", "twoFactorEnabled", "twoFactorSecret", "imageUrl")
VALUES ('cltzt2i4c000108l14f6ygrkr', '2024-03-20 11:39:50.222', '2024-03-20 11:39:50.222', 'Opinodo Developer',
        'dev@opinodo.com', null, '$2b$10$vKK/irSPr14Zu0mhMlYDnupy9F/g5yPQBhKypgwGuunsuI2kJmmEK', 'email', null, null,
        null, null, true, '{}', null, false, null, null);

INSERT INTO public."Team" (id, created_at, updated_at, name, billing)
VALUES ('cltzt2t26000208l18mgu2qcl', '2024-03-20 11:39:57.059', '2024-03-20 11:39:57.059', 'Opinodo team',
        '{"features": {"linkSurvey": {"status": "inactive", "unlimited": false}, "inAppSurvey": {"status": "inactive", "unlimited": false}, "userTargeting": {"status": "inactive", "unlimited": false}}, "stripeCustomerId": null}');

INSERT INTO public."Membership" ("teamId", "userId", accepted, role)
VALUES ('cltzt2t26000208l18mgu2qcl', 'cltzt2i4c000108l14f6ygrkr', true, 'owner');

INSERT INTO public."Product" (id, created_at, updated_at, name, "teamId", "brandColor", "recontactDays",
                              "linkSurveyBranding", "clickOutsideClose", "darkOverlay", placement,
                              "highlightBorderColor", "inAppSurveyBranding", "defaultRewardInUSD")
VALUES ('cltzt2zgs000308l12sz4bv5p', '2024-03-19 10:48:05.387', '2024-03-19 10:48:05.387', 'Opinodo Surveys',
        'cltzt2t26000208l18mgu2qcl', '#64748b', 7, true, true, false, 'bottomRight', null, true, 0);

INSERT INTO public."Environment" (id, created_at, updated_at, type, "productId", "widgetSetupCompleted")
VALUES ('cltzt37vv000408l1bajf0xqx', '2024-03-19 10:48:05.387', '2024-03-19 10:48:05.387', 'production',
        'cltzt2zgs000308l12sz4bv5p', false);
INSERT INTO public."Environment" (id, created_at, updated_at, type, "productId", "widgetSetupCompleted")
VALUES ('cltzt3hd8000508l16pdqaynt', '2024-03-19 10:48:05.387', '2024-03-19 10:48:05.387', 'development',
        'cltzt2zgs000308l12sz4bv5p', false);

INSERT INTO public."AttributeClass" (id, created_at, updated_at, name, description, type, "environmentId", archived)
VALUES ('cltzrwftr000810b4jtuee159', '2024-03-20 12:21:53.055', '2024-03-20 12:21:53.055', 'userId',
        'The internal ID of the person', 'automatic', 'cltzt37vv000408l1bajf0xqx', false);
INSERT INTO public."AttributeClass" (id, created_at, updated_at, name, description, type, "environmentId", archived)
VALUES ('cltzrwftr000910b4nw77dnck', '2024-03-20 12:21:53.055', '2024-03-20 12:21:53.055', 'email',
        'The email of the person', 'automatic', 'cltzt37vv000408l1bajf0xqx', false);
INSERT INTO public."AttributeClass" (id, created_at, updated_at, name, description, type, "environmentId", archived)
VALUES ('cltzrwfu1000e10b4pygz3tvp', '2024-03-20 12:21:53.065', '2024-03-20 12:21:53.065', 'userId',
        'The internal ID of the person', 'automatic', 'cltzt3hd8000508l16pdqaynt', false);
INSERT INTO public."AttributeClass" (id, created_at, updated_at, name, description, type, "environmentId", archived)
VALUES ('cltzrwfu1000f10b4faqcl4qd', '2024-03-20 12:21:53.065', '2024-03-20 12:21:53.065', 'email',
        'The email of the person', 'automatic', 'cltzt3hd8000508l16pdqaynt', false);

INSERT INTO public."ActionClass" (id, created_at, updated_at, name, description, type, "noCodeConfig", "environmentId")
VALUES ('cltzrwftr000510b4xh2i3exr', '2024-03-20 12:21:53.055', '2024-03-20 12:21:53.055', 'New Session',
        'Gets fired when a new session is created', 'automatic', null, 'cltzt37vv000408l1bajf0xqx');
INSERT INTO public."ActionClass" (id, created_at, updated_at, name, description, type, "noCodeConfig", "environmentId")
VALUES ('cltzrwftr000610b41lbnzs6o', '2024-03-20 12:21:53.055', '2024-03-20 12:21:53.055', 'Exit Intent (Desktop)',
        'A user on Desktop leaves the website with the cursor.', 'automatic', null, 'cltzt37vv000408l1bajf0xqx');
INSERT INTO public."ActionClass" (id, created_at, updated_at, name, description, type, "noCodeConfig", "environmentId")
VALUES ('cltzrwftr000710b4854eg3sh', '2024-03-20 12:21:53.055', '2024-03-20 12:21:53.055', '50% Scroll',
        'A user scrolled 50% of the current page', 'automatic', null, 'cltzt37vv000408l1bajf0xqx');
INSERT INTO public."ActionClass" (id, created_at, updated_at, name, description, type, "noCodeConfig", "environmentId")
VALUES ('cltzrwfu1000b10b4umrjjc84', '2024-03-20 12:21:53.065', '2024-03-20 12:21:53.065', 'New Session',
        'Gets fired when a new session is created', 'automatic', null, 'cltzt3hd8000508l16pdqaynt');
INSERT INTO public."ActionClass" (id, created_at, updated_at, name, description, type, "noCodeConfig", "environmentId")
VALUES ('cltzrwfu1000c10b479oyz6v3', '2024-03-20 12:21:53.065', '2024-03-20 12:21:53.065', 'Exit Intent (Desktop)',
        'A user on Desktop leaves the website with the cursor.', 'automatic', null, 'cltzt3hd8000508l16pdqaynt');
INSERT INTO public."ActionClass" (id, created_at, updated_at, name, description, type, "noCodeConfig", "environmentId")
VALUES ('cltzrwfu1000d10b4oglebsj7', '2024-03-20 12:21:53.065', '2024-03-20 12:21:53.065', '50% Scroll',
        'A user scrolled 50% of the current page', 'automatic', null, 'cltzt3hd8000508l16pdqaynt');
