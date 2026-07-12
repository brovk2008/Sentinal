"""
auth.py — Catalyst Auth proxy router
Allows the frontend on a custom domain (onslate.in) to verify the current user
by routing the request through the AppSail backend, which has access to the
Catalyst session via server-side SDK.
"""
from fastapi import APIRouter, Request, Response
import httpx
import os

router = APIRouter()

# The Catalyst serverless base URL — used to forward auth check requests
CATALYST_SERVERLESS = "https://sentinal-60073535541.development.catalystserverless.in"

@router.get("/whoami")
async def whoami(request: Request):
    """
    Proxy the Catalyst /baas/v1/project/.../project-user/current call.
    The frontend on a custom domain sends the request here; we forward
    it to the Catalyst serverless domain including all cookies/headers
    so the session is correctly resolved server-side.
    """
    PROJECT_ID = "50170000000065001"
    target_url = f"{CATALYST_SERVERLESS}/baas/v1/project/{PROJECT_ID}/project-user/current"

    # Forward the original cookies and headers from the browser
    forward_headers = {}
    for key, value in request.headers.items():
        lk = key.lower()
        if lk in ("cookie", "authorization", "x-zcsrf-token", "user-agent", "x-requested-with"):
            forward_headers[key] = value

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(target_url, headers=forward_headers)
            data = resp.json()

        if resp.status_code != 200 or not data:
            return Response(
                content='{"status":401,"error":"Not authenticated"}',
                status_code=401,
                media_type="application/json",
            )

        content = data.get("content") or data.get("data") or data
        if not content or content == data and resp.status_code != 200:
            return Response(
                content='{"status":401,"error":"Not authenticated"}',
                status_code=401,
                media_type="application/json",
            )

        return {
            "status": 200,
            "user": {
                "user_id": content.get("user_id") or content.get("userid") or content.get("zuid") or "",
                "email_id": content.get("email_id") or content.get("emailid") or "",
                "first_name": content.get("first_name") or content.get("firstname") or "",
                "last_name": content.get("last_name") or content.get("lastname") or "",
                "role": (content.get("role_details") or {}).get("role_name") or content.get("user_type") or "officer",
            }
        }

    except Exception as e:
        return Response(
            content=f'{{"status":503,"error":"Auth proxy error: {str(e)}"}}',
            status_code=503,
            media_type="application/json",
        )


@router.get("/ping")
async def ping():
    return {"status": "ok", "service": "auth-proxy"}
