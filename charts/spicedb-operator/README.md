# SpiceDB Operator Helm Chart

This first-party wrapper installs the AuthZed SpiceDB Operator with namespace-scoped RBAC. It vendors the CRD and
update graph from [`authzed/spicedb-operator` v1.25.1](https://github.com/authzed/spicedb-operator/releases/tag/v1.25.1)
and pins the operator's multi-architecture image digest.

```yaml
watchNamespaces:
  - formbricks
```

Install exactly one operator release per cluster and list every namespace that may contain a `SpiceDBCluster`.
The CRD is installed from the chart's `crds/` directory. Helm does not upgrade or delete CRDs automatically; apply
the matching CRD before upgrading this chart to a newer operator version.

The vendored upstream files remain available under the Apache License 2.0 in [LICENSE](LICENSE).
