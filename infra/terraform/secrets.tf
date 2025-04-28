# Create the first AWS Secrets Manager secret for environment variables
moved {
  from = aws_secretsmanager_secret.formbricks_app_secrets
  to   = aws_secretsmanager_secret.formbricks_app_secrets["prod"]
}

resource "aws_secretsmanager_secret" "formbricks_app_secrets" {
  for_each = local.envs
  name     = "${each.key}/formbricks/secrets"
}

moved {
  from = aws_secretsmanager_secret_version.formbricks_app_secrets
  to   = aws_secretsmanager_secret_version.formbricks_app_secrets["prod"]
}

resource "aws_secretsmanager_secret_version" "formbricks_app_secrets" {
  for_each  = local.envs
  secret_id = aws_secretsmanager_secret.formbricks_app_secrets[each.key].id
  secret_string = jsonencode({
    REDIS_URL = "rediss://:${random_password.valkey[each.key].result}@${module.valkey[each.key].replication_group_primary_endpoint_address}:6379"
  })
}

