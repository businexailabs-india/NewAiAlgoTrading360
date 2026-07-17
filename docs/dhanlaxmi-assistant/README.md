# DhanLaxmi Assistant

## Event sequence

```mermaid
sequenceDiagram
  participant U as User
  participant W as Widget
  participant G as Gateway
  participant D as DhanLaxmi
  participant A as Approval
  participant R as RMS
  participant O as OMS

  U->>W: Voice or text
  W->>G: POST /api/dhanlaxmi/chat
  G->>D: signed internal chat
  D-->>G: localized response + cards
  G-->>W: advisory / draft / approval preview
  U->>W: Approve
  W->>G: POST /api/approvals/{id}/approve
  G->>A: user confirmation
  A->>R: RMS check
  alt RMS rejects
    R-->>A: reject
    A-->>W: OMS blocked
  else RMS approves and live enabled
    R-->>A: approve
    A->>O: create order
    O-->>W: status
  end
```

## OpenAPI (gateway)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/dhanlaxmi/chat` | Text chat |
| POST | `/api/dhanlaxmi/intent` | Intent + parse |
| POST | `/api/dhanlaxmi/strategy-draft` | Strategy builder mode |
| POST | `/api/dhanlaxmi/advisory` | Advisory popup mode |
| POST | `/api/dhanlaxmi/paper-test` | Paper test draft |
| GET | `/api/dhanlaxmi/conversation/{id}` | History |
| POST | `/api/voice/command` | Voice → STT → chat → TTS |
| POST | `/api/approvals/trade` | Create approval |
| POST | `/api/approvals/{id}/approve` | Approve with gates |
| POST | `/api/approvals/{id}/reject` | Reject |

Kafka topic names (for production wiring): `dhanlaxmi.command.received`, `dhanlaxmi.intent.detected`, `dhanlaxmi.advisory.generated`, `dhanlaxmi.strategy.draft.created`, `dhanlaxmi.paper_test.requested`, `dhanlaxmi.trade_approval.requested|approved|rejected`, `dhanlaxmi.response.generated`, `compliance.audit.created`.
