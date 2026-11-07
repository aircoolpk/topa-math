import hashlib
import hmac
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import HTTPException

from app.core.config import get_settings
from app.models.payment_integration import MppTestTransaction


def staging_settings():
    settings = get_settings()
    if settings.environment.lower() in {"production", "prod"}:
        raise HTTPException(403, "MPP UAT is disabled in production")
    pair = (settings.mpp_api_base_url.rstrip("/"), settings.mpp_payment_base_url.rstrip("/"))
    if pair not in {("https://staging-api.mmerchat.cc/api/v1", "https://staging-pay.mmerchat.cc"), ("https://staging-api.mmerchant.cc/api/v1", "https://staging-pay.mmerchant.cc")}:
        raise HTTPException(403, "MPP UAT requires the staging hosts")
    return settings


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def mpp_request(method: str, path: str, payload=None, *, key=None):
    settings = staging_settings()
    headers = {"Content-Type": "application/json"}
    if method == "POST":
        if not settings.mpp_project_api_key:
            raise HTTPException(503, "MPP_PROJECT_API_KEY is not configured")
        headers["X-API-Key"] = settings.mpp_project_api_key
        headers["Idempotency-Key"] = key
    request = Request(settings.mpp_api_base_url.rstrip("/") + path, data=json.dumps(payload).encode() if payload is not None else None, headers=headers, method=method)
    try:
        with build_opener(NoRedirect()).open(request, timeout=10) as response:
            result = json.loads(response.read(262145))
        if not isinstance(result, dict):
            raise ValueError("Invalid object")
        return result
    except HTTPError as exc:
        raise HTTPException(502, f"MPP staging returned HTTP {exc.code}") from None
    except (URLError, TimeoutError, ValueError, OSError):
        raise HTTPException(502, "MPP staging request failed or timed out") from None


SAFE_FIELDS = {"payment_id", "merchant_order_id", "amount", "currency", "status", "public_id", "event_id", "event_type"}


def sanitized(data):
    return {key: value for key, value in data.items() if key in SAFE_FIELDS and isinstance(value, (str, int, bool, type(None))) and len(str(value)) <= 200}


def check(row, name, action, expected, actual, passed, response=None):
    row.checks = {**(row.checks or {}), name: {"state": "PASS" if passed else "FAIL", "action": action, "expected": expected, "actual": actual, "response": sanitized(response or {})}}


def payment_payload(row):
    return {"merchant_order_id": row.merchant_order_id, "amount": row.amount, "currency": "THB", "description": "TOPAMath staging UAT", "metadata": {"topa_test_transaction_id": row.id, "uat": True}}


def payment_matches(row, data):
    return data.get("merchant_order_id") == row.merchant_order_id and type(data.get("amount")) is int and data["amount"] == row.amount and data.get("currency") == "THB"


def create_payment(row, retry=False):
    result = mpp_request("POST", "/payments", payment_payload(row), key=row.idempotency_key)
    url = result.get("payment_session_url", "")
    parsed = urlsplit(url)
    valid_url = parsed.scheme == "https" and parsed.netloc == "staging-pay.mmerchat.cc" and not parsed.username and not parsed.password
    valid = payment_matches(row, result) and isinstance(result.get("payment_id"), str) and bool(result["payment_id"]) and isinstance(result.get("payment_session_token"), str) and bool(result["payment_session_token"]) and valid_url
    same = not row.payment_id or result.get("payment_id") == row.payment_id
    passed = valid and same
    name = "idempotency" if retry else "payment"
    check(row, name, "POST /payments (same body + Idempotency-Key)" if retry else "POST /payments", "Same payment ID; no duplicate" if retry else "1500 satang; staging session created", "Payment matched" if passed else "Response identity, amount or session mismatch", passed, result)
    if passed:
        row.payment_id = result["payment_id"]
        row.payment_session_token = result["payment_session_token"]
        row.payment_session_url = url
        if row.status != "PAID":
            row.remote_status = result.get("status")
    return passed


def recheck(row):
    if row.kind == "payment":
        if not row.payment_session_token:
            raise HTTPException(409, "Create payment first")
        result = mpp_request("GET", "/pay/" + quote(row.payment_session_token, safe=""))
        valid = payment_matches(row, result) and result.get("payment_id") == row.payment_id
    else:
        if not row.withdrawal_id or not row.status_token:
            raise HTTPException(409, "Create withdrawal first")
        result = mpp_request("GET", "/withdrawals/status/" + quote(row.withdrawal_id, safe="") + "?" + urlencode({"token": row.status_token}))
        valid = result.get("public_id", result.get("withdrawal_id")) == row.withdrawal_id and type(result.get("amount")) is int and result["amount"] == row.amount and result.get("currency") == "THB"
    check(row, "recheck", "GET public status (token kept server-side)", "Identity and amount match", "Status matched" if valid else "Status response mismatch", valid, result)
    if valid:
        remote = str(result.get("status", ""))
        if row.status != "PAID":
            row.remote_status = remote
        if remote.upper() in {"CONFIRMED", "PAID"}:
            row.status = "PAID"


def verify_signature(raw, signature):
    secret = staging_settings().mpp_webhook_signing_secret
    if not secret:
        raise HTTPException(503, "MPP_WEBHOOK_SIGNING_SECRET is not configured")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    supplied = (signature or "").removeprefix("sha256=")
    if not re.fullmatch(r"[0-9a-f]{64}", supplied) or not hmac.compare_digest(expected, supplied):
        raise HTTPException(401, "Invalid webhook signature")


def view(row):
    return {"id": row.id, "kind": row.kind, "merchant_order_id": row.merchant_order_id, "amount": row.amount, "status": row.status, "payment_id": row.payment_id, "withdrawal_id": row.withdrawal_id, "remote_status": row.remote_status, "hosted_payment_ready": bool(row.payment_session_url), "checks": row.checks}
