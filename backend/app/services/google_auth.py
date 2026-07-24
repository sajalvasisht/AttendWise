from jose import jwt
import time
import httpx
from app.core.config import settings
from fastapi import HTTPException, status

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_google_certs_cache = None
_google_certs_expiry = 0

def get_google_public_keys():
    global _google_certs_cache, _google_certs_expiry
    now = time.time()
    if _google_certs_cache and _google_certs_expiry > now:
        return _google_certs_cache
    
    try:
        response = httpx.get(GOOGLE_CERTS_URL, timeout=5.0)
        if response.status_code == 200:
            _google_certs_cache = response.json()
            _google_certs_expiry = now + 3600
            return _google_certs_cache
    except Exception:
        pass
    
    return _google_certs_cache

def verify_google_token(id_token: str) -> dict:
    # Check if mock/testing token (ONLY allowed if settings.DEBUG is True)
    if id_token.startswith("mock-") or "@" in id_token:
        if not settings.DEBUG:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Mock Google Sign-In is not allowed in production."
            )
        email = id_token.replace("mock-", "") if "@" in id_token else "mock-user@gmail.com"
        name = email.split("@")[0].capitalize()
        return {
            "email": email,
            "name": name,
            "sub": f"google-sub-{email}",
            "picture": "https://lh3.googleusercontent.com/a/default-user"
        }

    try:
        # Decode claims without verification first to get context
        unverified_payload = jwt.get_unverified_claims(id_token)
        
        # Verify issuer
        iss = unverified_payload.get("iss")
        if iss not in ("accounts.google.com", "https://accounts.google.com"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer"
            )
            
        # Verify expiry
        exp = unverified_payload.get("exp")
        if not exp or exp < time.time():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google token has expired"
            )
            
        # Verify audience (if client ID is set)
        aud = unverified_payload.get("aud")
        if settings.GOOGLE_CLIENT_ID and aud != settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token audience mismatch"
            )

        # Cryptographic Signature Verification
        certs = get_google_public_keys()
        verified = False
        
        if certs:
            try:
                jwt.decode(id_token, certs, algorithms=["RS256"], audience=settings.GOOGLE_CLIENT_ID)
                verified = True
            except Exception:
                pass
        
        if not verified:
            if settings.DEBUG:
                # Debug logging fallback
                pass
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Cryptographic verification of Google ID token signature failed."
                )

        return {
            "email": unverified_payload.get("email"),
            "name": unverified_payload.get("name"),
            "sub": unverified_payload.get("sub"),
            "picture": unverified_payload.get("picture")
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to verify Google Token: {str(e)}"
        )
