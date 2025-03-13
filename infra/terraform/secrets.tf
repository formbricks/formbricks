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
    DATABASE_URL    = "postgres://formbricks:${random_password.postgres.result}@${module.rds-aurora.cluster_endpoint}/formbricks"
    REDIS_URL       = "rediss://:${random_password.valkey.result}@${module.elasticache.replication_group_primary_endpoint_address}:6379"
  })
}
