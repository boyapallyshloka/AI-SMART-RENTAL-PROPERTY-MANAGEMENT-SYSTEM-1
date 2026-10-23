from scout.intent import ScoutOperation, ScoutIntent, detect_intent

from M2_Property_Recommendation.service import generate_recommendations


def process_message(
    message: str,
    tenant_id: str | None = None
) -> tuple[str, ScoutIntent, dict | None]:

    intent = detect_intent(message)

    # Add authenticated tenant ID to the intent
    if tenant_id is not None:
        intent.parameters["tenant_id"] = tenant_id

    data = None

    if intent.operation == ScoutOperation.RENT_STATUS:
        response = "You are asking about your rent payment status."

    elif intent.operation == ScoutOperation.PAYMENT_HISTORY:
        response = "You are asking about your payment history."

    elif intent.operation == ScoutOperation.APPLICATION_STATUS:
        response = "You are asking about your application status."

    elif intent.operation == ScoutOperation.MAINTENANCE_REQUESTS:
        response = "You are asking about maintenance requests."

    elif intent.operation == ScoutOperation.AGREEMENT_DETAILS:
        response = "You are asking about your rental agreement or lease."

    elif intent.operation == ScoutOperation.PROPERTY_SEARCH:
        tenant_id_value = intent.parameters.get("tenant_id")

        if not tenant_id_value:
            response = "Tenant ID is required to search for properties."
        else:
            try:
                data = generate_recommendations(
                    tenant_id=tenant_id_value,
                    top_n=int(intent.parameters.get("top_n", 5)),
                    preferred_city=intent.parameters.get("preferred_city"),
                    max_budget=intent.parameters.get("max_budget"),
                    min_bedrooms=intent.parameters.get("min_bedrooms"),
                    property_type=intent.parameters.get("property_type"),
                    furnishing=intent.parameters.get("furnishing"),
                    parking=intent.parameters.get("parking"),
                    amenities=intent.parameters.get("amenities"),
                    max_distance=intent.parameters.get("max_distance"),
                )

                response = (
                    f"I found {data.get('count', 0)} properties "
                    "based on your preferences."
                )

            except ValueError as exc:
                response = str(exc)
                data = {
                    "success": False,
                    "message": str(exc)
                }

            except Exception as exc:
                response = "Unable to get property recommendations."
                data = {
                    "success": False,
                    "message": str(exc)
                }

    elif intent.operation == ScoutOperation.PROPERTY_RECOMMENDATION:
        tenant_id_value = intent.parameters.get("tenant_id")

        if not tenant_id_value:
            response = "Tenant ID is required for property recommendations."
        else:
            try:
                data = generate_recommendations(
                    tenant_id=tenant_id_value,
                    top_n=int(intent.parameters.get("top_n", 5)),
                    preferred_city=intent.parameters.get("preferred_city"),
                    max_budget=intent.parameters.get("max_budget"),
                    min_bedrooms=intent.parameters.get("min_bedrooms"),
                    property_type=intent.parameters.get("property_type"),
                    furnishing=intent.parameters.get("furnishing"),
                    parking=intent.parameters.get("parking"),
                    amenities=intent.parameters.get("amenities"),
                    max_distance=intent.parameters.get("max_distance"),
                )

                response = (
                    f"I found {data.get('count', 0)} "
                    "property recommendations "
                    "based on your preferences."
                )

            except ValueError as exc:
                response = str(exc)
                data = {
                    "success": False,
                    "message": str(exc)
                }

            except Exception as exc:
                response = "Unable to get property recommendations."
                data = {
                    "success": False,
                    "message": str(exc)
                }

    elif intent.operation == ScoutOperation.RENT_PREDICTION:
        response = "You are asking for a rent prediction."

    elif intent.operation == ScoutOperation.RENTAL_DEMAND:
        response = "You are asking about rental demand."

    elif intent.operation == ScoutOperation.PAYMENT_RISK:
        response = "You are asking about payment risk."

    elif intent.operation == ScoutOperation.PREDICTIVE_MAINTENANCE:
        response = "You are asking about predictive maintenance."

    elif intent.operation == ScoutOperation.PROFITABILITY:
        response = "You are asking about property profitability."

    else:
        response = "I can help you with rental and property-related questions."

    return response, intent, data