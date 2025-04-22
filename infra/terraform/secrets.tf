# Create the first AWS Secrets Manager secret for environment variables
resource "aws_secretsmanager_secret" "formbricks_app_secrets" {
  name = "prod/formbricks/secrets"
}

resource "aws_secretsmanager_secret_version" "formbricks_app_secrets" {
  secret_id = aws_secretsmanager_secret.formbricks_app_secrets.id
  secret_string = jsonencode({
    REDIS_URL = "rediss://:${random_password.valkey.result}@${module.valkey["prod"].replication_group_primary_endpoint_address}:6379"
  })
}

