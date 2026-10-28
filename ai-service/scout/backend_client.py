"""Authenticated read-only client for SmartEstate Spring Boot APIs."""
from __future__ import annotations
import time
import os
from typing import Any

import httpx


class BackendIntegrationError(Exception):
    """Safe, user-facing error from the SmartEstate backend integration."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _base_url() -> str:
    return os.getenv("SMART_ESTATE_BACKEND_URL", "http://localhost:8080").rstrip("/")



def _get(path: str, authorization: str) -> Any:
    """GET one backend resource while forwarding the caller's JWT."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise BackendIntegrationError(
            "Please sign in to SmartEstate before asking Scout for account information."
        )

    url = f"{_base_url()}{path}"
    started = time.perf_counter()

    print(f"[Scout Debug] Request started: GET {url}")

    try:
        response = httpx.get(
            url,
            headers={
                "Authorization": authorization,
                "Accept": "application/json",
            },
            timeout=httpx.Timeout(10.0, connect=3.0),
        )

        elapsed = time.perf_counter() - started
        print(
            f"[Scout Debug] Response received: "
            f"status={response.status_code}, elapsed={elapsed:.2f}s"
        )

    except httpx.TimeoutException as exc:
        elapsed = time.perf_counter() - started
        print(f"[Scout Debug] TIMEOUT after {elapsed:.2f}s for GET {url}")
        raise BackendIntegrationError(
            "SmartEstate took too long to respond. Please try again shortly."
        ) from exc

    except httpx.RequestError as exc:
        elapsed = time.perf_counter() - started
        print(
            f"[Scout Debug] CONNECTION ERROR after "
            f"{elapsed:.2f}s: {type(exc).__name__}"
        )
        raise BackendIntegrationError(
            "I couldn't connect to SmartEstate. Please check that the backend is running."
        ) from exc

    if response.status_code == 401:
        raise BackendIntegrationError(
            "Your SmartEstate session may have expired. Please sign in again.", 401
        )

    if response.status_code == 403:
        raise BackendIntegrationError(
            "Your account doesn't have permission to view this information.", 403
        )

    if response.status_code >= 400:
        raise BackendIntegrationError(
            "SmartEstate couldn't retrieve that information right now. Please try again later.",
            response.status_code,
        )

    try:
        return response.json()
    except ValueError as exc:
        raise BackendIntegrationError(
            "SmartEstate returned an unexpected response. Please try again later."
        ) from exc


def _as_list(value: Any, label: str) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        # Accommodate paginated/wrapped APIs without guessing arbitrary keys.
        for key in ("content", "items", "data", "results"):
            candidate = value.get(key)
            if isinstance(candidate, list):
                return [item for item in candidate if isinstance(item, dict)]
    raise BackendIntegrationError(
        f"SmartEstate returned an unexpected format for {label}."
    )


def get_rent_status(authorization: str) -> dict[str, Any]:
    invoices = _as_list(_get("/api/rent-invoices/my", authorization), "rent invoices")
    outstanding = []
    total_remaining = 0.0
    for invoice in invoices:
        try:
            remaining = float(invoice.get("remainingAmount") or 0)
        except (TypeError, ValueError):
            remaining = 0.0
        status = str(invoice.get("status") or "").upper()
        if remaining > 0 and status != "CANCELLED":
            outstanding.append(invoice)
            total_remaining += remaining

    return {
        "invoiceCount": len(invoices),
        "outstandingInvoiceCount": len(outstanding),
        "totalRemainingAmount": round(total_remaining, 2),
        "outstandingInvoices": outstanding,
        "invoices": invoices,
    }


def get_authenticated_tenant_profile(authorization: str) -> dict[str, Any]:
    """Return the tenant profile associated with the caller's JWT."""
    profile = _get("/api/tenants/me", authorization)

    if not isinstance(profile, dict) or profile.get("tenantId") is None:
        raise BackendIntegrationError(
            "I couldn't identify the tenant profile associated with your account."
        )

    return profile

def get_payment_history(authorization: str) -> dict[str, Any]:
    """Return the authenticated tenant's payments and invoice/property mapping."""
    # Resolve tenant ID from the authenticated profile; never trust a tenant ID
    # supplied in the chat message/request body for this lookup.
    profile = _get("/api/tenants/me", authorization)
    if not isinstance(profile, dict) or profile.get("tenantId") is None:
        raise BackendIntegrationError(
            "I couldn't identify the tenant profile associated with your account."
        )

    tenant_id = profile["tenantId"]
    payments = _as_list(
        _get(f"/api/payments/tenant/{tenant_id}", authorization), "payment history"
    )
    invoices = _as_list(
        _get("/api/rent-invoices/my", authorization), "rent invoices"
    )

    # Build a distinct list from invoices visible to this authenticated tenant.
    # Payments are matched to these invoices later using invoiceId.
    properties_by_id: dict[str, dict[str, Any]] = {}
    for invoice in invoices:
        property_id = invoice.get("propertyId")
        if property_id is None:
            continue
        property_key = str(property_id)
        property_name = str(invoice.get("propertyName") or "").strip()
        if property_key not in properties_by_id:
            properties_by_id[property_key] = {
                "propertyId": property_id,
                "propertyName": property_name or f"Property {property_id}",
            }

    return {
        "tenantId": tenant_id,
        "count": len(payments),
        "payments": payments,
        "invoices": invoices,
        "properties": list(properties_by_id.values()),
    }


def get_application_status(authorization: str) -> dict[str, Any]:
    applications = _as_list(
        _get("/api/rental-applications/my", authorization), "rental applications"
    )
    return {"count": len(applications), "applications": applications}


def get_maintenance_requests(authorization: str) -> dict[str, Any]:
    requests = _as_list(_get("/api/maintenance", authorization), "maintenance requests")
    return {"count": len(requests), "requests": requests}


def get_agreement_details(authorization: str) -> dict[str, Any]:
    agreements = _as_list(
        _get("/api/rental-agreements/my", authorization), "rental agreements"
    )
    return {"count": len(agreements), "agreements": agreements}
