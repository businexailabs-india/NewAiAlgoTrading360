# ExecutionGovernance360 Overview

**Core principle:** AI does not execute. TradingView does not execute. DhanLaxmi does not execute. Only **OMS** executes after user approval (or bounded preapproval), **RMS** approval, and policy validation.

Flow: Preference → Recommendation/Signal → Algo Selection → Suitability → Paper-test → Approval → RMS → OMS → Broker/Paper → Portfolio → Audit

Implementation (TradeOS360): Express `ExecutionGovernanceService` + Prisma tables. FastAPI service folders are pointers.
