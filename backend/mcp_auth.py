"""Bearer-token verification for the MCP servers, against Kanidm.

Replaces the secret URL path that used to be the credential. A path is a bearer
token living in a URL: it leaks through history, screenshots and referrers,
never expires, and is shared rather than per-person. This validates a real
OAuth 2.1 access token instead.

Kanidm signs access tokens with ES256 (EC P-256) and publishes the public key at
the client's own jwks_uri, so verification is local — no introspection call, and
therefore no client secret needed for a public PKCE client.

Deliberately noisy on rejection: a token that fails validation logs *why*, plus
the claims it actually carried. A silent 401 during an OAuth handshake is close
to undebuggable from the client side, where all you see is "authentication
failed".

NOTE: a byte-identical twin of this file lives at grocy-pantry/mcp_auth.py in
the nixos-config repo, which serves the other MCP connector. The two servers
deploy from separate repos by different mechanisms, so this is copied rather
than shared — keep them in step, or neither connector's auth is trustworthy.
"""

import asyncio
import logging
import os

import jwt
from mcp.server.auth.provider import AccessToken, TokenVerifier

log = logging.getLogger(__name__)

# Kanidm's signing algorithm. Pinned rather than read from the token header:
# accepting whatever `alg` the token claims is the classic JWT confusion attack
# (most infamously `alg: none`).
ALGORITHMS = ["ES256"]

# Tolerance for clock skew between this box and Kanidm. They are the same
# machine today, so this is only insurance.
LEEWAY_SECONDS = 30


class KanidmTokenVerifier(TokenVerifier):
    """Validates a Kanidm-issued JWT access token offline against its JWKS."""

    def __init__(
        self,
        *,
        issuer: str,
        audience: str,
        jwks_uri: str,
        required_scopes: list[str] | None = None,
    ) -> None:
        self.issuer = issuer
        self.audience = audience
        self.required_scopes = set(required_scopes or [])
        # Caches keys in memory and only refetches when an unknown `kid` shows
        # up, so key rotation is picked up without a restart and the steady
        # state costs no network at all.
        self._jwks = jwt.PyJWKClient(jwks_uri, cache_keys=True, lifespan=3600)

    async def verify_token(self, token: str) -> AccessToken | None:
        # PyJWKClient does blocking HTTP on a cache miss. This runs inside the
        # server's event loop, so it has to go to a thread or a single cold
        # fetch stalls every other in-flight request.
        try:
            return await asyncio.to_thread(self._verify_sync, token)
        except Exception:
            log.exception("token verification raised unexpectedly; rejecting")
            return None

    def _verify_sync(self, token: str) -> AccessToken | None:
        try:
            signing_key = self._jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                signing_key,
                algorithms=ALGORITHMS,
                issuer=self.issuer,
                audience=self.audience,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "iss", "aud", "sub"]},
            )
        except jwt.PyJWTError as exc:
            log.warning("rejecting token: %s: %s", type(exc).__name__, exc)
            self._log_unverified_claims(token)
            return None

        # `scope` is a space-delimited string per RFC 8693. Kanidm has also been
        # seen to emit a `scopes` list, so accept either rather than failing shut
        # on a shape difference.
        raw = claims.get("scope") or claims.get("scopes") or ""
        scopes = raw.split() if isinstance(raw, str) else list(raw)

        missing = self.required_scopes - set(scopes)
        if missing:
            log.warning(
                "rejecting token for %s: missing scope(s) %s (had: %s)",
                claims.get("preferred_username") or claims.get("sub"),
                ", ".join(sorted(missing)),
                ", ".join(scopes) or "none",
            )
            return None

        return AccessToken(
            token=token,
            client_id=self.audience,
            scopes=scopes,
            expires_at=claims.get("exp"),
            subject=claims.get("sub"),
            claims=claims,
        )

    def _log_unverified_claims(self, token: str) -> None:
        """Show what the token actually said, to make a mismatch obvious.

        Signature-checked validation has already failed by this point, so these
        claims are untrusted and used for the log line only — never to make an
        access decision.
        """
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
        except Exception:
            log.warning("  (token is not a readable JWT at all)")
            return
        log.warning(
            "  token claimed iss=%r aud=%r sub=%r scope=%r; this server expects "
            "iss=%r aud=%r",
            unverified.get("iss"),
            unverified.get("aud"),
            unverified.get("sub"),
            unverified.get("scope") or unverified.get("scopes"),
            self.issuer,
            self.audience,
        )


def verifier_from_env(prefix: str, *, default_client_id: str) -> KanidmTokenVerifier:
    """Build a verifier from `<PREFIX>_OIDC_*` environment variables.

    Defaults are derived from the Kanidm issuer so that in practice only
    `<PREFIX>_OIDC_ISSUER` has to be set.
    """
    issuer = os.environ.get(
        f"{prefix}_OIDC_ISSUER",
        f"https://auth.anishsheela.com/oauth2/openid/{default_client_id}",
    ).rstrip("/")
    return KanidmTokenVerifier(
        issuer=issuer,
        # Kanidm sets the access token's `aud` to the client id.
        audience=os.environ.get(f"{prefix}_OIDC_AUDIENCE", default_client_id),
        jwks_uri=os.environ.get(f"{prefix}_OIDC_JWKS_URI", f"{issuer}/public_key.jwk"),
        required_scopes=os.environ.get(f"{prefix}_OIDC_SCOPES", "mcp").split(),
    )
