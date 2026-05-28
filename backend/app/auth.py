import httpx
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import settings

security = HTTPBearer()

_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
            )
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")

        jwks = await _get_jwks()
        key = next((k for k in jwks["keys"] if k.get("kid") == kid), None)
        if key is None:
            # Kid not found — bust cache and retry once (key rotation)
            global _jwks_cache
            _jwks_cache = None
            jwks = await _get_jwks()
            key = next((k for k in jwks["keys"] if k.get("kid") == kid), None)
        if key is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Use the algorithm declared by the JWKS key itself, not the token header
        alg = key.get("alg", "RS256")
        payload = jwt.decode(
            token, key, algorithms=[alg], options={"verify_aud": False}
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
