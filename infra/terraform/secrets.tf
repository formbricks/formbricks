# Create the first AWS Secrets Manager secret for environment variables
resource "aws_secretsmanager_secret" "formbricks_app_secrets" {
  name = "prod/formbricks/secrets"
}

resource "aws_secretsmanager_secret" "formbricks_app_secrets_temp" {
  name = "prod/formbricks/secrets_temp"
}

resource "aws_secretsmanager_secret_version" "formbricks_app_secrets" {
  secret_id = aws_secretsmanager_secret.formbricks_app_secrets.id
  secret_string = jsonencode({
    #    DATABASE_URL = "postgres://formbricks:${random_password.postgres.result}@${module.rds-aurora.cluster_endpoint}/formbricks"
    REDIS_URL = "rediss://:${random_password.valkey.result}@${module.valkey.replication_group_primary_endpoint_address}:6379"
    #    REDIS_URL = "rediss://formbricks:${random_password.valkey.result}@${module.valkey_serverless.serverless_cache_endpoint[0].address}:6379"
  })
}

resource "aws_secretsmanager_secret_version" "formbricks_app_secrets_temp" {
  secret_id = aws_secretsmanager_secret.formbricks_app_secrets_temp.id
  secret_string = jsonencode({
    DATABASE_URL = "postgres://formbricks:${random_password.postgres.result}@${module.rds-aurora.cluster_endpoint}/formbricks"
    #    REDIS_URL    = "rediss://formbricks:${random_password.valkey.result}@${module.valkey_serverless.serverless_cache_endpoint[0].address}:6379"
  })
}
