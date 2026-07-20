"""Mockable HTTP client for broker adapters (placeholder until real API binding)."""

from __future__ import annotations

from typing import Any

import httpx


class MockHTTPClient:
    """In-memory responses keyed by method+path for unit tests / demo mode."""

    def __init__(self, fixtures: dict[str, Any] | None = None):
        self.fixtures = fixtures or {}
        self.calls: list[dict[str, Any]] = []

    async def request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        # Never log kwargs that may contain Authorization headers / tokens
        safe_headers = {
            k: "[REDACTED]" if "auth" in k.lower() or "token" in k.lower() or "key" in k.lower() else v
            for k, v in (kwargs.get("headers") or {}).items()
        }
        self.calls.append({"method": method.upper(), "path": path, "headers": safe_headers})
        key = f"{method.upper()} {path}"
        if key in self.fixtures:
            return self.fixtures[key]
        return {"ok": True, "mock": True, "path": path}

    async def get(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self.request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self.request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self.request("DELETE", path, **kwargs)


class ProviderHTTPClient:
    """Thin async HTTP wrapper; switches to MockHTTPClient when use_mock=True."""

    def __init__(self, base_url: str = "", use_mock: bool = True, fixtures: dict[str, Any] | None = None):
        self.base_url = base_url.rstrip("/")
        self.use_mock = use_mock or not base_url
        self.mock = MockHTTPClient(fixtures)
        self._client: httpx.AsyncClient | None = None

    async def _ensure(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)
        return self._client

    async def request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if self.use_mock:
            return await self.mock.request(method, path, **kwargs)
        client = await self._ensure()
        resp = await client.request(method, path, **kwargs)
        resp.raise_for_status()
        if resp.headers.get("content-type", "").startswith("application/json"):
            return resp.json()
        return {"raw": resp.text}

    async def get(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self.request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self.request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self.request("DELETE", path, **kwargs)

    async def aclose(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
