# RMS / OMS Gatekeeper

RMS checks kill switch, live flags, stop-loss, index spot, options selling policy, preapproval bounds.

OMS gatekeeper requires `caller_service=OMS`, `rms_decision_id`, idempotency; live also needs approval/preapproval.

Broker adapter rejects non-OMS callers (`broker_direct_order_blocked`).
