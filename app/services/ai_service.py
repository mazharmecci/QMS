import requests

def call_ai_service(quote_data: dict, historical_context: dict) -> dict:
    """
    Calls the AI service to analyze a quote.

    Returns a dict with:
    - win_probability
    - pricing_risk
    - key_risks
    - recommended_focus
    """
    url = "http://ai.istosmedical.com:8001/analyze-quote"  # Use your AI service URL
    payload = {
        "quote": quote_data,
        "historical_context": historical_context
    }

    try:
        response = requests.post(url, json=payload, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"[AI Service Error] {e}")
        return {
            "win_probability": None,
            "pricing_risk": "Unknown",
            "key_risks": [],
            "recommended_focus": ""
        }
