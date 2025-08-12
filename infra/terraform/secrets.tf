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
    REDIS_URL = "rediss://${each.value}:${random_password.valkey[each.key].result}@${module.valkey_serverless[each.key].serverless_cache_endpoint[0].address}:6379"
  })
}

resource "aws_secretsmanager_secret" "rds_credentials" {
  for_each = local.envs
  name     = "${each.key}/formbricks/terraform/rds/credentials"
}

resource "aws_secretsmanager_secret_version" "rds_credentials" {
  for_each      = local.envs
  secret_id     = aws_secretsmanager_secret.rds_credentials[each.key].id
  secret_string = <<EOF
{
  "username": "${module.rds-aurora[each.key].cluster_master_username}",
  "password": "${random_password.postgres[each.key].result}",
  "engine": data.aws_rds_engine_version.postgresql.engine,
  "host": "${module.rds-aurora[each.key].cluster_endpoint}",
  "port": ${module.rds-aurora[each.key].cluster_port},
  "dbClusterIdentifier": "${module.rds-aurora[each.key].cluster_id}"
}
EOF
}

