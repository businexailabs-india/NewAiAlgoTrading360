"""LLM provider interfaces and JSON validation."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field, ValidationError


class LLMJsonValidationError(ValueError):
    """Raised when model output is not valid JSON / schema."""


class AdvisoryLLMOutput(BaseModel):
    summary: str
    recommendations: list[dict[str, Any]] = Field(min_length=1, max_length=5)
    warnings: list[str] = Field(default_factory=list)
    paper_only: bool = True
    live_trading_enabled: bool = False


class StrategyDraftLLMOutput(BaseModel):
    strategy_type: str
    symbol: str | None = None
    timeframe: str = "5m"
    paper_only: bool = True
    live_trading_enabled: bool = False
    entry_rules: list[dict[str, Any]] | dict[str, Any] = Field(default_factory=list)
    exit_rules: list[dict[str, Any]] | dict[str, Any] = Field(default_factory=list)
    risk_rules: list[dict[str, Any]] | dict[str, Any] = Field(default_factory=list)
    rationale: str = ""


def validate_ai_json(raw: str | dict[str, Any], schema: type[BaseModel] | None = None) -> dict[str, Any]:
    """Parse and optionally schema-validate AI JSON. Never executes code."""
    if isinstance(raw, dict):
        data = raw
    else:
        try:
            data = json.loads(raw)
        except Exception as exc:
            raise LLMJsonValidationError(f"Invalid JSON output: {exc}") from exc
    if not isinstance(data, dict):
        raise LLMJsonValidationError("JSON root must be an object")
    if schema is not None:
        try:
            return schema.model_validate(data).model_dump()
        except ValidationError as exc:
            raise LLMJsonValidationError(f"AI JSON schema validation failed: {exc}") from exc
    return data


class BaseLLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def generate_response(self, prompt: str, context: dict[str, Any]) -> str: ...

    async def classify_intent(self, text: str) -> dict[str, Any]:
        return {"intent": "unknown_intent", "confidence": 0.5}

    async def generate_strategy_draft(self, text: str, context: dict[str, Any]) -> dict[str, Any]:
        return {}

    async def generate_advisory_json(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        raw = await self.generate_response(prompt, context)
        return self.validate_json_output(raw, AdvisoryLLMOutput)

    async def explain_risk(self, payload: dict[str, Any]) -> str:
        return "Trading involves risk; profit is not guaranteed."

    async def translate_response(self, text: str, target_language: str) -> str:
        return text

    def validate_json_output(
        self, raw: str | dict[str, Any], schema: type[BaseModel] | None = None
    ) -> dict[str, Any]:
        return validate_ai_json(raw, schema)

    def available(self) -> bool:
        return True
