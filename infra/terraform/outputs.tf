output "rds" {
  description = "RDS created for cluster"
  value       = module.rds-aurora
  sensitive   = true
}

output "rds_secret_staging_arn" {
  description = "RDS secret created for cluster"
  value       = aws_secretsmanager_secret.rds_credentials["stage"].arn
}
