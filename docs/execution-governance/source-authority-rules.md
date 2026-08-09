# Source Authority Rules

| Source | Authority | can_execute |
|--------|-----------|-------------|
| AI_ADVISORY | RECOMMEND_ONLY | false |
| TRADINGVIEW_ALERT | SIGNAL_ONLY | false |
| DHANLAXMI_PROMPT | DRAFT_ONLY | false |
| USER_MANUAL | APPROVAL_REQUIRED | false |
| STRATEGY_ENGINE | PREAPPROVED_ALLOWED | false |
| OMS | OMS_EXECUTE_ONLY | true |

Direct execution from non-OMS sources is audited as `direct_execution_blocked`.
