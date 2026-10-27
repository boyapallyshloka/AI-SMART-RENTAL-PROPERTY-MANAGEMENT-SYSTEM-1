import re
from scout.intent import ScoutOperation, ScoutIntent, detect_intent
from scout.backend_client import (
    BackendIntegrationError,
    get_authenticated_tenant_profile,
    get_agreement_details,
    get_application_status,
    get_maintenance_requests,
    get_payment_history,
    get_rent_status,
)

# Keep the existing M2 integration unchanged.
from M2_Property_Recommendation.service import generate_recommendations


def _format_backend_result(operation: ScoutOperation, data: dict) -> str:
    if operation == ScoutOperation.TENANT_PROFILE:
        return (
            "Here is the tenant profile associated "
            "with your authenticated account."
        )

    if operation == ScoutOperation.RENT_STATUS:
        count = data.get("outstandingInvoiceCount", 0)
        amount = data.get("totalRemainingAmount", 0.0)

        if count == 0:
            return "You have no outstanding rent invoices according to SmartEstate."

        return (
            f"You have {count} outstanding rent invoice(s), with "
            f"₹{amount:,.2f} remaining in total."
        )

    if operation == ScoutOperation.PAYMENT_HISTORY:
        return (
            f"I found {data.get('count', 0)} payment record(s) "
            "in your SmartEstate account."
        )

    if operation == ScoutOperation.APPLICATION_STATUS:
        return (
            f"I found {data.get('count', 0)} rental application(s) "
            "associated with your account."
        )

    if operation == ScoutOperation.MAINTENANCE_REQUESTS:
        return (
            f"I found {data.get('count', 0)} maintenance request(s) "
            "available for your account."
        )

    if operation == ScoutOperation.AGREEMENT_DETAILS:
        return (
            f"I found {data.get('count', 0)} rental agreement(s) "
            "associated with your account."
        )

    return "I retrieved the requested information from SmartEstate."


def _format_payment_history(message: str, data: dict) -> tuple[str, dict]:
    """List a tenant's properties first, then show payments for the selected property."""
    text = " ".join(message.lower().replace("?", "").split())
    invoices = data.get("invoices", []) or []
    payments = data.get("payments", []) or []
    properties = data.get("properties", []) or []

    # If the backend client provides invoices but no separate property list,
    # derive the distinct property list from those tenant-scoped invoices.
    if not properties:
        unique_properties = {}
        for invoice in invoices:
            property_id = invoice.get("propertyId")
            if property_id is None:
                continue
            unique_properties[str(property_id)] = {
                "propertyId": property_id,
                "propertyName": invoice.get("propertyName") or f"Property {property_id}",
            }
        properties = list(unique_properties.values())

    # Match an explicit property ID only if it belongs to this tenant's property list.
    id_match = re.search(
        r"\b(?:property\s*(?:id)?\s*[:#]?\s*)?(\d+)\b",
        text,
    )
    selected_property = None
    if id_match:
        selected_property = next(
            (
                prop for prop in properties
                if str(prop.get("propertyId")) == id_match.group(1)
            ),
            None,
        )

    # Otherwise match a property name returned by the backend.
    if selected_property is None:
        for prop in sorted(
            properties,
            key=lambda item: len(str(item.get("propertyName") or "")),
            reverse=True,
        ):
            name = str(prop.get("propertyName") or "").strip()
            if name and name.lower() in text:
                selected_property = prop
                break

    if selected_property is None:
        if not properties:
            prompt = (
                "I couldn't find any properties linked to your payment history. "
                "Please check that the backend client returns your invoices with "
                "propertyId and propertyName."
            )
            return prompt, {
                "success": True,
                "properties": [],
                "count": 0,
                "payments": [],
                "selectionRequired": False,
            }

        property_lines = [
            f"{index}. {prop.get('propertyName')} "
            f"(Property ID: {prop.get('propertyId')})"
            for index, prop in enumerate(properties, start=1)
        ]
        prompt = (
            "Which property's payment history would you like to see? "
            "Reply with 'Show payments for [property name]' or 'Show payments "
            f"for property ID {properties[0].get('propertyId')}'.\n"
            + "\n".join(property_lines)
        )
        return prompt, {
            "success": True,
            "properties": properties,
            "count": len(properties),
            "payments": [],
            "selectionRequired": True,
        }

    property_id = str(selected_property.get("propertyId"))
    invoice_ids = {
        str(invoice.get("invoiceId"))
        for invoice in invoices
        if str(invoice.get("propertyId")) == property_id
        and invoice.get("invoiceId") is not None
    }
    property_payments = [
        payment for payment in payments
        if payment.get("invoiceId") is not None
        and str(payment.get("invoiceId")) in invoice_ids
    ]

    # Return user-facing fields only; do not expose payment gateway identifiers.
    safe_payments = [
        {
            key: payment.get(key)
            for key in (
                "paymentId", "invoiceId", "amount", "paymentStatus",
                "paymentMethod", "paymentDate", "createdAt",
            )
            if key in payment
        }
        for payment in property_payments
    ]

    successful_total = round(
        sum(
            float(payment.get("amount") or 0)
            for payment in property_payments
            if str(payment.get("paymentStatus") or "").upper() == "SUCCESS"
        ),
        2,
    )
    pending_count = sum(
        1 for payment in property_payments
        if str(payment.get("paymentStatus") or "").upper() == "PENDING"
    )

    property_name = selected_property.get("propertyName") or f"Property {property_id}"
    if not safe_payments:
        response = f"I couldn't find payment records for {property_name}."
    else:
        response = (
            f"Here are the {len(safe_payments)} payment record(s) for {property_name}. "
            f"Successful payments total ₹{successful_total:,.2f}; "
            f"{pending_count} payment(s) are pending."
        )

    if any(phrase in text for phrase in (
        "how much have i paid",
        "total paid",
        "amount paid",
        "how much did i pay",
    )):
        response = (
            f"You have successfully paid ₹{successful_total:,.2f} "
            f"for {property_name}."
        )

    return response, {
        "success": True,
        "selectedProperty": selected_property,
        "propertyId": selected_property.get("propertyId"),
        "propertyName": property_name,
        "count": len(safe_payments),
        "successfulPaymentTotal": successful_total,
        "pendingPaymentCount": pending_count,
        "payments": safe_payments,
    }


def _filter_requested_fields(
    operation: ScoutOperation,
    message: str,
    data: dict,
) -> tuple[str, dict]:
    """Return a safe, minimal response for supported field requests."""
    text = " ".join(message.lower().replace("?", "").split())

    # Map supported profile fields to their actual backend JSON keys.
    # Longer/more specific phrases are checked before shorter ones.
    profile_fields = {
        "alternatePhone": (
            "alternate phone number",
            "alternate phone",
            "secondary phone",
        ),
        "phone": (
            "phone number",
            "mobile number",
            "mobile",
            "phone",
        ),
        "email": (
            "email address",
            "email",
            "mail id",
        ),
        "firstName": ("first name",),
        "lastName": ("last name",),
        "tenantId": ("tenant id", "tenant identifier"),
        "city": ("my city", "which city"),
        "occupation": ("my occupation", "my job"),
    }

    if operation == ScoutOperation.TENANT_PROFILE:
        # Full name is a combination of two actual profile fields.
        if any(phrase in text for phrase in (
            "full name",
            "what is my name",
            "what's my name",
            "what is my full name",
        )):
            full_name = " ".join(
                part for part in (
                    str(data.get("firstName") or "").strip(),
                    str(data.get("lastName") or "").strip(),
                ) if part
            )

            if not full_name:
                return (
                    "Your name is not available in your profile.",
                    {"success": True, "fullName": None},
                )

            return (
                f"Your name is {full_name}.",
                {"success": True, "fullName": full_name},
            )

        for field, phrases in profile_fields.items():
            if any(phrase in text for phrase in phrases):
                value = data.get(field)

                if value is None or value == "":
                    return (
                        f"Your {field} is not available in your profile.",
                        {"success": True, field: None},
                    )

                return (
                    f"Your {field} is {value}.",
                    {"success": True, field: value},
                )

        prompt = (
            "Which profile detail would you like to know? "
            "For example, your phone number, email, name, or tenant ID."
        )
        return prompt, {"success": True, "message": prompt}

    if operation == ScoutOperation.RENT_STATUS:
        invoices = data.get("invoices", [])
        outstanding = data.get("outstandingInvoices", [])

        # Count only outstanding invoices.
        if any(phrase in text for phrase in (
            "how many outstanding",
            "number of outstanding",
            "outstanding invoice count",
            "how many unpaid invoices",
            "how many unpaid rent invoices",
            "number of unpaid rent invoices",
            "count of unpaid rent invoices",
        )):
            count = data.get("outstandingInvoiceCount", 0)
            return (
                f"You have {count} outstanding rent invoice(s).",
                {"success": True, "outstandingInvoiceCount": count},
            )

        # Return due dates from outstanding invoices only.
        if any(phrase in text for phrase in (
            "due date",
            "when is my rent due",
            "when is rent due",
            "when do i need to pay",
            "when should i pay",
        )):
            dates = sorted({
                str(invoice["dueDate"])
                for invoice in outstanding
                if invoice.get("dueDate")
            })

            if not dates:
                return (
                    "No due dates are available for outstanding rent invoices.",
                    {"success": True, "dueDates": []},
                )

            return (
                "Your outstanding rent invoice due date(s): "
                + ", ".join(dates) + ".",
                {"success": True, "dueDates": dates},
            )

        # Return only the total balance, not the invoice objects.
        if any(phrase in text for phrase in (
            "owe",
            "outstanding rent",
            "outstanding amount",
            "remaining amount",
            "rent balance",
            "balance due",
            "how much is unpaid",
            "how much do i need to pay",
            "rent do i owe",
        )):
            amount = data.get("totalRemainingAmount", 0.0)
            return (
                f"Your total outstanding rent is ₹{amount:,.2f}.",
                {"success": True, "totalRemainingAmount": amount},
            )

        if any(phrase in text for phrase in (
            "how much have i paid",
            "total paid",
            "amount paid",
        )):
            total_paid = round(
                sum(
                    float(invoice.get("totalPaid") or 0)
                    for invoice in invoices
                ),
                2,
            )
            return (
                f"Your recorded payments total ₹{total_paid:,.2f}.",
                {"success": True, "totalPaid": total_paid},
            )

        if "invoice status" in text or "status of my invoices" in text:
            statuses = [
                {"status": invoice["status"]}
                for invoice in invoices
                if invoice.get("status")
            ]
            if not statuses:
                return (
                    "No invoice statuses are available.",
                    {"success": True, "invoiceStatuses": []},
                )

            return (
                "Your invoice statuses: "
                + ", ".join(item["status"] for item in statuses) + ".",
                {"success": True, "invoiceStatuses": statuses},
            )

        if "rent amount" in text or "monthly rent" in text:
            amounts = sorted({
                float(invoice["rentAmount"])
                for invoice in invoices
                if invoice.get("rentAmount") is not None
            })

            if not amounts:
                return (
                    "No rent amounts are available.",
                    {"success": True, "rentAmounts": []},
                )

            return (
                "Recorded rent amount(s): "
                + ", ".join(f"₹{amount:,.2f}" for amount in amounts) + ".",
                {"success": True, "rentAmounts": amounts},
            )

        # A general rent-status question gets a safe summary.
        count = data.get("outstandingInvoiceCount", 0)
        amount = data.get("totalRemainingAmount", 0.0)

        if count == 0:
            response = "You have no outstanding rent invoices."
        else:
            response = (
                f"You have {count} outstanding rent invoice(s), "
                f"with ₹{amount:,.2f} remaining in total."
            )

        return (
            response,
            {
                "success": True,
                "outstandingInvoiceCount": count,
                "totalRemainingAmount": amount,
            },
        )

    if operation == ScoutOperation.PAYMENT_HISTORY:
        return _format_payment_history(message, data)

    # Other operations retain their existing formatter for now.
    return _format_backend_result(operation, data), data


def process_message(
    message: str,
    tenant_id: str | None = None,
    authorization: str | None = None,
) -> tuple[str, ScoutIntent, dict | None]:
    intent = detect_intent(message)

    # tenant_id is retained for M2 only.
    # Authenticated backend operations use the caller's JWT.
    if (
        tenant_id is not None
        and intent.operation in {
            ScoutOperation.PROPERTY_SEARCH,
            ScoutOperation.PROPERTY_RECOMMENDATION,
        }
    ):
        intent.parameters["tenant_id"] = tenant_id

    data = None

    backend_handlers = {
        ScoutOperation.RENT_STATUS: get_rent_status,
        ScoutOperation.PAYMENT_HISTORY: get_payment_history,
        ScoutOperation.APPLICATION_STATUS: get_application_status,
        ScoutOperation.MAINTENANCE_REQUESTS: get_maintenance_requests,
        ScoutOperation.AGREEMENT_DETAILS: get_agreement_details,
        ScoutOperation.TENANT_PROFILE: get_authenticated_tenant_profile,
    }

    if intent.operation in backend_handlers:
        try:
            data = backend_handlers[intent.operation](authorization or "")

            if intent.operation in {
                ScoutOperation.TENANT_PROFILE,
                ScoutOperation.RENT_STATUS,
                ScoutOperation.PAYMENT_HISTORY,
            }:
                response, data = _filter_requested_fields(
                    intent.operation,
                    message,
                    data,
                )
            else:
                response = _format_backend_result(intent.operation, data)

        except BackendIntegrationError as exc:
            response = str(exc)
            data = {
                "success": False,
                "message": str(exc),
                "statusCode": exc.status_code,
            }

    elif intent.operation in {
        ScoutOperation.PROPERTY_SEARCH,
        ScoutOperation.PROPERTY_RECOMMENDATION,
    }:
        tenant_id_value = intent.parameters.get("tenant_id")

        if not tenant_id_value:
            response = (
                "Tenant ID is required to search for properties."
                if intent.operation == ScoutOperation.PROPERTY_SEARCH
                else "Tenant ID is required for property recommendations."
            )
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

                if intent.operation == ScoutOperation.PROPERTY_SEARCH:
                    response = (
                        f"I found {data.get('count', 0)} properties "
                        "based on your preferences."
                    )
                else:
                    response = (
                        f"I found {data.get('count', 0)} property "
                        "recommendations based on your preferences."
                    )

            except ValueError as exc:
                response = str(exc)
                data = {"success": False, "message": str(exc)}
            except Exception:
                response = "Unable to get property recommendations right now."
                data = {"success": False, "message": response}

    elif intent.operation == ScoutOperation.RENT_PREDICTION:
        response = (
            "Rent prediction will be connected in the AI-module integration phase."
        )
    elif intent.operation == ScoutOperation.RENTAL_DEMAND:
        response = (
            "Rental demand prediction will be connected in the AI-module integration phase."
        )
    elif intent.operation == ScoutOperation.PAYMENT_RISK:
        response = (
            "Payment-risk analysis will be connected in the AI-module integration phase."
        )
    elif intent.operation == ScoutOperation.PREDICTIVE_MAINTENANCE:
        response = (
            "Predictive maintenance will be connected in the AI-module integration phase."
        )
    elif intent.operation == ScoutOperation.PROFITABILITY:
        response = (
            "Property profitability will be connected in the AI-module integration phase."
        )
    else:
        response = (
            "I can help with SmartEstate rent, payment, application, "
            "maintenance and agreement information."
        )

    return response, intent, data
