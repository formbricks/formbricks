#!/bin/sh
# Shared RustFS bootstrap script.
# Used directly by docker-compose.dev.yml for local development and used as the
# source template for the generated rustfs-init.sh in docker/formbricks.sh for
# one-click/self-hosted installs. packages/storage/src/rustfs-init-bootstrap.test.ts
# also validates that the generated script stays in sync with this file.
set -e
echo '⏳ Waiting for RustFS to be ready...'
attempts=0
max_attempts=30
until mc alias set rustfs http://rustfs:9000 "$RUSTFS_ADMIN_USER" "$RUSTFS_ADMIN_PASSWORD" >/dev/null 2>&1 \
  && mc ls rustfs >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ $attempts -ge $max_attempts ]; then
    printf '❌ Failed to connect to RustFS after %s attempts\n' $max_attempts
    exit 1
  fi
  printf '...still waiting attempt %s/%s\n' $attempts $max_attempts
  sleep 2
done
echo '🔗 RustFS reachable; alias configured.'

echo '🪣 Creating bucket (idempotent)...'
mc mb rustfs/$RUSTFS_BUCKET_NAME --ignore-existing

echo '📄 Creating JSON policy file...'
cat > /tmp/formbricks-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::$RUSTFS_BUCKET_NAME/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::$RUSTFS_BUCKET_NAME"]
    }
  ]
}
EOF

echo '🔒 Creating policy (idempotent)...'
if ! mc admin policy info rustfs "$RUSTFS_POLICY_NAME" >/dev/null 2>&1; then
  mc admin policy create rustfs "$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json || \
    mc admin policy add rustfs "$RUSTFS_POLICY_NAME" /tmp/formbricks-policy.json
  echo 'Policy created successfully.'
else
  echo 'Policy already exists, skipping creation.'
fi

echo '👤 Creating service user (idempotent)...'
if ! mc admin user info rustfs "$RUSTFS_SERVICE_USER" >/dev/null 2>&1; then
  mc admin user add rustfs "$RUSTFS_SERVICE_USER" "$RUSTFS_SERVICE_PASSWORD"
  echo 'User created successfully.'
else
  echo 'User already exists, skipping creation.'
fi

echo '🔗 Attaching policy to user (idempotent)...'
mc admin policy attach rustfs "$RUSTFS_POLICY_NAME" --user "$RUSTFS_SERVICE_USER"

echo '✅ RustFS setup complete!'
