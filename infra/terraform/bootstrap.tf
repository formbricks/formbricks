################################################################################
# GitOps Bridge: Bootstrap
################################################################################
locals {
  addons = {
    enable_cert_manager                 = true
    enable_external_dns                 = true
    enable_istio                        = false
    enable_istio_ingress                = false
    enable_external_secrets             = true
    enable_metrics_server               = false
    enable_keda                         = false
    enable_aws_load_balancer_controller = true
    enable_aws_ebs_csi_resources        = false
    enable_velero                       = false
    enable_observability                = false
    enable_karpenter                    = true
  }

  addons_default_versions = {
    cert_manager                 = "v1.17.1"
    external_dns                 = "1.15.2"
    karpenter                    = "1.3.0"
    external_secrets             = "0.14.3"
    aws_load_balancer_controller = "1.10.0"
    #     keda                         = "2.16.0"
    #     istio                        = "1.23.3"
  }

  addons_metadata = merge(
    # module.addons.gitops_metadata
    {
      aws_cluster_name = module.eks.cluster_name
      aws_region       = data.aws_region.selected.name
      aws_account_id   = data.aws_caller_identity.current.account_id
      aws_vpc_id       = module.vpc.vpc_id
    }
  )

  argocd_apps = {
    eks-addons = {
      project              = "default"
      repo_url             = var.addons_repo_url
      target_revision      = var.addons_target_revision
      addons_repo_revision = var.addons_target_revision
      path                 = var.addons_repo_path
      values = merge({
        addons_repo_revision = var.addons_target_revision
        certManager = {
          enabled      = local.addons.enable_cert_manager
          iamRoleArn   = try(module.addons.gitops_metadata.cert_manager_iam_role_arn, "")
          values       = try(yamldecode(join("\n", var.cert_manager_helm_config.values)), {})
          chartVersion = try(var.cert_manager_helm_config.chart_version, local.addons_default_versions.cert_manager)
        }
        externalDNS = {
          enabled      = local.addons.enable_external_dns
          iamRoleArn   = try(module.addons.gitops_metadata.external_dns_iam_role_arn, "")
          values       = try(yamldecode(join("\n", var.external_dns_helm_config.values)), {})
          chartVersion = try(var.external_dns_helm_config.chart_version, local.addons_default_versions.external_dns)
        }
        externalSecrets = {
          enabled      = local.addons.enable_external_secrets
          iamRoleArn   = try(module.addons.gitops_metadata.external_secrets_iam_role_arn, "")
          values       = try(yamldecode(join("\n", var.external_secrets_helm_config.values)), {})
          chartVersion = try(var.external_secrets_helm_config.chart_version, local.addons_default_versions.external_secrets)
        }
        karpenter = {
          enabled                = true
          iamRoleArn             = try(module.addons.gitops_metadata.karpenter_iam_role_arn, "")
          values                 = try(yamldecode(join("\n", var.karpenter_helm_config.values)), {})
          chartVersion           = try(var.karpenter_helm_config.chart_version, local.addons_default_versions.karpenter)
          enableCrdWebhookConfig = true
          clusterName            = module.eks.cluster_name
          clusterEndpoint        = module.eks.cluster_endpoint
          interruptionQueue      = try(module.addons.gitops_metadata.karpenter_interruption_queue, null)
          nodeIamRoleName        = try(module.addons.gitops_metadata.karpenter_node_iam_role_arn, null)
        }
        loadBalancerController = {
          enabled      = local.addons.enable_aws_load_balancer_controller
          iamRoleArn   = try(module.addons.gitops_metadata.aws_load_balancer_controller_iam_role_arn, "")
          values       = try(yamldecode(join("\n", var.aws_load_balancer_controller_helm_config.values)), {})
          clusterName  = module.eks.cluster_name
          chartVersion = try(var.aws_load_balancer_controller_helm_config.chart_version, local.addons_default_versions.aws_load_balancer_controller)
          vpcId        = module.vpc.vpc_id
        }
      })
    }
  }
}

variable "enable_gitops_bridge_bootstrap" {
  default = true
}

module "gitops_bridge_bootstrap" {
  count  = var.enable_gitops_bridge_bootstrap ? 1 : 0
  source = "../modules/argocd-gitops-bridge"

  cluster = {
    metadata = local.addons_metadata
  }
  argocd = {
    chart_version = "7.8.7"
    values = [
      <<-EOT
    global:
      nodeSelector:
        CriticalAddonsOnly: "true"
      tolerations:
        - key: "CriticalAddonsOnly"
          operator: "Exists"
          effect: "NoSchedule"
    configs:
      params:
        server.insecure: true
    EOT
    ]
  }
  apps = local.argocd_apps
}

################################################################################
# EKS Blueprints Addons
################################################################################
module "addons" {
  source                             = "../modules/addons"
  oidc_provider_arn                  = module.eks.oidc_provider_arn
  aws_region                         = data.aws_region.selected.name
  aws_account_id                     = data.aws_caller_identity.current.account_id
  aws_partition                      = data.aws_partition.current.partition
  cluster_name                       = module.eks.cluster_name
  cluster_endpoint                   = module.eks.cluster_endpoint
  cluster_certificate_authority_data = module.eks.cluster_certificate_authority_data
  cluster_token                      = data.aws_eks_cluster_auth.eks.token
  cluster_version                    = module.eks.cluster_version
  vpc_id                             = module.vpc.vpc_id
  node_security_group_id             = module.eks.node_security_group_id
  cluster_security_group_id          = module.eks.cluster_security_group_id

  # Using GitOps Bridge
  create_kubernetes_resources = var.enable_gitops_bridge_bootstrap ? false : true

  # Cert Manager
  enable_cert_manager = local.addons.enable_cert_manager

  # External DNS
  enable_external_dns = local.addons.enable_external_dns

  # Karpenter
  enable_karpenter = local.addons.enable_karpenter

  # External Secrets
  enable_external_secrets = local.addons.enable_external_secrets

  # Metrics Server
  enable_metrics_server = local.addons.enable_metrics_server

  # Keda
  enable_keda = local.addons.enable_keda

  # Load Balancer Controller
  enable_aws_load_balancer_controller = local.addons.enable_aws_load_balancer_controller

  # Velero
  enable_velero = local.addons.enable_velero

  # AWS EBS CSI Resources
  enable_aws_ebs_csi_resources = local.addons.enable_aws_ebs_csi_resources
}
