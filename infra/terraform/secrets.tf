# Generate random secrets for formbricks
resource "random_password" "nextauth_secret" {
  length  = 32
  special = false
}

resource "random_password" "encryption_key" {
  length  = 32
  special = false
}

resource "random_password" "cron_secret" {
  length  = 32
  special = false
}

# Generate random passwords for PostgreSQL users
resource "random_password" "postgres_admin_password" {
  length  = 16
  special = false
}

resource "random_password" "postgres_user_password" {
  length  = 16
  special = false
}

resource "random_password" "redis_password" {
  length  = 16
  special = false
}

# Create the first AWS Secrets Manager secret for environment variables
resource "aws_secretsmanager_secret" "formbricks_app_secrets" {
  name = "prod/formbricks/secrets"
}

resource "aws_secretsmanager_secret_version" "formbricks_app_secrets" {
  secret_id = aws_secretsmanager_secret.formbricks_app_secrets.id
  secret_string = jsonencode({
    NEXTAUTH_SECRET = random_password.nextauth_secret.result
    ENCRYPTION_KEY  = random_password.encryption_key.result
    CRON_SECRET     = random_password.cron_secret.result
    POSTGRES_ADMIN_PASSWORD = random_password.postgres_admin_password.result
    POSTGRES_USER_PASSWORD  = random_password.postgres_user_password.result
    REDIS_PASSWORD = random_password.redis_password.result
    DATABASE_URL = "postgres://formbricks:${random_password.postgres_user_password.result}@formbricks-postgresql/formbricks"
    REDIS_URL = "redis://:${random_password.redis_password.result}@formbricks-redis-master:6379"
  })
}
