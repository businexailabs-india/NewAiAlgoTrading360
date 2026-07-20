"""Credential encryption — secrets never logged or sent to LLMs."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from abc import ABC, abstractmethod
from typing import Any


def mask_credential(value: str | None, visible: int = 4) -> str:
    if not value:
        return ""
    if len(value) <= visible:
        return "*" * len(value)
    return ("*" * (len(value) - visible)) + value[-visible:]


def validate_credentials_schema(required: list[str], credentials: dict[str, Any]) -> list[str]:
    """Return list of missing required credential keys (optional_* keys skipped)."""
    missing: list[str] = []
    for key in required:
        if key.endswith("_optional") or key.endswith("_placeholder"):
            continue
        # password_or_token → password OR token OR access_token
        if key == "password_or_token":
            if not any(credentials.get(k) for k in ("password", "token", "access_token", "password_or_token")):
                missing.append(key)
            continue
        if not credentials.get(key):
            missing.append(key)
    return missing


class SecretManager(ABC):
    @abstractmethod
    def store(self, ref: str, plaintext: str) -> str:
        ...

    @abstractmethod
    def retrieve(self, ref: str) -> str | None:
        ...

    @abstractmethod
    def delete(self, ref: str) -> None:
        ...

    @abstractmethod
    def rotate(self, ref: str, plaintext: str) -> str:
        ...


class LocalEncryptedSecretManager(SecretManager):
    """Local encrypted credential store.

    Uses Fernet when the ``cryptography`` package is available; otherwise
    falls back to HMAC-authenticated XOR (dev only). Replace with Vault/KMS in prod.
    """

    def __init__(self, key: str | None = None):
        raw = (key or os.getenv("LOCAL_SECRET_KEY") or "change-this-in-production").encode("utf-8")
        self._key = hashlib.sha256(raw).digest()
        self._store: dict[str, str] = {}
        self._fernet = None
        try:
            from cryptography.fernet import Fernet  # type: ignore[import-untyped]

            fkey = base64.urlsafe_b64encode(self._key)
            self._fernet = Fernet(fkey)
        except Exception:  # noqa: BLE001
            self._fernet = None

    def _seal(self, plaintext: str) -> str:
        if self._fernet is not None:
            token = self._fernet.encrypt(plaintext.encode("utf-8"))
            return "fernet:" + token.decode("ascii")
        nonce = secrets.token_bytes(16)
        data = plaintext.encode("utf-8")
        stream = hashlib.sha256(self._key + nonce).digest()
        cipher = bytes(b ^ stream[i % len(stream)] for i, b in enumerate(data))
        tag = hmac.new(self._key, nonce + cipher, hashlib.sha256).digest()[:16]
        return "xor:" + base64.urlsafe_b64encode(nonce + tag + cipher).decode("ascii")

    def _unseal(self, blob: str) -> str:
        if blob.startswith("fernet:"):
            if self._fernet is None:
                raise ValueError("fernet credentials require cryptography package")
            return self._fernet.decrypt(blob[7:].encode("ascii")).decode("utf-8")
        raw_b64 = blob[4:] if blob.startswith("xor:") else blob
        raw = base64.urlsafe_b64decode(raw_b64.encode("ascii"))
        nonce, tag, cipher = raw[:16], raw[16:32], raw[32:]
        expected = hmac.new(self._key, nonce + cipher, hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(tag, expected):
            raise ValueError("credential integrity check failed")
        stream = hashlib.sha256(self._key + nonce).digest()
        data = bytes(b ^ stream[i % len(stream)] for i, b in enumerate(cipher))
        return data.decode("utf-8")

    def store(self, ref: str, plaintext: str) -> str:
        sealed = self._seal(plaintext)
        self._store[ref] = sealed
        return ref

    def retrieve(self, ref: str) -> str | None:
        sealed = self._store.get(ref)
        if sealed is None:
            return None
        return self._unseal(sealed)

    def delete(self, ref: str) -> None:
        self._store.pop(ref, None)

    def rotate(self, ref: str, plaintext: str) -> str:
        return self.store(ref, plaintext)


class VaultSecretManager(SecretManager):
    """HashiCorp Vault placeholder — wire real client in production."""

    def store(self, ref: str, plaintext: str) -> str:
        raise NotImplementedError("VaultSecretManager requires VAULT_ADDR + token configuration")

    def retrieve(self, ref: str) -> str | None:
        raise NotImplementedError("VaultSecretManager requires VAULT_ADDR + token configuration")

    def delete(self, ref: str) -> None:
        raise NotImplementedError("VaultSecretManager requires VAULT_ADDR + token configuration")

    def rotate(self, ref: str, plaintext: str) -> str:
        raise NotImplementedError("VaultSecretManager requires VAULT_ADDR + token configuration")


class AWSSecretsManager(SecretManager):
    def store(self, ref: str, plaintext: str) -> str:
        raise NotImplementedError("AWSSecretsManager placeholder — configure AWS credentials")

    def retrieve(self, ref: str) -> str | None:
        raise NotImplementedError("AWSSecretsManager placeholder — configure AWS credentials")

    def delete(self, ref: str) -> None:
        raise NotImplementedError("AWSSecretsManager placeholder")

    def rotate(self, ref: str, plaintext: str) -> str:
        raise NotImplementedError("AWSSecretsManager placeholder")


class GCPSecretManager(SecretManager):
    def store(self, ref: str, plaintext: str) -> str:
        raise NotImplementedError("GCPSecretManager placeholder")

    def retrieve(self, ref: str) -> str | None:
        raise NotImplementedError("GCPSecretManager placeholder")

    def delete(self, ref: str) -> None:
        raise NotImplementedError("GCPSecretManager placeholder")

    def rotate(self, ref: str, plaintext: str) -> str:
        raise NotImplementedError("GCPSecretManager placeholder")


class AzureKeyVault(SecretManager):
    def store(self, ref: str, plaintext: str) -> str:
        raise NotImplementedError("AzureKeyVault placeholder")

    def retrieve(self, ref: str) -> str | None:
        raise NotImplementedError("AzureKeyVault placeholder")

    def delete(self, ref: str) -> None:
        raise NotImplementedError("AzureKeyVault placeholder")

    def rotate(self, ref: str, plaintext: str) -> str:
        raise NotImplementedError("AzureKeyVault placeholder")


def get_secret_manager(provider: str | None = None) -> SecretManager:
    name = (provider or os.getenv("SECRET_MANAGER_PROVIDER") or "local_encrypted").lower()
    if name in ("local", "local_encrypted"):
        return LocalEncryptedSecretManager()
    if name in ("vault", "hashicorp_vault"):
        return VaultSecretManager()
    if name in ("aws", "aws_secrets_manager"):
        return AWSSecretsManager()
    if name in ("gcp", "gcp_secret_manager"):
        return GCPSecretManager()
    if name in ("azure", "azure_key_vault"):
        return AzureKeyVault()
    return LocalEncryptedSecretManager()
