# Events, sequences, and deployment state machine

## Login → advisory sequence

```mermaid
sequenceDiagram
  participant Web as ReactFrontend
  participant GW as TypeScriptGateway
  participant OB as EventOutbox
  participant Adv as AIAdvisoryService
  participant MCP as MCPConnectorService

  Web->>GW: POST /api/auth/login
  GW->>OB: enqueue user.login.success
  GW-->>Web: 200 + advisory.status=preparing
  OB->>Adv: dispatch (HTTP or Kafka)
  Adv->>MCP: redacted context snapshot
  Adv->>Adv: regime + recommendations
  Adv-->>OB: advisory.generated
  Web->>GW: GET /api/advisory/latest (poll)
  GW->>Adv: /advisory/latest
  Adv-->>GW: status=ready
  GW-->>Web: recommendations
```

## Strategy deployment state machine

```mermaid
stateDiagram-v2
  [*] --> Recommendation
  Recommendation --> StrategyVersion: Convert to Algo
  StrategyVersion --> PaperTesting: Request paper test
  PaperTesting --> PaperQualified: Metrics pass
  PaperTesting --> PaperFailed: Metrics fail / RMS breach
  PaperFailed --> StrategyVersion: Edit creates new version
  PaperQualified --> Saved: User save
  Saved --> PaperDeployed: Deploy paper
  PaperDeployed --> LiveRequested: Request live + disclosure
  LiveRequested --> LiveBlocked: Missing gates
  LiveRequested --> LiveApproved: Admin RMS + env + kill-switch clear
  LiveBlocked --> LiveRequested: Remediate
  LiveApproved --> [*]: OMS preflight only (advisory never orders)
```

## Kafka topics (canonical)

| Topic | Producer | Consumer |
|-------|----------|----------|
| `user.login.success` | Gateway outbox | AI advisory |
| `advisory.generation.requested` | AI advisory | AI advisory workers |
| `advisory.generated` | AI advisory | Gateway/metrics |
| `advisory.failed` | AI advisory | Gateway/metrics |
| `strategy.paper_test.requested` | Gateway / advisory | Paper orchestrator |
| `strategy.paper_test.completed` | Paper orchestrator | Advisory / UI |

Local: Redpanda via `docker-compose.advisory.yml`. Production: managed Kafka/Redpanda (not a Fargate sidecar).
