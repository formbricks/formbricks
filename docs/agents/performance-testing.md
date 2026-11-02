# Performance Testing & SigNoz MCP

Read before running an application load test or reading SigNoz telemetry for one.

- Run application load tests only as human-supervised experiments against the isolated Artemis
  workspace. Never point the suite at production, a customer workspace, or a survey with live
  integrations. The maintained k6 suite and cleanup runbook live in the private
  `formbricks/performance-test-q2-2025` repository under `scripts/formbricks-core/`.
- Configure the private SigNoz MCP endpoint from the GitOps `signoz/mcp/README.md` runbook. Keep the
  Codex `enabled_tools` list limited to telemetry reads; do not enable dashboard, alert, view, or
  notification-channel mutations for performance investigations.
- Correlate every analysis to the k6 run ID and its exact UTC start/end window. For Artemis, begin with
  `deployment.environment=artemis` and `service.namespace=formbricks-artemis`, then confirm the live
  service and operation names instead of assuming them.
- Use aggregate metrics to find a pattern, then inspect representative p95/p99 or error traces and their
  child spans before calling something a code-level bottleneck. Record the query/filter and trace ID or
  evidence link, and label unsupported explanations as hypotheses.
- A run is not complete until its synthetic survey/response data cleanup reports success and the final
  pod state, restarts, CPU/memory samples, k6 summary, and SigNoz findings are attached to the ticket.
  Missing telemetry is an open gap, never a zero value.
