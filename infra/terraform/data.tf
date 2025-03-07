data "aws_region" "selected" {}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {}
data "aws_partition" "current" {}

data "aws_eks_cluster_auth" "eks" {
  name = module.eks.cluster_name
}
