data "aws_ssm_parameter" "slack_notification_channel" {
  name            = "/prod/formbricks/slack-webhook-url"
  with_decryption = true
}

resource "aws_cloudwatch_log_group" "cloudwatch_cis_benchmark" {
  name              = "/aws/cis-benchmark-group"
  retention_in_days = 365
}

module "notify-slack" {
  source  = "terraform-aws-modules/notify-slack/aws"
  version = "6.6.0"

  slack_channel     = "kubernetes"
  slack_username    = "formbricks-cloudwatch"
  slack_webhook_url = data.aws_ssm_parameter.slack_notification_channel.value
  sns_topic_name    = "cloudwatch-alarms"
  create_sns_topic  = true
}

module "cloudwatch_cis-alarms" {
  source         = "terraform-aws-modules/cloudwatch/aws//modules/cis-alarms"
  version        = "5.7.1"
  log_group_name = aws_cloudwatch_log_group.cloudwatch_cis_benchmark.name
  alarm_actions  = [module.notify-slack.slack_topic_arn]
}
