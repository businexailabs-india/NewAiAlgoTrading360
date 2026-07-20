"""MCPProviderRegistry — YAML-driven Indian broker/data provider registry."""

from __future__ import annotations

import importlib
import logging
import os
from pathlib import Path
from typing import Any, Callable

import yaml

from mcp_connectors.base.capabilities import normalize_capabilities
from mcp_connectors.base.models import ProviderConfig
from mcp_connectors.base.provider import BaseTradingMCPProvider, NotConfiguredProvider
from mcp_connectors.base.secrets import validate_credentials_schema

logger = logging.getLogger(__name__)

# Adapter factories registered in code (YAML adapter_class is preferred)
PROVIDER_FACTORIES: dict[str, Callable[..., BaseTradingMCPProvider]] = {}


def _repo_config_dir() -> Path:
    env = os.getenv("MCP_PROVIDERS_CONFIG_DIR")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        candidate = parent / "config" / "mcp-providers"
        if candidate.is_dir():
            return candidate
    # libs/mcp-connectors/src/mcp_connectors → repo root (parents[4])
    return here.parents[4] / "config" / "mcp-providers"


def _import_adapter(class_path: str) -> type[BaseTradingMCPProvider]:
    module_name, _, cls_name = class_path.rpartition(".")
    if not module_name:
        raise ImportError(f"Invalid adapter_class: {class_path}")
    mod = importlib.import_module(module_name)
    cls = getattr(mod, cls_name)
    return cls


def _env_flag_enabled(flag: str | None, default: bool) -> bool:
    if not flag:
        return default
    raw = os.getenv(flag)
    if raw is None:
        return default
    return raw.lower() in ("1", "true", "yes", "on")


def _load_yaml_providers(path: Path) -> list[ProviderConfig]:
    if not path.exists():
        logger.warning("Provider YAML missing: %s", path)
        return []
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    out: list[ProviderConfig] = []
    for row in data.get("providers") or []:
        enabled_default = bool(row.get("enabled", False))
        flag = row.get("env_enable_flag") or ""
        enabled = _env_flag_enabled(flag, enabled_default) if flag else enabled_default
        # Secure default: never enable live trading from YAML alone
        cfg = ProviderConfig(
            provider_id=row["provider_id"],
            provider_name=row.get("provider_name", row["provider_id"]),
            provider_type=row.get("provider_type", "broker"),
            country=row.get("country", "IN"),
            supported_exchanges=list(row.get("supported_exchanges") or []),
            supported_segments=list(row.get("supported_segments") or []),
            supported_asset_classes=list(row.get("supported_asset_classes") or []),
            capabilities=list(row.get("capabilities") or []),
            auth_type=list(row.get("auth_type") or []),
            credentials_required=list(row.get("credentials_required") or []),
            live_trading_default=False if row.get("live_trading_default") is None else bool(row.get("live_trading_default")),
            paper_trading_default=bool(row.get("paper_trading_default", False)),
            status=row.get("status", "active"),
            documentation_url=row.get("documentation_url") or "",
            enabled=enabled,
            adapter_class=row.get("adapter_class") or "",
            env_enable_flag=flag,
            priority=int(row.get("priority") or 100),
        )
        # Force secure default regardless of YAML mistakes
        if cfg.live_trading_default and os.getenv("LIVE_TRADING_ENABLED", "false").lower() not in (
            "1",
            "true",
            "yes",
        ):
            cfg.live_trading_default = False
        out.append(cfg)
    return out


class MCPProviderRegistry:
    def __init__(self, config_dir: Path | None = None):
        self.config_dir = config_dir or _repo_config_dir()
        self._configs: dict[str, ProviderConfig] = {}
        self._instances: dict[str, BaseTradingMCPProvider] = {}
        self._capability_catalog: list[dict[str, Any]] = []
        self._permissions: dict[str, Any] = {}
        self.phase3_providers: list[dict[str, Any]] = []

    def load_providers_from_yaml(self) -> list[ProviderConfig]:
        self._configs.clear()
        files = [
            self.config_dir / "india-brokers.yaml",
            self.config_dir / "india-market-data.yaml",
        ]
        loaded: list[ProviderConfig] = []
        for f in files:
            for cfg in _load_yaml_providers(f):
                self._configs[cfg.provider_id] = cfg
                loaded.append(cfg)
        caps_path = self.config_dir / "provider-capabilities.yaml"
        if caps_path.exists():
            raw = yaml.safe_load(caps_path.read_text(encoding="utf-8")) or {}
            self._capability_catalog = list(raw.get("capabilities") or [])
        perms_path = self.config_dir / "provider-permissions.yaml"
        if perms_path.exists():
            self._permissions = yaml.safe_load(perms_path.read_text(encoding="utf-8")) or {}
        phase3_path = self.config_dir / "phase3-providers.yaml"
        if phase3_path.exists():
            raw = yaml.safe_load(phase3_path.read_text(encoding="utf-8")) or {}
            self.phase3_providers = list(raw.get("providers") or [])
            # Apply YAML priorities onto loaded provider configs
            for row in self.phase3_providers:
                pid = row.get("provider_id")
                if pid and pid in self._configs:
                    self._configs[pid].priority = int(row.get("priority") or 100)
        else:
            self.phase3_providers = []
        return loaded

    def register_provider(
        self,
        provider_id: str,
        factory: Callable[..., BaseTradingMCPProvider],
        config: ProviderConfig | None = None,
    ) -> None:
        PROVIDER_FACTORIES[provider_id] = factory
        if config:
            self._configs[provider_id] = config

    def _build_provider(self, provider_id: str) -> BaseTradingMCPProvider:
        cfg = self._configs.get(provider_id)
        if provider_id in PROVIDER_FACTORIES:
            return PROVIDER_FACTORIES[provider_id](config=cfg)
        if cfg and cfg.adapter_class:
            try:
                cls = _import_adapter(cfg.adapter_class)
                return cls(config=cfg)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to load adapter %s: %s", cfg.adapter_class, exc)
                return NotConfiguredProvider(provider_id, config=cfg)
        return NotConfiguredProvider(provider_id, config=cfg)

    def get_provider(self, provider_id: str, *, fresh: bool = False) -> BaseTradingMCPProvider:
        key = provider_id.lower().replace("-", "_")
        # aliases
        aliases = {
            "paper": "paper_trading",
            "mock": "mock_trading",
            "dhanhq": "dhan",
            "kite": "zerodha",
            "angel": "angelone",
            "breeze": "icici_breeze",
            "shoonya": "finvasia_shoonya",
        }
        key = aliases.get(key, key)
        if not self._configs:
            self.load_providers_from_yaml()
        if fresh or key not in self._instances:
            self._instances[key] = self._build_provider(key)
        return self._instances[key]

    def list_providers(self) -> list[ProviderConfig]:
        if not self._configs:
            self.load_providers_from_yaml()
        return list(self._configs.values())

    def list_enabled_providers(self) -> list[ProviderConfig]:
        return [p for p in self.list_providers() if p.enabled]

    def list_providers_by_country(self, country: str) -> list[ProviderConfig]:
        c = (country or "").upper()
        return [p for p in self.list_providers() if p.country.upper() == c]

    def list_providers_by_capability(self, capability: str) -> list[ProviderConfig]:
        cap = capability.upper()
        out = []
        for p in self.list_providers():
            norms = normalize_capabilities(p.capabilities)
            raw_upper = [c.upper() for c in p.capabilities]
            if cap in norms or cap in raw_upper or capability.lower() in [c.lower() for c in p.capabilities]:
                out.append(p)
        return out

    def list_providers_by_exchange(self, exchange: str) -> list[ProviderConfig]:
        ex = exchange.upper()
        return [p for p in self.list_providers() if ex in [e.upper() for e in p.supported_exchanges]]

    def validate_provider_config(self, provider_id: str) -> dict[str, Any]:
        if not self._configs:
            self.load_providers_from_yaml()
        cfg = self._configs.get(provider_id)
        if not cfg:
            return {"ok": False, "errors": [f"unknown provider_id: {provider_id}"]}
        errors: list[str] = []
        if not cfg.provider_name:
            errors.append("provider_name missing")
        if not cfg.provider_type:
            errors.append("provider_type missing")
        if cfg.live_trading_default:
            errors.append("live_trading_default must be false unless LIVE_TRADING_ENABLED=true")
        if cfg.adapter_class:
            try:
                _import_adapter(cfg.adapter_class)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"adapter_class import failed: {exc}")
        return {"ok": len(errors) == 0, "provider_id": provider_id, "errors": errors, "config": cfg.model_dump()}

    def validate_credentials_schema(self, provider_id: str, credentials: dict[str, Any]) -> dict[str, Any]:
        if not self._configs:
            self.load_providers_from_yaml()
        cfg = self._configs.get(provider_id)
        if not cfg:
            return {"ok": False, "missing": [f"unknown:{provider_id}"]}
        missing = validate_credentials_schema(cfg.credentials_required, credentials)
        return {
            "ok": len(missing) == 0,
            "provider_id": provider_id,
            "missing": missing,
            "required": list(cfg.credentials_required),
        }

    def get_provider_capabilities(self, provider_id: str) -> dict[str, Any]:
        if not self._configs:
            self.load_providers_from_yaml()
        cfg = self._configs.get(provider_id)
        if not cfg:
            return {"provider_id": provider_id, "capabilities": [], "error": "not_found"}
        return {
            "provider_id": provider_id,
            "capabilities": normalize_capabilities(cfg.capabilities),
            "raw_capabilities": list(cfg.capabilities),
            "supported_exchanges": list(cfg.supported_exchanges),
            "supported_segments": list(cfg.supported_segments),
            "live_trading_default": False,
            "paper_trading_default": cfg.paper_trading_default,
            "status": cfg.status,
            "enabled": cfg.enabled,
        }

    def capability_catalog(self) -> list[dict[str, Any]]:
        if not self._capability_catalog and not self._configs:
            self.load_providers_from_yaml()
        return list(self._capability_catalog)

    def permissions(self) -> dict[str, Any]:
        if not self._permissions and not self._configs:
            self.load_providers_from_yaml()
        return dict(self._permissions)

    def set_enabled(self, provider_id: str, enabled: bool) -> ProviderConfig | None:
        if not self._configs:
            self.load_providers_from_yaml()
        cfg = self._configs.get(provider_id)
        if not cfg:
            return None
        cfg.enabled = enabled
        return cfg


# Module-level singleton used by service + legacy helpers
_REGISTRY: MCPProviderRegistry | None = None


def get_registry(reload: bool = False) -> MCPProviderRegistry:
    global _REGISTRY
    if _REGISTRY is None or reload:
        _REGISTRY = MCPProviderRegistry()
        _REGISTRY.load_providers_from_yaml()
    return _REGISTRY


# ---------------------------------------------------------------------------
# Backward-compatible advisory connector API
# ---------------------------------------------------------------------------

def list_connectors() -> list[str]:
    reg = get_registry()
    ids = [p.provider_id for p in reg.list_providers()]
    # legacy names expected by older services
    for legacy in ("paper", "mock", "dhan", "zerodha", "angelone", "upstox"):
        if legacy not in ids:
            ids.append(legacy)
    return ids


def get_connector(name: str, **kwargs: Any):
    """Registry-backed factory — provider identity comes from YAML, not hardcoded classes."""
    from mcp_connectors.legacy import LegacyConnectorAdapter

    key = name.lower().replace("-", "_").replace(" ", "_")
    reg = get_registry()
    if not reg._configs:
        reg.load_providers_from_yaml()
    # Resolve aliases via registry get_provider
    if key in ("paper", "paper_trading"):
        provider = reg.get_provider("paper_trading", fresh=True)
        if "initial_cash" in kwargs and hasattr(provider, "cash"):
            provider.cash = float(kwargs["initial_cash"])  # type: ignore[attr-defined]
        return LegacyConnectorAdapter(provider)
    if key in ("mock", "mock_trading"):
        provider = reg.get_provider("mock_trading", fresh=True)
        if "connected" in kwargs and hasattr(provider, "_connected"):
            provider._connected = bool(kwargs["connected"])  # type: ignore[attr-defined]
        if "stale" in kwargs and hasattr(provider, "stale"):
            provider.stale = bool(kwargs["stale"])  # type: ignore[attr-defined]
        return LegacyConnectorAdapter(provider)
    provider = reg.get_provider(key, fresh=True)
    return LegacyConnectorAdapter(provider)


# Aliases matching plan names
def DhanMCPConnector(**kw):  # noqa: N802
    return get_connector("dhan", **kw)


def ZerodhaMCPConnector(**kw):  # noqa: N802
    return get_connector("zerodha", **kw)


def AngelOneMCPConnector(**kw):  # noqa: N802
    return get_connector("angelone", **kw)


def UpstoxMCPConnector(**kw):  # noqa: N802
    return get_connector("upstox", **kw)


def InteractiveBrokersMCPConnector(**kw):  # noqa: N802
    return get_connector("interactive_brokers", **kw)


def AlpacaMCPConnector(**kw):  # noqa: N802
    return get_connector("alpaca", **kw)
