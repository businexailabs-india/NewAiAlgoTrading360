"""Base MCP provider abstractions."""

from mcp_connectors.base.auth_refresh import AuthFlowType, AuthRefreshResult, placeholder_refresh
from mcp_connectors.base.capabilities import Capability, normalize_capabilities
from mcp_connectors.base.certification import (
    ProviderCertificationChecklist,
    run_provider_certification,
    write_certification_report,
)
from mcp_connectors.base.errors import ProviderAPIError, ProviderError, ProviderErrorCode, map_provider_error
from mcp_connectors.base.mappings import (
    Exchange,
    OrderSide,
    OrderStatus,
    OrderType,
    ProductType,
    Segment,
    denormalize_symbol,
    map_order_status,
    map_order_type,
    map_product_type,
    normalize_symbol,
)
from mcp_connectors.base.models import (
    LiveOrderGateContext,
    MCPConnection,
    NormalizedAccountSnapshot,
    NormalizedInstrument,
    NormalizedOrderRequest,
    NormalizedOrderResponse,
    ProviderCapability,
    ProviderConfig,
    ProviderCredential,
    ProviderHealthCheck,
)
from mcp_connectors.base.provider import (
    BaseTradingMCPProvider,
    LiveTradingBlockedError,
    NotConfiguredProvider,
)
from mcp_connectors.base.rate_limits import RateLimitConfig
from mcp_connectors.base.secrets import (
    AWSSecretsManager,
    AzureKeyVault,
    GCPSecretManager,
    LocalEncryptedSecretManager,
    SecretManager,
    VaultSecretManager,
    get_secret_manager,
    mask_credential,
    validate_credentials_schema,
)
from mcp_connectors.legacy import BaseTradingMCPConnector, ConnectorCapabilities

# Legacy alias
NotConfiguredConnector = NotConfiguredProvider

__all__ = [
    "AWSSecretsManager",
    "AuthFlowType",
    "AuthRefreshResult",
    "AzureKeyVault",
    "BaseTradingMCPConnector",
    "BaseTradingMCPProvider",
    "Capability",
    "ConnectorCapabilities",
    "Exchange",
    "GCPSecretManager",
    "LiveOrderGateContext",
    "LiveTradingBlockedError",
    "LocalEncryptedSecretManager",
    "MCPConnection",
    "NormalizedAccountSnapshot",
    "NormalizedInstrument",
    "NormalizedOrderRequest",
    "NormalizedOrderResponse",
    "NotConfiguredConnector",
    "NotConfiguredProvider",
    "OrderSide",
    "OrderStatus",
    "OrderType",
    "ProductType",
    "ProviderAPIError",
    "ProviderCapability",
    "ProviderCertificationChecklist",
    "ProviderConfig",
    "ProviderCredential",
    "ProviderError",
    "ProviderErrorCode",
    "ProviderHealthCheck",
    "RateLimitConfig",
    "SecretManager",
    "Segment",
    "VaultSecretManager",
    "denormalize_symbol",
    "get_secret_manager",
    "map_order_status",
    "map_order_type",
    "map_product_type",
    "map_provider_error",
    "mask_credential",
    "normalize_capabilities",
    "normalize_symbol",
    "placeholder_refresh",
    "run_provider_certification",
    "validate_credentials_schema",
    "write_certification_report",
]
