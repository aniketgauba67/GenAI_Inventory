"""Password hashing utilities for secure credential storage.

This module provides functions to hash and verify passwords using bcrypt.
Install bcrypt with: pip install bcrypt
"""

import hashlib

try:
    import bcrypt
except ImportError:
    print("Warning: bcrypt not installed. Install with: pip install bcrypt")
    bcrypt = None


def _normalized_password_bytes(password: str) -> bytes:
    """Return bcrypt-safe bytes for new hashes.

    bcrypt only accepts inputs up to 72 bytes. For longer passwords we hash the
    UTF-8 bytes with SHA-256 and bcrypt the tagged digest instead.
    """
    raw = password.encode("utf-8")
    if len(raw) <= 72:
        return raw
    return b"sha256$" + hashlib.sha256(raw).digest()


def _verification_candidates(password: str) -> list[bytes]:
    """Return candidate byte sequences for bcrypt verification.

    Order matters:
    1. raw bytes (short passwords)
    2. truncated raw bytes (legacy compatibility for old bcrypt behavior)
    3. normalized bytes (new long-password scheme)
    """
    raw = password.encode("utf-8")
    if len(raw) <= 72:
        return [raw]
    return [raw[:72], _normalized_password_bytes(password)]


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password to hash
        
    Returns:
        Hashed password as a string
        
    Raises:
        ImportError: If bcrypt is not installed
    """
    if bcrypt is None:
        raise ImportError("bcrypt is required. Install with: pip install bcrypt")
    
    # Generate salt and hash password
    password_bytes = _normalized_password_bytes(password)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    
    # Return as string for storage in database
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hashed password.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password from database
        
    Returns:
        True if password matches, False otherwise
        
    Raises:
        ImportError: If bcrypt is not installed
    """
    if bcrypt is None:
        raise ImportError("bcrypt is required. Install with: pip install bcrypt")
    
    hashed_bytes = hashed_password.encode('utf-8')

    for candidate in _verification_candidates(plain_password):
        if bcrypt.checkpw(candidate, hashed_bytes):
            return True
    return False


if __name__ == "__main__":
    # Example usage
    print("=== Password Hashing Demo ===\n")
    
    # Hash a password
    test_password = "my_secure_password123"
    print(f"Original password: {test_password}")
    
    hashed = hash_password(test_password)
    print(f"Hashed password: {hashed}\n")
    
    # Verify correct password
    is_valid = verify_password(test_password, hashed)
    print(f"Verification with correct password: {is_valid}")
    
    # Verify incorrect password
    is_valid = verify_password("wrong_password", hashed)
    print(f"Verification with wrong password: {is_valid}")
