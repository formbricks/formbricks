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

locals {
  alb_id = "app/k8s-formbricks-21ab9ecd60/342ed65d128ce4cb"
  alarms = {
    ALB_HTTPCode_Target_5XX_Count = {
      alarm_description   = "Average API 5XX target group error code count is too high"
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 5
      period              = 600
      unit                = "Count"
      namespace           = "AWS/ApplicationELB"
      metric_name         = "HTTPCode_Target_5XX_Count"
      statistic           = "Sum"
      dimensions = {
        LoadBalancer = local.alb_id
      }
    }
    ALB_HTTPCode_ELB_5XX_Count = {
      alarm_description   = "Average API 5XX load balancer error code count is too high"
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 5
      period              = 600
      unit                = "Count"
      namespace           = "AWS/ApplicationELB"
      metric_name         = "HTTPCode_ELB_5XX_Count"
      statistic           = "Sum"
      dimensions = {
        LoadBalancer = local.alb_id
      }
    }
    ALB_TargetResponseTime = {
      alarm_description   = format("Average API response time is greater than %s", 5)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 5
      period              = 60
      unit                = "Seconds"
      namespace           = "AWS/ApplicationELB"
      metric_name         = "TargetResponseTime"
      statistic           = "Average"
      dimensions = {
        LoadBalancer = local.alb_id
      }
    }
    ALB_UnHealthyHostCount = {
      alarm_description   = format("Unhealthy host count is greater than %s", 2)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 2
      period              = 60
      unit                = "Count"
      namespace           = "AWS/ApplicationELB"
      metric_name         = "UnHealthyHostCount"
      statistic           = "Minimum"
      dimensions = {
        LoadBalancer = local.alb_id
      }
    }
    RDS_CPUUtilization = {
      alarm_description   = format("Average RDS CPU utilization is greater than %s", 80)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 80
      period              = 60
      unit                = "Percent"
      namespace           = "AWS/RDS"
      metric_name         = "CPUUtilization"
      statistic           = "Average"
      dimensions = {
        DBInstanceIdentifier = module.rds-aurora.cluster_instances["one"].id
      }
    }
    RDS_FreeStorageSpace = {
      alarm_description   = format("Average RDS free storage space is less than %s", 5)
      comparison_operator = "LessThanThreshold"
      evaluation_periods  = 5
      threshold           = 5
      period              = 60
      unit                = "Gigabytes"
      namespace           = "AWS/RDS"
      metric_name         = "FreeStorageSpace"
      statistic           = "Average"
      dimensions = {
        DBInstanceIdentifier = module.rds-aurora.cluster_instances["one"].id
      }
    }
    RDS_FreeableMemory = {
      alarm_description   = format("Average RDS freeable memory is less than %s", 100)
      comparison_operator = "LessThanThreshold"
      evaluation_periods  = 5
      threshold           = 100
      period              = 60
      unit                = "Megabytes"
      namespace           = "AWS/RDS"
      metric_name         = "FreeableMemory"
      statistic           = "Average"
      dimensions = {
        DBInstanceIdentifier = module.rds-aurora.cluster_instances["one"].id
      }
    }
    RDS_DiskQueueDepth = {
      alarm_description   = format("Average RDS disk queue depth is greater than %s", 1)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 1
      period              = 60
      unit                = "Count"
      namespace           = "AWS/RDS"
      metric_name         = "DiskQueueDepth"
      statistic           = "Average"
      dimensions = {
        DBInstanceIdentifier = module.rds-aurora.cluster_instances["one"].id
      }
    }
    RDS_ReadIOPS = {
      alarm_description   = format("Average RDS read IOPS is greater than %s", 1000)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 1000
      period              = 60
      unit                = "Count/Second"
      namespace           = "AWS/RDS"
      metric_name         = "ReadIOPS"
      statistic           = "Average"
      dimensions = {
        DBInstanceIdentifier = module.rds-aurora.cluster_instances["one"].id
      }
    }
    RDS_WriteIOPS = {
      alarm_description   = format("Average RDS write IOPS is greater than %s", 1000)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 1000
      period              = 60
      unit                = "Count/Second"
      namespace           = "AWS/RDS"
      metric_name         = "WriteIOPS"
      statistic           = "Average"
      dimensions = {
        DBInstanceIdentifier = module.rds-aurora.cluster_instances["one"].id
      }
    }
    SQS_ApproximateAgeOfOldestMessage = {
      alarm_description   = format("Average SQS approximate age of oldest message is greater than %s", 300)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 300
      period              = 60
      unit                = "Seconds"
      namespace           = "AWS/SQS"
      metric_name         = "ApproximateAgeOfOldestMessage"
      statistic           = "Maximum"
      dimensions = {
        QueueName = module.karpenter.queue_name
      }
    }
    DynamoDB_ConsumedReadCapacityUnits = {
      alarm_description   = format("Average DynamoDB consumed read capacity units is greater than %s", 90)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 90
      period              = 60
      unit                = "Count"
      namespace           = "AWS/DynamoDB"
      metric_name         = "ConsumedReadCapacityUnits"
      statistic           = "Average"
      dimensions = {
        TableName = "terraform-lock"
      }
    }
    DynamoDB_ConsumedWriteCapacityUnits = {
      alarm_description   = format("Average DynamoDB consumed write capacity units is greater than %s", 90)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 90
      period              = 60
      unit                = "Count"
      namespace           = "AWS/DynamoDB"
      metric_name         = "ConsumedWriteCapacityUnits"
      statistic           = "Average"
      dimensions = {
        TableName = "terraform-lock"
      }
    }
    Lambda_Errors = {
      alarm_description   = format("Average Lambda errors is greater than %s", 1)
      comparison_operator = "GreaterThanThreshold"
      evaluation_periods  = 5
      threshold           = 1
      period              = 60
      unit                = "Count"
      namespace           = "AWS/Lambda"
      metric_name         = "Errors"
      statistic           = "Sum"
      dimensions = {
        FunctionName = module.notify-slack.notify_slack_lambda_function_name
      }
    }
  }
}

module "metric_alarm" {
  source  = "terraform-aws-modules/cloudwatch/aws//modules/metric-alarm"
  version = "5.7.1"

  for_each                  = local.alarms
  alarm_name                = each.key
  alarm_description         = each.value.alarm_description
  comparison_operator       = each.value.comparison_operator
  evaluation_periods        = each.value.evaluation_periods
  threshold                 = each.value.threshold
  period                    = each.value.period
  unit                      = each.value.unit
  insufficient_data_actions = []

  namespace   = each.value.namespace
  metric_name = each.value.metric_name
  statistic   = each.value.statistic

  dimensions = each.value.dimensions

  alarm_actions = [module.notify-slack.slack_topic_arn]
}
