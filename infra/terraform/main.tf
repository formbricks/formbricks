locals {
  project     = "formbricks"
  environment = "prod"
  name        = "${local.project}-${local.environment}"
  envs = {
    prod  = "${local.project}-prod"
    stage = "${local.project}-stage"
  }
  vpc_cidr = "10.0.0.0/16"
  azs      = slice(data.aws_availability_zones.available.names, 0, 3)
  tags = {
    Project     = local.project
    Environment = local.environment
    MangedBy    = "Terraform"
    Blueprint   = local.name
  }
  tags_map = {
    prod = {
      Project     = local.project
      Environment = "prod"
      MangedBy    = "Terraform"
      Blueprint   = "${local.project}-prod"
    }
    stage = {
      Project     = local.project
      Environment = "stage"
      MangedBy    = "Terraform"
      Blueprint   = "${local.project}-stage"
    }
  }
  domain                 = "k8s.formbricks.com"
  karpetner_helm_version = "1.3.1"
  karpenter_namespace    = "karpenter"
}

################################################################################
# Route53 Hosted Zone
################################################################################
module "route53_zones" {
  source  = "terraform-aws-modules/route53/aws//modules/zones"
  version = "4.1.0"

  zones = {
    "k8s.formbricks.com" = {
      comment = "${local.domain} (testing)"
      tags = {
        Name = local.domain
      }
    }
  }
}

################################################################################
# VPC
################################################################################
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.19.0"

  name = "${local.name}-vpc"
  cidr = local.vpc_cidr

  azs                        = local.azs
  private_subnets            = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 4, k)]      # /20
  public_subnets             = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 48)] # Public LB /24
  intra_subnets              = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 52)] # eks interface /24
  database_subnets           = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 56)] # RDS / Elastic cache /24
  database_subnet_group_name = "${local.name}-subnet-group"

  enable_nat_gateway = true
  single_nat_gateway = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
    # Tags subnets for Karpenter auto-discovery
    "karpenter.sh/discovery" = "${local.name}-eks"
  }

  tags = local.tags
}

################################################################################
# VPC Endpoints Module
################################################################################
module "vpc_vpc-endpoints" {
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "5.19.0"

  vpc_id = module.vpc.vpc_id

  endpoints = {
    "s3" = {
      service      = "s3"
      service_type = "Gateway"
      route_table_ids = flatten([
        module.vpc.intra_route_table_ids,
        module.vpc.private_route_table_ids,
        module.vpc.public_route_table_ids
      ])
      tags = { Name = "s3-vpc-endpoint" }
    }
  }

  tags = local.tags
}

################################################################################
# EKS Module
################################################################################
module "ebs_csi_driver_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.52"

  role_name_prefix = "${local.name}-ebs-csi-driver-"

  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.33.1"

  cluster_name    = "${local.name}-eks"
  cluster_version = "1.32"

  enable_cluster_creator_admin_permissions = false
  cluster_endpoint_public_access           = false
  cloudwatch_log_group_retention_in_days   = 365

  cluster_addons = {
    coredns = {
      most_recent = true

    }
    eks-pod-identity-agent = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_driver_irsa.iam_role_arn
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
  }

  cluster_security_group_additional_rules = {
    ingress_from_vpc_cidr = {
      description = "Allow all traffic from the VPC CIDR"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      type        = "ingress"
      cidr_blocks = [local.vpc_cidr]
    }
  }

  kms_key_administrators = [
    tolist(data.aws_iam_roles.github.arns)[0],
    tolist(data.aws_iam_roles.administrator.arns)[0]
  ]

  kms_key_users = [
    tolist(data.aws_iam_roles.github.arns)[0],
    tolist(data.aws_iam_roles.administrator.arns)[0]
  ]

  access_entries = {
    administrator = {
      principal_arn = tolist(data.aws_iam_roles.administrator.arns)[0]
      policy_associations = {
        Admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
    github = {
      principal_arn = tolist(data.aws_iam_roles.github.arns)[0]
      policy_associations = {
        Admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.intra_subnets

  eks_managed_node_group_defaults = {
    iam_role_additional_policies = {
      AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
    }
  }

  eks_managed_node_groups = {
    system = {
      ami_type       = "BOTTLEROCKET_ARM_64"
      instance_types = ["t4g.small"]

      min_size     = 2
      max_size     = 3
      desired_size = 2

      labels = {
        CriticalAddonsOnly        = "true"
        "karpenter.sh/controller" = "true"
      }

      taints = {
        addons = {
          key    = "CriticalAddonsOnly"
          value  = "true"
          effect = "NO_SCHEDULE"
        },
      }
    }
  }

  node_security_group_tags = merge(local.tags, {
    # NOTE - if creating multiple security groups with this module, only tag the
    # security group that Karpenter should utilize with the following tag
    # (i.e. - at most, only one security group should have this tag in your account)
    "karpenter.sh/discovery" = "${local.name}-eks"
  })

  tags = local.tags

}

module "karpenter" {
  source  = "terraform-aws-modules/eks/aws//modules/karpenter"
  version = "20.34.0"

  cluster_name          = module.eks.cluster_name
  enable_v1_permissions = true

  # Name needs to match role name passed to the EC2NodeClass
  node_iam_role_use_name_prefix   = false
  node_iam_role_name              = local.name
  create_pod_identity_association = true
  namespace                       = local.karpenter_namespace

  # Used to attach additional IAM policies to the Karpenter node IAM role
  node_iam_role_additional_policies = {
    AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  }

  tags = local.tags
}

output "karpenter_node_role" {
  value = module.karpenter.node_iam_role_name
}



resource "helm_release" "karpenter_crds" {
  name                = "karpenter-crds"
  repository          = "oci://public.ecr.aws/karpenter"
  repository_username = data.aws_ecrpublic_authorization_token.token.user_name
  repository_password = data.aws_ecrpublic_authorization_token.token.password
  chart               = "karpenter-crd"
  version             = "1.3.1"
  namespace           = local.karpenter_namespace
  values = [
    <<-EOT
    webhook:
      enabled: true
      serviceNamespace: ${local.karpenter_namespace}
    EOT
  ]
}

resource "helm_release" "karpenter" {
  name                = "karpenter"
  repository          = "oci://public.ecr.aws/karpenter"
  repository_username = data.aws_ecrpublic_authorization_token.token.user_name
  repository_password = data.aws_ecrpublic_authorization_token.token.password
  chart               = "karpenter"
  version             = "1.3.1"
  namespace           = local.karpenter_namespace
  skip_crds           = true

  values = [
    <<-EOT
    nodeSelector:
      karpenter.sh/controller: 'true'
    dnsPolicy: Default
    settings:
      clusterName: ${module.eks.cluster_name}
      clusterEndpoint: ${module.eks.cluster_endpoint}
      interruptionQueue: ${module.karpenter.queue_name}
    EOT
  ]
}

resource "kubernetes_manifest" "ec2_node_class" {
  manifest = {
    apiVersion = "karpenter.k8s.aws/v1"
    kind       = "EC2NodeClass"
    metadata = {
      name = "default"
    }
    spec = {
      amiSelectorTerms = [
        {
          alias = "bottlerocket@latest"
        }
      ]
      role = module.karpenter.node_iam_role_name
      subnetSelectorTerms = [
        {
          tags = {
            "karpenter.sh/discovery" = "${local.name}-eks"
          }
        }
      ]
      securityGroupSelectorTerms = [
        {
          tags = {
            "karpenter.sh/discovery" = "${local.name}-eks"
          }
        }
      ]
      tags = {
        "karpenter.sh/discovery" = "${local.name}-eks"
      }
    }
  }
}

resource "kubernetes_manifest" "node_pool" {
  manifest = {
    apiVersion = "karpenter.sh/v1"
    kind       = "NodePool"
    metadata = {
      name = "default"
    }
    spec = {
      template = {
        spec = {
          nodeClassRef = {
            group = "karpenter.k8s.aws"
            kind  = "EC2NodeClass"
            name  = "default"
          }
          requirements = [
            {
              key      = "karpenter.k8s.aws/instance-family"
              operator = "In"
              values   = ["c8g", "c7g", "m8g", "m7g", "r8g", "r7g"]
            },
            {
              key      = "karpenter.k8s.aws/instance-cpu"
              operator = "In"
              values   = ["2", "4", "8"]
            },
            {
              key      = "karpenter.k8s.aws/instance-hypervisor"
              operator = "In"
              values   = ["nitro"]
            }
          ]
          # Add node startup and shutdown taints to prevent traffic during lifecycle events
          startupTaints = [
            {
              key    = "karpenter.sh/startup"
              value  = "true"
              effect = "NoSchedule"
            }
          ]
          # Add kubelet configuration for better pod lifecycle management
          kubelet = {
            maxPods = 110
            clusterDNS = ["169.254.20.10"]
            # Graceful node shutdown configuration
            shutdownGracePeriod = "30s"
            shutdownGracePeriodCriticalPods = "10s"
            # Pod eviction settings
            evictionHard = {
              "memory.available"  = "100Mi"
              "nodefs.available"  = "10%"
              "imagefs.available" = "10%"
            }
            evictionSoft = {
              "memory.available"  = "500Mi"
              "nodefs.available"  = "15%"
              "imagefs.available" = "15%"
            }
            evictionSoftGracePeriod = {
              "memory.available"  = "2m"
              "nodefs.available"  = "2m"
              "imagefs.available" = "2m"
            }
          }
        }
      }
      limits = {
        cpu = 1000
      }
      disruption = {
        consolidationPolicy = "WhenEmptyOrUnderutilized"
        consolidateAfter    = "60s"  # Increased from 30s to reduce frequent disruptions
        # Expiration settings for better predictability
        expireAfter = "168h"  # 7 days
      }
      # Weight for prioritizing this NodePool
      weight = 100
    }
  }
}

module "eks_blueprints_addons" {
  source  = "aws-ia/eks-blueprints-addons/aws"
  version = "~> 1"

  cluster_name      = module.eks.cluster_name
  cluster_endpoint  = module.eks.cluster_endpoint
  cluster_version   = module.eks.cluster_version
  oidc_provider_arn = module.eks.oidc_provider_arn

  enable_metrics_server = true
  metrics_server = {
    chart_version = "3.12.2"
  }

  enable_aws_load_balancer_controller = true
  aws_load_balancer_controller = {
    chart_version = "1.10.0"
    values = [
      <<-EOT
      vpcId: ${module.vpc.vpc_id}
      EOT
    ]
  }
  enable_external_dns            = true
  external_dns_route53_zone_arns = [module.route53_zones.route53_zone_zone_arn[local.domain]]
  external_dns = {
    chart_version = "1.15.2"
  }
  enable_cert_manager = false
  cert_manager = {
    chart_version = "v1.17.1"
    values = [
      <<-EOT
      installCRDs: false
      crds:
        enabled: true
        keep: true
      EOT
    ]
  }

  enable_external_secrets = true
  external_secrets = {
    chart_version = "0.14.3"
  }

  tags = local.tags
}

### Formbricks App

moved {
  from = module.formbricks_s3_bucket
  to   = module.formbricks_s3_bucket["prod"]
}

module "formbricks_s3_bucket" {
  for_each = local.envs
  source   = "terraform-aws-modules/s3-bucket/aws"
  version  = "4.6.0"

  bucket                   = each.key == "prod" ? "formbricks-cloud-eks" : "formbricks-cloud-eks-${each.key}"
  force_destroy            = true
  control_object_ownership = true
  object_ownership         = "BucketOwnerPreferred"
  versioning = {
    enabled = true
  }
  cors_rule = [
    {
      allowed_methods = ["POST"]
      allowed_origins = ["https://*"]
      allowed_headers = ["*"]
      expose_headers  = []
    }
  ]
}

moved {
  from = module.formbricks_app_iam_policy
  to   = module.formbricks_app_iam_policy["prod"]
}

module "formbricks_app_iam_policy" {
  for_each = local.envs
  source   = "terraform-aws-modules/iam/aws//modules/iam-policy"
  version  = "5.53.0"

  name_prefix = each.key == "prod" ? "formbricks-" : "formbricks-${each.key}-"
  path        = "/"
  description = "Policy for fombricks app"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*",
        ]
        Resource = [
          module.formbricks_s3_bucket[each.key].s3_bucket_arn,
          "${module.formbricks_s3_bucket[each.key].s3_bucket_arn}/*"
        ]
      }
    ]
  })
}

moved {
  from = module.formbricks_app_iam_role
  to   = module.formbricks_app_iam_role["prod"]
}

module "formbricks_app_iam_role" {
  for_each = local.envs
  source   = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version  = "5.53.0"

  role_name_prefix = each.key == "prod" ? "formbricks-" : "formbricks-${each.key}-"

  role_policy_arns = {
    "formbricks" = module.formbricks_app_iam_policy[each.key].arn
  }
  assume_role_condition_test = "StringLike"

  oidc_providers = {
    eks = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = each.key == "prod" ? ["formbricks:*"] : ["formbricks-${each.key}:*"]
    }
  }
}
