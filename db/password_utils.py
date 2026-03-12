"""Password hashing utilities for secure credential storage.

This module provides functions to hash and verify passwords using bcrypt.
Install bcrypt with: pip install bcrypt
"""

try:
    import bcrypt
except ImportError:
    print("Warning: bcrypt not installed. Install with: pip install bcrypt")
    bcrypt = None


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
    password_bytes = password.encode('utf-8')
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
    
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    
    return bcrypt.checkpw(password_bytes, hashed_bytes)


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
