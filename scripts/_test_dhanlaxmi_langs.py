# -*- coding: utf-8 -*-
"""Call DhanLaxmi chat for today-market across all UI languages."""
from __future__ import annotations

import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [
    str(ROOT / "libs/intent-core/src"),
    str(ROOT / "libs/localized-response-templates/src"),
]

SECRET = b"dev-service-hmac-secret-change-me"
BASE = "http://localhost:8095"

LANGS = [
    ("en", "How is today's market?"),
    ("hi", "\u0906\u091c market \u0915\u0948\u0938\u093e \u0939\u0948?"),
    ("hinglish", "Aaj market kaisa hai?"),
    ("or", "\u0b06\u0b1c\u0b3f \u0b2c\u0b1c\u0b3e\u0b30 \u0b15\u0b3f\u0b2a\u0b30\u0b3f?"),
    ("bn", "\u0986\u099c\u0995\u09c7\u09b0 \u09ac\u09be\u099c\u09be\u09b0 \u0995\u09c7\u09ae\u09a8?"),
    ("te", "\u0c08\u0c30\u0c4b\u0c1c\u0c41 \u0c2e\u0c3e\u0c30\u0c4d\u0c15\u0c46\u0c1f\u0c4d \u0c0e\u0c32\u0c3e \u0c09\u0c02\u0c26\u0c3f?"),
    ("ta", "\u0b87\u0ba9\u0bcd\u0bb1\u0bc8\u0baf \u0b9a\u0ba8\u0bcd\u0ba4\u0bc8 \u0b8e\u0baa\u0bcd\u0baa\u0b9f\u0bbf \u0b87\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bbf\u0bb1\u0ba4\u0bc1?"),
    ("kn", "\u0c87\u0c82\u0ca6\u0cbf\u0ca8 \u0cae\u0cbe\u0cb0\u0cc1\u0c95\u0c9f\u0ccd\u0c9f\u0cc6 \u0c9f\u0cc6\u0cb9\u0c97\u0cbf\u0ca6\u0cc6?"),
    ("ml", "\u0d07\u0d28\u0d4d\u0d28\u0d24\u0d4d\u0d24\u0d46 \u0d35\u0d3f\u0d2a\u0d23\u0d3f \u0d0e\u0d28\u0d4d\u0d28\u0d3e\u0d23\u0d4d?"),
    ("mr", "\u0906\u091c\u091a\u093e \u092c\u093e\u091c\u093e\u0930 \u0915\u0938\u093e \u0906\u0939\u0947?"),
    ("gu", "\u0a86\u0a9c\u0aa8\u0acb \u0aac\u0a9c\u0abe\u0ab0 \u0a95\u0ac7\u0ab5\u0acb \u0a9b\u0ac7?"),
    ("pa", "\u0a05\u0a71\u0a1c \u0a26\u0a3e \u0a2c\u0a3e\u0a1c\u0a3c\u0a3e\u0a30 \u0a15\u0a3f\u0a35\u0a47\u0a02 \u0a39\u0a48?"),
    ("as", "\u0986\u099c\u09bf\u09f0 \u09ac\u099c\u09be\u09f0 \u0995\u09c7\u09a8\u09c7\u0995\u09c1\u09f1\u09be?"),
    ("ur", "\u0622\u062c \u0628\u0627\u0632\u0627\u0631 \u06a9\u06cc\u0633\u0627 \u06c1\u06d2\u061f"),
]


def sign(tenant: str, user: str, role: str = "user") -> dict[str, str]:
    request_id = str(uuid.uuid4())
    ts = str(int(time.time()))
    payload = f"{tenant}:{user}:{role}:{request_id}:{ts}"
    sig = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()
    return {
        "Content-Type": "application/json",
        "X-Tenant-Id": tenant,
        "X-User-Id": user,
        "X-User-Role": role,
        "X-Request-Id": request_id,
        "X-Service-Timestamp": ts,
        "X-Service-Signature": sig,
    }


def chat(message: str, language_hint: str, indices: list[dict]) -> dict:
    body = {
        "message": message,
        "language_hint": language_hint,
        "mode": "web",
        "context": {
            "broker_status": "connected",
            "risk_profile_completed": True,
            "market_status": "closed",
            "indices": indices,
            "market_summary_line": (
                "Market status: closed. Indices — "
                + "; ".join(
                    f"{r['name']}: {r['value']:,.2f} ({r['changePercent']:+.2f}%)"
                    for r in indices[:4]
                )
                + "."
            ),
        },
    }
    req = urllib.request.Request(
        f"{BASE}/dhanlaxmi/chat",
        data=json.dumps(body).encode("utf-8"),
        headers=sign(str(uuid.uuid4()), str(uuid.uuid4())),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def fetch_yahoo_indices() -> list[dict]:
    symbols = {
        "^NSEI": "NIFTY 50",
        "^BSESN": "SENSEX",
        "^NSEBANK": "BANK NIFTY",
    }
    out: list[dict] = []
    for yahoo, name in symbols.items():
        url = (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{urllib.request.quote(yahoo)}?interval=1d&range=1d"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                data = json.loads(res.read().decode("utf-8"))
            meta = data["chart"]["result"][0]["meta"]
            price = float(meta.get("regularMarketPrice") or 0)
            prev = float(meta.get("chartPreviousClose") or meta.get("previousClose") or price)
            chg = price - prev
            pct = (chg / prev * 100) if prev else 0.0
            out.append({"name": name, "value": price, "change": chg, "changePercent": pct})
        except Exception as exc:  # noqa: BLE001
            print(f"yahoo miss {yahoo}: {exc}")
    return out


def main() -> int:
    indices = fetch_yahoo_indices()
    print("INDICES", json.dumps(indices, ensure_ascii=False))
    rows = []
    for lang, msg in LANGS:
        try:
            payload = chat(msg, lang, indices)
            data = payload.get("data") or payload
            rows.append(
                {
                    "lang": lang,
                    "intent": data.get("intent"),
                    "language": data.get("language"),
                    "has_indices": "Indices" in (data.get("response_text") or "")
                    or "NIFTY" in (data.get("response_text") or "").upper(),
                    "preview": (data.get("response_text") or "")[:160],
                }
            )
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            rows.append({"lang": lang, "error": f"{exc.code} {body[:120]}"})
        except Exception as exc:  # noqa: BLE001
            rows.append({"lang": lang, "error": str(exc)})
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    ok = sum(1 for r in rows if r.get("intent") == "market_query" and r.get("has_indices"))
    print(f"PASS {ok}/{len(LANGS)} languages returned market_query with index snapshot")
    return 0 if ok == len(LANGS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
