-- Verifies invariants of backend/prisma/migrations/20261114100000_algo_trading_bots on a scratch PostgreSQL.
-- Run via scripts/verify_pg_migration.ps1 (creates a throwaway container). Any failed expectation aborts.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.expect_fail(stmt text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'EXPECTED FAILURE DID NOT OCCUR: %', label USING ERRCODE = 'XX999';
EXCEPTION
  WHEN SQLSTATE 'XX999' THEN RAISE;
  WHEN OTHERS THEN RAISE NOTICE 'ok (rejected as expected): % [%]', label, SQLERRM;
END $$;

-- fixtures as superuser (superusers bypass RLS, so seed here)
INSERT INTO public.tenants(id) VALUES ('t1'), ('t2') ON CONFLICT DO NOTHING;
INSERT INTO algo.trading_accounts(tenant_id, account_id, kind) VALUES
  ('t1','a1','PAPER'), ('t1','a2','LIVE'), ('t2','b1','PAPER') ON CONFLICT DO NOTHING;
INSERT INTO algo.bots(tenant_id, account_id, bot_id, execution_mode, live_enabled) VALUES
  ('t1','a2','BOT_01','LIVE',true), ('t1','a2','BOT_02','PAPER',false), ('t1','a1','BOT_01','PAPER',false),
  ('t2','b1','BOT_01','PAPER',false) ON CONFLICT DO NOTHING;

-- 1. single live bot per account (DB-enforced) and live flag implies LIVE mode
SELECT pg_temp.expect_fail($$UPDATE algo.bots SET execution_mode='LIVE', live_enabled=true WHERE tenant_id='t1' AND account_id='a2' AND bot_id='BOT_02'$$, 'second live bot on same account');
SELECT pg_temp.expect_fail($$UPDATE algo.bots SET live_enabled=true WHERE tenant_id='t1' AND account_id='a1' AND bot_id='BOT_01'$$, 'live_enabled while execution_mode=PAPER');

-- 2. referential integrity
SELECT pg_temp.expect_fail($$INSERT INTO algo.bots(tenant_id,account_id,bot_id) VALUES ('t1','nope','BOT_09')$$, 'bot with unknown account');
SELECT pg_temp.expect_fail($$INSERT INTO algo.trading_accounts(tenant_id,account_id,kind) VALUES ('ghost','x','PAPER')$$, 'account for unknown tenant');

-- 3. order constraints
INSERT INTO algo.order_intents(intent_id,tenant_id,account_id,mode,bot_id,symbol,side,role,quantity,order_type,correlation_id,dedupe_key,state,created_at,updated_at)
VALUES ('11111111-1111-1111-1111-111111111111','t1','a1','PAPER','BOT_01','TESTCO','BUY','ENTRY',10,'MARKET','TXE-abc','t1|a1|PAPER|k1','CREATED',now(),now());
SELECT pg_temp.expect_fail($$INSERT INTO algo.order_intents(intent_id,tenant_id,account_id,mode,symbol,side,role,quantity,order_type,correlation_id,dedupe_key,state,created_at,updated_at) VALUES ('22222222-2222-2222-2222-222222222222','t1','a1','PAPER','X','BUY','ENTRY',0,'MARKET','c2','k2','CREATED',now(),now())$$, 'zero quantity');
SELECT pg_temp.expect_fail($$INSERT INTO algo.order_intents(intent_id,tenant_id,account_id,mode,symbol,side,role,quantity,order_type,correlation_id,dedupe_key,state,created_at,updated_at) VALUES ('33333333-3333-3333-3333-333333333333','t1','a1','PAPER','X','BUY','ENTRY',1,'MARKET','0123456789012345678901234567890','k3','CREATED',now(),now())$$, 'correlation id > 30 chars (Dhan limit)');
SELECT pg_temp.expect_fail($$INSERT INTO algo.order_intents(intent_id,tenant_id,account_id,mode,symbol,side,role,quantity,order_type,correlation_id,dedupe_key,state,created_at,updated_at) VALUES ('44444444-4444-4444-4444-444444444444','t1','a1','PAPER','X','BUY','ENTRY',1,'MARKET','c4','t1|a1|PAPER|k1','CREATED',now(),now())$$, 'duplicate dedupe_key (double order intent)');
SELECT pg_temp.expect_fail($$INSERT INTO algo.order_intents(intent_id,tenant_id,account_id,mode,symbol,side,role,quantity,order_type,correlation_id,dedupe_key,state,created_at,updated_at) VALUES ('55555555-5555-5555-5555-555555555555','t1','a1','PAPER','X','SHORT','ENTRY',1,'MARKET','c5','k5','CREATED',now(),now())$$, 'invalid side');
SELECT pg_temp.expect_fail($$INSERT INTO algo.order_intents(intent_id,tenant_id,account_id,mode,symbol,side,role,quantity,order_type,correlation_id,dedupe_key,state,created_at,updated_at) VALUES ('66666666-6666-6666-6666-666666666666','t1','a1','PAPER','X','BUY','ENTRY',1,'MARKET','c6','k6','MAYBE',now(),now())$$, 'invalid state');

-- 4. fills / positions constraints
INSERT INTO algo.trade_fills(fill_key,intent_id,tenant_id,account_id,mode,quantity,price,side) VALUES ('t1:a1:PAPER:PT1','11111111-1111-1111-1111-111111111111','t1','a1','PAPER',10,100,'BUY');
SELECT pg_temp.expect_fail($$INSERT INTO algo.trade_fills(fill_key,intent_id,tenant_id,account_id,mode,quantity,price,side) VALUES ('t1:a1:PAPER:PT1','11111111-1111-1111-1111-111111111111','t1','a1','PAPER',10,100,'BUY')$$, 'duplicate fill ingestion');
SELECT pg_temp.expect_fail($$INSERT INTO algo.trade_fills(fill_key,intent_id,tenant_id,account_id,mode,quantity,price,side) VALUES ('f2','11111111-1111-1111-1111-111111111111','t1','a1','PAPER',-5,100,'SELL')$$, 'negative fill quantity');
SELECT pg_temp.expect_fail($$INSERT INTO algo.trading_positions(position_id,tenant_id,account_id,mode,symbol,quantity,avg_price,protection_status,state) VALUES ('p-neg','t1','a1','PAPER','X',-10,100,'UNPROTECTED','OPEN')$$, 'short (negative) position');
SELECT pg_temp.expect_fail($$INSERT INTO algo.trading_positions(position_id,tenant_id,account_id,mode,symbol,quantity,avg_price,protection_status,state) VALUES ('p-closed','t1','a1','PAPER','X',10,100,'PROTECTED','CLOSED')$$, 'CLOSED position without closed_at/net_pnl');

-- 5. append-only tables (even for superuser)
INSERT INTO algo.audit_events(ts,tenant_id,action,prev_hash,hash) VALUES (now(),'t1','test','GENESIS','h1');
INSERT INTO algo.order_events(intent_id,event_key,to_state,ts) VALUES ('11111111-1111-1111-1111-111111111111','e1','CREATED',now());
SELECT pg_temp.expect_fail($$UPDATE algo.audit_events SET action='x'$$, 'audit UPDATE');
SELECT pg_temp.expect_fail($$DELETE FROM algo.audit_events$$, 'audit DELETE');
SELECT pg_temp.expect_fail($$TRUNCATE algo.audit_events$$, 'audit TRUNCATE');
SELECT pg_temp.expect_fail($$UPDATE algo.order_events SET to_state='FILLED'$$, 'order_events UPDATE');
SELECT pg_temp.expect_fail($$DELETE FROM algo.trade_fills$$, 'fills DELETE');

-- 6. tenant isolation (RLS) as the non-owner application role
INSERT INTO algo.audit_events(ts,tenant_id,action,prev_hash,hash) VALUES (now(),'t2','test-t2','h1','h2');
DO $$
DECLARE n int;
BEGIN
  SET LOCAL ROLE algo_app;

  PERFORM set_config('app.tenant_id', 't1', true);
  SELECT count(*) INTO n FROM algo.bots;               IF n <> 3 THEN RAISE EXCEPTION 'tenant t1 should see 3 bots, saw %', n USING ERRCODE='XX999'; END IF;
  SELECT count(*) INTO n FROM algo.bots WHERE tenant_id <> 't1'; IF n <> 0 THEN RAISE EXCEPTION 'RLS leak: t1 sees other tenant bots' USING ERRCODE='XX999'; END IF;
  SELECT count(*) INTO n FROM algo.audit_events;        IF n <> 1 THEN RAISE EXCEPTION 'tenant t1 should see its 1 audit row, saw %', n USING ERRCODE='XX999'; END IF;
  SELECT count(*) INTO n FROM algo.order_events;        IF n <> 1 THEN RAISE EXCEPTION 'order_events isolation via parent failed (%)', n USING ERRCODE='XX999'; END IF;

  PERFORM set_config('app.tenant_id', 't2', true);
  SELECT count(*) INTO n FROM algo.bots;               IF n <> 1 THEN RAISE EXCEPTION 'tenant t2 should see 1 bot, saw %', n USING ERRCODE='XX999'; END IF;
  SELECT count(*) INTO n FROM algo.order_intents;      IF n <> 0 THEN RAISE EXCEPTION 'tenant t2 sees t1 orders (%)', n USING ERRCODE='XX999'; END IF;
  SELECT count(*) INTO n FROM algo.trade_fills;        IF n <> 0 THEN RAISE EXCEPTION 'tenant t2 sees t1 fills (%)', n USING ERRCODE='XX999'; END IF;

  PERFORM set_config('app.tenant_id', '', true);        -- missing tenant context => nothing
  SELECT count(*) INTO n FROM algo.bots;               IF n <> 0 THEN RAISE EXCEPTION 'rows visible without tenant context' USING ERRCODE='XX999'; END IF;

  PERFORM set_config('app.tenant_id', 't2', true);
  BEGIN
    INSERT INTO algo.bots(tenant_id,account_id,bot_id) VALUES ('t1','a1','BOT_77');   -- cross-tenant write
    RAISE EXCEPTION 'cross-tenant INSERT was allowed' USING ERRCODE='XX999';
  EXCEPTION WHEN SQLSTATE 'XX999' THEN RAISE; WHEN OTHERS THEN RAISE NOTICE 'ok (cross-tenant insert rejected): %', SQLERRM;
  END;
  BEGIN
    DELETE FROM algo.bots WHERE tenant_id='t2';
    RAISE EXCEPTION 'app role could DELETE' USING ERRCODE='XX999';
  EXCEPTION WHEN SQLSTATE 'XX999' THEN RAISE; WHEN OTHERS THEN RAISE NOTICE 'ok (app role cannot delete): %', SQLERRM;
  END;
  BEGIN
    UPDATE algo.audit_events SET action='x';
    RAISE EXCEPTION 'app role could UPDATE audit' USING ERRCODE='XX999';
  EXCEPTION WHEN SQLSTATE 'XX999' THEN RAISE; WHEN OTHERS THEN RAISE NOTICE 'ok (app role cannot update audit): %', SQLERRM;
  END;
END $$;

-- 6b. role_assignments: constrained roles, per-tenant isolation
SELECT pg_temp.expect_fail($$INSERT INTO algo.role_assignments(tenant_id,user_id,role,granted_by,granted_at) VALUES ('t1','u9','superuser','x',now())$$, 'unknown role');
INSERT INTO algo.role_assignments(tenant_id,user_id,role,granted_by,granted_at) VALUES ('t1','u1','trader','admin',now()),('t2','u1','risk_manager','admin',now());
DO $$
DECLARE n int; r text;
BEGIN
  SET LOCAL ROLE algo_app;
  PERFORM set_config('app.tenant_id', 't1', true);
  SELECT count(*), max(role) INTO n, r FROM algo.role_assignments;
  IF n <> 1 OR r <> 'trader' THEN RAISE EXCEPTION 'role_assignments isolation failed (% %)', n, r USING ERRCODE='XX999'; END IF;
END $$;

-- 7. market candle sanity
SELECT pg_temp.expect_fail($$INSERT INTO algo.market_candles(symbol,start_ts,open,high,low,close,volume,source) VALUES ('X',now(),10,9,11,10,1,'IMPORT')$$, 'insane candle (high<low)');
INSERT INTO algo.market_candles(symbol,start_ts,open,high,low,close,volume,source) VALUES ('X',now(),10,11,9,10,1,'IMPORT');

SELECT 'ALL MIGRATION CHECKS PASSED' AS result;
