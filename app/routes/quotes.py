from fastapi import APIRouter
from app.services.ai_service import call_ai_service
from app.models import QuoteModel  # your ORM or Firebase wrapper

router = APIRouter()

@router.post("/create-quote")
def create_quote(quote_payload: dict):
    """
    Handles new quote creation.
    """

    # Step 1: Save quote to Firebase or DB
    quote_id = QuoteModel.save_quote(quote_payload)

    # Step 2: Prepare data for AI service
    quote_data = {
        "deal_value": quote_payload["deal_value"],
        "hospital": quote_payload["hospital"],
        "instrument_category": quote_payload["instrument_category"],
        "configuration_complexity": quote_payload["configuration_complexity"],
        "items": quote_payload.get("items", [])
    }

    historical_context = {
        "avg_winning_price": 100000,        # Example: calculate from your DB or Firebase
        "similar_quotes_won": 12,
        "similar_quotes_lost": 3
    }

    # Step 3: Call AI service
    ai_result = call_ai_service(quote_data, historical_context)

    # Step 4: Save AI result along with quote
    QuoteModel.update_quote_with_ai(quote_id, ai_result)

    # Step 5: Return combined response
    return {
        "quote_id": quote_id,
        "ai_analysis": ai_result
    }
