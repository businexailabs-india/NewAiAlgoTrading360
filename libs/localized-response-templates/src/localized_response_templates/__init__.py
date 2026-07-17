"""Localized response templates for DhanLaxmi."""

from __future__ import annotations

from typing import Any


RISK_DISCLAIMER = {
    "en": "Trading involves risk. This is not financial advice and profit is not guaranteed.",
    "hi": "Trading में जोखिम होता है। यह वित्तीय सलाह नहीं है और लाभ की गारंटी नहीं है।",
    "or": "ଟ୍ରେଡିଂରେ ଝୁମକି ରହିଛି। ଏହା ଆର୍ଥିକ ପରାମର୍ଶ ନୁହେଁ ଏବଂ ଲାଭ ଗ୍ୟାରେଣ୍ଟି ନୁହେଁ।",
    "bn": "ট্রেডিংয়ে ঝুঁকি আছে। এটি আর্থিক পরামর্শ নয় এবং লাভের গ্যারান্টি নেই।",
    "te": "ట్రేడింగ్‌లో రిస్క్ ఉంది. ఇది ఆర్థిక సలహా కాదు మరియు లాభం హామీ లేదు.",
    "ta": "வர்த்தகத்தில் ஆபத்து உள்ளது. இது நிதி ஆலோசனை அல்ல; இலாபம் உத்தரவாதம் இல்லை.",
    "kn": "ವ್ಯಾಪಾರದಲ್ಲಿ ಅಪಾಯವಿದೆ. ಇದು ಹಣಕಾಸು ಸಲಹೆ ಅಲ್ಲ ಮತ್ತು ಲಾಭ ಖಾತರಿ ಇಲ್ಲ.",
    "ml": "ട്രേഡിംഗിൽ റിസ്ക് ഉണ്ട്. ഇത് ധനകാര്യ ഉപദേശമല്ല; ലാഭം ഉറപ്പില്ല.",
    "mr": "ट्रेडिंगमध्ये जोखीम आहे. ही आर्थिक सल्ला नाही आणि नफ्याची हमी नाही.",
    "gu": "ટ્રેડિંગમાં જોખમ છે. આ નાણાકીય સલાહ નથી અને નફાની ગેરંટી નથી.",
    "pa": "ਟ੍ਰੇਡਿੰਗ ਵਿੱਚ ਖਤਰਾ ਹੈ। ਇਹ ਵਿੱਤੀ ਸਲਾਹ ਨਹੀਂ ਅਤੇ ਮੁਨਾਫ਼ੇ ਦੀ ਗਾਰੰਟੀ ਨਹੀਂ।",
    "as": "ট্ৰেডিঙত বিপদ আছে। এইটো আর্থিক পৰামৰ্শ নহয় আৰু লাভৰ গেৰাণ্টি নাই।",
    "ur": "ٹریڈنگ میں خطرہ ہے۔ یہ مالیاتی مشورہ نہیں اور منافع کی ضمانت نہیں۔",
    "hinglish": "Trading mein risk hota hai. Yeh financial advice nahi hai aur profit guaranteed nahi hai.",
}


TEMPLATES: dict[str, dict[str, str]] = {
    "greeting": {
        "en": "Namaste! I am DhanLaxmi, your trading assistant. How can I help today?",
        "hi": "नमस्ते! मैं धनलक्ष्मी हूँ, आपकी trading assistant। आज कैसे मदद करूँ?",
        "or": "ନମସ୍କାର! ମୁଁ ଧନଲକ୍ଷ୍ମୀ, ଆପଣଙ୍କ trading assistant। ଆଜି କିପରି ସାହାଯ୍ୟ କରିବି?",
        "hinglish": "Namaste! Main DhanLaxmi hoon. Aaj kaise madad karun?",
    },
    "strategy_draft_intro": {
        "en": (
            "I can create an intraday algo draft for {symbol}. First I will check market trend, "
            "VWAP, volume and your risk profile. This will not be a live trade. Paper test runs first. "
            "Trading involves risk and profit is not guaranteed."
        ),
        "hi": (
            "मैं {symbol} के लिए एक intraday algo draft बना सकती हूँ। पहले मैं market trend, VWAP, "
            "volume और risk profile check करूँगी। यह live trade नहीं होगा। पहले paper test चलेगा। "
            "Trading में risk होता है और profit guaranteed नहीं है।"
        ),
        "or": (
            "ମୁଁ {symbol} ପାଇଁ ଏକ intraday algo draft ତିଆରି କରିପାରିବି। ପ୍ରଥମେ market trend, VWAP, "
            "volume ଏବଂ risk profile ଯାଞ୍ଚ କରିବି। ଏହା live trade ନୁହେଁ। ପ୍ରଥମେ paper test ଚାଲିବ।"
        ),
        "hinglish": (
            "Main {symbol} ke liye intraday algo draft bana sakti hoon. Pehle market trend, VWAP, "
            "volume aur risk profile check karungi. Yeh live trade nahi hoga. Pehle paper test chalega. "
            "Trading mein risk hota hai aur profit guaranteed nahi hai."
        ),
    },
    "portfolio_risk": {
        "en": (
            "I am checking your portfolio risk — holdings, open positions, sector exposure, "
            "margin usage and daily loss limit. This is risk analysis only; not trading advice."
        ),
        "hi": (
            "मैं आपके portfolio risk की जाँच कर रही हूँ — holdings, open positions, sector exposure, "
            "margin usage और daily loss limit। यह केवल risk analysis है; trading advice नहीं।"
        ),
        "or": (
            "ଆପଣଙ୍କ portfolio risk ମୁଁ ଯାଞ୍ଚ କରୁଛି। ମୁଁ holdings, open positions, sector exposure, "
            "margin usage ଏବଂ daily loss limit ଦେଖିବି। ଏହା କେବଳ risk analysis; ଏହା trading advice ନୁହେଁ।"
        ),
        "hinglish": (
            "Main aapke portfolio risk check kar rahi hoon — holdings, positions, sector exposure, "
            "margin aur daily loss limit. Yeh sirf risk analysis hai; trading advice nahi."
        ),
    },
    "order_preview": {
        "en": "I have prepared an order preview. Please review and approve. DhanLaxmi never places live orders without your confirmation, RMS, and OMS.",
        "hi": "मैंने order preview तैयार किया है। कृपया review करके approve करें। बिना आपकी अनुमति, RMS और OMS के धनलक्ष्मी live order नहीं लगाती।",
        "or": "ମୁଁ order preview ତିଆରି କରିଛି। ଦୟାକରି review କରି approve କରନ୍ତୁ।",
        "hinglish": "Maine order preview taiyar kiya hai. Please review karke approve karein. Bina approval ke live order nahi lagega.",
    },
    "paper_first": {
        "en": "Paper trading is the default. Live deployment needs paper qualification, risk disclosure, and explicit approval.",
        "hi": "डिफ़ॉल्ट paper trading है। Live के लिए paper qualification, risk disclosure और स्पष्ट approval ज़रूरी है।",
        "or": "ଡିଫଲ୍ଟ paper trading। Live ପାଇଁ paper qualification ଏବଂ ସ୍ପଷ୍ଟ approval ଦରକାର।",
        "hinglish": "Default paper trading hai. Live ke liye paper qualification aur explicit approval zaroori hai.",
    },
    "kill_switch_confirm": {
        "en": "This will stop all bots. Please confirm kill-switch activation.",
        "hi": "यह सभी bots रोक देगा। कृपया kill-switch की पुष्टि करें।",
        "or": "ଏହା ସମସ୍ତ bots ବନ୍ଦ କରିବ। ଦୟାକରି confirm କରନ୍ତୁ।",
        "hinglish": "Yeh sab bots rok dega. Please kill-switch confirm karein.",
    },
    "market_summary": {
        "en": "Here is a cautious market overview for today. Conditions can change quickly — verify live data before acting.",
        "hi": "आज का सावधान market overview। स्थितियाँ तेज़ी से बदल सकती हैं — कार्रवाई से पहले live data जाँचें।",
        "or": "ଆଜିର ସାବଧାନ market overview। ତଥ୍ୟ ଶୀଘ୍ର ବଦଳିପାରେ — କାର୍ୟ୍ୟ ପୂର୍ବରୁ live data ୟାଞ୍ଚ କରନ୍ତୁ।",
        "hinglish": "Aaj ka cautious market overview. Conditions jaldi change ho sakti hain — pehle live data check karein.",
        "bn": "আজকের সতর্ক বাজার পর্যালোচনা। পরিস্থিতি দ্রুত বদলাতে পারে — সিদ্ধান্তের আগে live data যাচাই করুন।",
        "te": "ఈరోజు జాగ్రత్తగా మార్కెట్ అవలోకనం. పరిస్థితులు త్వరగా మారవచ్చు — చర్యకు ముందు live data తనిఖీ చేయండి.",
        "ta": "இன்றைய எச்சரிக்கையான சந்தை மேலோட்டம். நிலைமை விரைவில் மாறலாம் — செயல்படும் முன் live data சரிபாரக்கவும்.",
        "kn": "ಇಂದಿನ ಎಚ್ಚರಿಕೆಯ ಮಾರುಕಟ್ಟೆ ಅವಲೋಕನ. ಪರಿಸ್ಥಿತಿ ಬೇಗ ಬದಲಾಗಬಹುದು — ಕ್ರಮಕ್ಕೂ ಮೊದಲು live data ಪರಿಶೀಲಿಸಿ.",
        "ml": "ഇന്നത്തെ ജാഗ്രതയുള്ള വിപണി അവലോകനം. സാഹചര്യം വേഗം മാറാം — പ്രവര്ത്തിക്കുന്നതിന് മുമ്പ് live data പരിശോധിക്കുക.",
        "mr": "आजचा सावध बाजार आढावा. परिस्थिती लवकर बदलू शकते — कृतीपूर्वी live data तपासा.",
        "gu": "આજનો સાવધાન માર્કેટ અવલોકન. પરિસ્થિતિ ઝડપથી બદલાઈ શકે — પગલાં પહેલાં live data ચકાસો.",
        "pa": "ਅੱਜ ਦਾ ਸਾਵਧਾਨ ਬਾਜ਼ਾਰ ਝਲਕ। ਹਾਲਾਤ ਜਲਦੀ ਬਦਲ ਸਕਦੇ ਹਨ — ਕਾਰਵਾਈ ਤੋਂ ਪਹਿਲਾਂ live data ਚੈੱਕ ਕਰੋ।",
        "as": "আজিৰ সাৱধান বজাৰ অৱলোকন। পৰিস্থিতি সোনকালে সলনি হ’ব পাৰে — সিদ্ধান্তৰ আগতে live data পৰীক্ষা কৰক।",
        "ur": "آج کا محتاط مارکیٹ جائزہ۔ حالات جلدی بدل سکتے ہیں — عمل سے پہلے live data چیک کریں۔",
    },
}


def get_template(template_type: str, language: str, **kwargs: Any) -> str:
    lang = (language or "en").lower()
    if lang == "hi-Latn" or lang == "hi_en":
        lang = "hinglish"
    bucket = TEMPLATES.get(template_type) or TEMPLATES["greeting"]
    text = bucket.get(lang) or bucket.get("en") or ""
    try:
        return text.format(**kwargs)
    except (KeyError, ValueError):
        return text


def get_disclaimer(language: str) -> str:
    lang = (language or "en").lower()
    return RISK_DISCLAIMER.get(lang) or RISK_DISCLAIMER["en"]


def build_response(
    template_type: str,
    language: str,
    *,
    action_summary: str | None = None,
    next_step: str | None = None,
    approval_status: str | None = None,
    **kwargs: Any,
) -> dict[str, str]:
    body = get_template(template_type, language, **kwargs)
    disclaimer = get_disclaimer(language)
    parts = [body]
    if action_summary:
        parts.append(action_summary)
    parts.append(disclaimer)
    if next_step:
        parts.append(next_step)
    if approval_status:
        parts.append(f"Approval status: {approval_status}")
    return {
        "text": " ".join(parts),
        "disclaimer": disclaimer,
        "language": language,
        "template_type": template_type,
    }
