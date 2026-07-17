"""Language detection for Indian languages + Hinglish / mixed queries."""

from __future__ import annotations

import re
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class LanguageCode(str, Enum):
    EN = "en"
    HI = "hi"
    OR = "or"  # Odia
    BN = "bn"
    TE = "te"
    TA = "ta"
    KN = "kn"
    ML = "ml"
    MR = "mr"
    GU = "gu"
    PA = "pa"
    AS = "as"
    UR = "ur"
    HINGLISH = "hinglish"
    MIXED = "mixed"
    UNKNOWN = "unknown"


SUPPORTED_LANGUAGES = {c.value for c in LanguageCode if c not in (LanguageCode.UNKNOWN,)}

# Unicode script ranges for Indian languages
SCRIPT_RANGES: dict[LanguageCode, list[tuple[int, int]]] = {
    LanguageCode.HI: [(0x0900, 0x097F)],  # Devanagari (also MR)
    LanguageCode.OR: [(0x0B00, 0x0B7F)],
    LanguageCode.BN: [(0x0980, 0x09FF)],
    LanguageCode.TE: [(0x0C00, 0x0C7F)],
    LanguageCode.TA: [(0x0B80, 0x0BFF)],
    LanguageCode.KN: [(0x0C80, 0x0CFF)],
    LanguageCode.ML: [(0x0D00, 0x0D7F)],
    LanguageCode.GU: [(0x0A80, 0x0AFF)],
    LanguageCode.PA: [(0x0A00, 0x0A7F)],
    LanguageCode.AS: [(0x0980, 0x09FF)],  # shares Bengali script; keyword disambiguation
    LanguageCode.UR: [(0x0600, 0x06FF)],
}

HINGLISH_MARKERS = re.compile(
    r"\b(batao|karo|kya|hai|kaise|kitna|mera|meri|mujhe|aaj|kal|chahiye|mat|"
    r"jyada|kam|abhi|please|algo|intraday|paper|live|order|stop|bots?)\b",
    re.I,
)

ODIA_HINTS = re.compile(r"(ମୋ|ପୋର୍ଟଫୋଲିଓ|risk|କେତେ|କହ)", re.I)
HINDI_HINTS = re.compile(r"(आज|बाजार|बताओ|कितना|मेरा|लाभ|नुकसान)", re.I)


class LanguageDetectionResult(BaseModel):
    language: LanguageCode
    confidence: float = Field(ge=0.0, le=1.0)
    is_mixed: bool = False
    scripts_detected: list[str] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)


class LanguageDetector:
    """Heuristic detector — deterministic, no network. LLM can refine later."""

    def detect(self, text: str, hint: str | None = None) -> LanguageDetectionResult:
        if hint:
            try:
                code = LanguageCode(hint.lower())
                if code != LanguageCode.UNKNOWN:
                    return LanguageDetectionResult(language=code, confidence=0.95)
            except ValueError:
                pass

        raw = (text or "").strip()
        if not raw:
            return LanguageDetectionResult(language=LanguageCode.EN, confidence=0.4)

        script_hits: dict[LanguageCode, int] = {}
        scripts: list[str] = []
        for code, ranges in SCRIPT_RANGES.items():
            count = 0
            for ch in raw:
                cp = ord(ch)
                if any(lo <= cp <= hi for lo, hi in ranges):
                    count += 1
            if count:
                script_hits[code] = count
                scripts.append(code.value)

        latin = sum(1 for ch in raw if "a" <= ch.lower() <= "z")
        has_hinglish = bool(HINGLISH_MARKERS.search(raw))

        if LanguageCode.OR in script_hits or ODIA_HINTS.search(raw):
            conf = 0.92 if LanguageCode.OR in script_hits else 0.7
            return LanguageDetectionResult(
                language=LanguageCode.OR,
                confidence=conf,
                is_mixed=latin > 0,
                scripts_detected=scripts,
            )

        if LanguageCode.HI in script_hits or HINDI_HINTS.search(raw):
            mixed = latin > 3 or has_hinglish
            return LanguageDetectionResult(
                language=LanguageCode.HINGLISH if mixed else LanguageCode.HI,
                confidence=0.9 if not mixed else 0.85,
                is_mixed=mixed,
                scripts_detected=scripts,
            )

        for code in (
            LanguageCode.BN,
            LanguageCode.TE,
            LanguageCode.TA,
            LanguageCode.KN,
            LanguageCode.ML,
            LanguageCode.GU,
            LanguageCode.PA,
            LanguageCode.UR,
        ):
            if code in script_hits:
                return LanguageDetectionResult(
                    language=code,
                    confidence=0.88,
                    is_mixed=latin > 0,
                    scripts_detected=scripts,
                )

        if has_hinglish and latin > 0:
            return LanguageDetectionResult(
                language=LanguageCode.HINGLISH,
                confidence=0.8,
                is_mixed=True,
                scripts_detected=["latin"],
            )

        if script_hits and latin > 5:
            top = max(script_hits, key=script_hits.get)  # type: ignore[arg-type]
            return LanguageDetectionResult(
                language=LanguageCode.MIXED,
                confidence=0.7,
                is_mixed=True,
                scripts_detected=scripts,
                details={"primary_script": top.value},
            )

        return LanguageDetectionResult(
            language=LanguageCode.EN,
            confidence=0.75 if latin else 0.5,
            scripts_detected=["latin"] if latin else [],
        )
