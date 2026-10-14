-- Disposable image-test database only. An existing user makes / choose login instead of setup.
-- No password or account record is created; this fixture cannot authenticate.
INSERT INTO "User" (id, name, email, updated_at)
VALUES ('image-smoke-user', 'Image smoke fixture', 'image-smoke@example.invalid', NOW());
