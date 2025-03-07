################################################################################
# Install ArgoCD
################################################################################
resource "helm_release" "argocd" {
  count = var.create && var.install ? 1 : 0

  # https://github.com/argoproj/argo-helm/blob/main/charts/argo-cd/Chart.yaml
  # (there is no offical helm chart for argocd)
  name             = try(var.argocd.name, "argo-cd")
  description      = try(var.argocd.description, "A Helm chart to install the ArgoCD")
  namespace        = try(var.argocd.namespace, "argocd")
  create_namespace = try(var.argocd.create_namespace, true)
  chart            = try(var.argocd.chart, "argo-cd")
  version          = try(var.argocd.chart_version, "6.6.0")
  repository       = try(var.argocd.repository, "https://argoproj.github.io/argo-helm")
  values           = try(var.argocd.values, [])

  timeout                    = try(var.argocd.timeout, null)
  repository_key_file        = try(var.argocd.repository_key_file, null)
  repository_cert_file       = try(var.argocd.repository_cert_file, null)
  repository_ca_file         = try(var.argocd.repository_ca_file, null)
  repository_username        = try(var.argocd.repository_username, null)
  repository_password        = try(var.argocd.repository_password, null)
  devel                      = try(var.argocd.devel, null)
  verify                     = try(var.argocd.verify, null)
  keyring                    = try(var.argocd.keyring, null)
  disable_webhooks           = try(var.argocd.disable_webhooks, null)
  reuse_values               = try(var.argocd.reuse_values, null)
  reset_values               = try(var.argocd.reset_values, null)
  force_update               = try(var.argocd.force_update, null)
  recreate_pods              = try(var.argocd.recreate_pods, null)
  cleanup_on_fail            = try(var.argocd.cleanup_on_fail, null)
  max_history                = try(var.argocd.max_history, null)
  atomic                     = try(var.argocd.atomic, null)
  skip_crds                  = try(var.argocd.skip_crds, null)
  render_subchart_notes      = try(var.argocd.render_subchart_notes, null)
  disable_openapi_validation = try(var.argocd.disable_openapi_validation, null)
  wait                       = try(var.argocd.wait, true)
  wait_for_jobs              = try(var.argocd.wait_for_jobs, null)
  dependency_update          = try(var.argocd.dependency_update, null)
  replace                    = try(var.argocd.replace, null)
  lint                       = try(var.argocd.lint, null)

  dynamic "postrender" {
    for_each = length(try(var.argocd.postrender, {})) > 0 ? [var.argocd.postrender] : []

    content {
      binary_path = postrender.value.binary_path
      args        = try(postrender.value.args, null)
    }
  }

  dynamic "set" {
    for_each = try(var.argocd.set, [])

    content {
      name  = set.value.name
      value = set.value.value
      type  = try(set.value.type, null)
    }
  }

  dynamic "set_sensitive" {
    for_each = try(var.argocd.set_sensitive, [])

    content {
      name  = set_sensitive.value.name
      value = set_sensitive.value.value
      type  = try(set_sensitive.value.type, null)
    }
  }

}


################################################################################
# ArgoCD Cluster
################################################################################
locals {
  cluster_name = try(var.cluster.cluster_name, "in-cluster")
  environment  = try(var.cluster.environment, "dev")
  argocd_labels = merge({
    cluster_name                     = local.cluster_name
    environment                      = local.environment
    enable_argocd                    = true
    "argocd.argoproj.io/secret-type" = "cluster"
    },
    try(var.cluster.addons, {})
  )
  argocd_annotations = merge(
    {
      cluster_name = local.cluster_name
      environment  = local.environment
    },
    try(var.cluster.metadata, {})
  )
}

locals {
  config = <<-EOT
    {
      "tlsClientConfig": {
        "insecure": false
      }
    }
  EOT
  argocd = {
    apiVersion = "v1"
    kind       = "Secret"
    metadata = {
      name        = try(var.cluster.secret_name, local.cluster_name)
      namespace   = try(var.cluster.secret_namespace, "argocd")
      annotations = local.argocd_annotations
      labels      = local.argocd_labels
    }
    stringData = {
      name   = local.cluster_name
      server = try(var.cluster.server, "https://kubernetes.default.svc")
      config = try(var.cluster.config, local.config)
    }
  }
}

resource "kubernetes_secret_v1" "cluster" {
  count = var.create && (var.cluster != null) ? 1 : 0

  metadata {
    name        = local.argocd.metadata.name
    namespace   = local.argocd.metadata.namespace
    annotations = local.argocd.metadata.annotations
    labels      = local.argocd.metadata.labels
  }
  data = local.argocd.stringData

  depends_on = [helm_release.argocd]
}


################################################################################
# Create App of Apps
################################################################################
resource "helm_release" "eks_addons" {
  for_each = var.create ? var.apps : { eks-addons = null, workloads = null }

  name      = each.key
  namespace = try(var.argocd.namespace, "argocd")
  chart     = "${path.module}/charts/resources"
  version   = "1.0.0"

  values = [
    yamlencode(merge(
      {
        source = {
          repoUrl        = each.value.repo_url,
          targetRevision = each.value.target_revision,
          path           = each.value.path,
          helm = {
            values     = try(each.value.values, ""),
            valueFiles = try(each.value.value_files, "")
          }
        }
        argocd_application_name = each.key,
      },
    ))
  ]

  depends_on = [resource.kubernetes_secret_v1.cluster, helm_release.argocd]
}
