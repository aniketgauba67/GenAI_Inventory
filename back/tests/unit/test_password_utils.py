"""Unit tests for db/password_utils.py — bcrypt hashing utilities."""

from __future__ import annotations

import unittest


class TestPasswordUtils(unittest.TestCase):

    def setUp(self):
        from password_utils import hash_password, verify_password  # on sys.path via conftest
        self.hash_password = hash_password
        self.verify_password = verify_password

    # --- hash_password ---

    def test_hash_is_non_empty_string(self):
        h = self.hash_password("secret")
        self.assertIsInstance(h, str)
        self.assertTrue(len(h) > 0)

    def test_hash_starts_with_bcrypt_prefix(self):
        h = self.hash_password("secret")
        self.assertTrue(h.startswith("$2b$"), msg=f"Not a bcrypt hash: {h[:10]}")

    def test_different_calls_produce_different_hashes(self):
        """bcrypt generates a random salt, so two hashes of the same password differ."""
        h1 = self.hash_password("secret")
        h2 = self.hash_password("secret")
        self.assertNotEqual(h1, h2)

    def test_hash_length_is_reasonable(self):
        h = self.hash_password("password")
        self.assertGreaterEqual(len(h), 50)

    # --- verify_password ---

    def test_correct_password_verifies(self):
        h = self.hash_password("my-password")
        self.assertTrue(self.verify_password("my-password", h))

    def test_wrong_password_fails(self):
        h = self.hash_password("correct")
        self.assertFalse(self.verify_password("wrong", h))

    def test_empty_password_can_be_hashed_and_verified(self):
        h = self.hash_password("")
        self.assertTrue(self.verify_password("", h))

    def test_unicode_password(self):
        pw = "pässwörd-日本語-🔒"
        h = self.hash_password(pw)
        self.assertTrue(self.verify_password(pw, h))

    def test_long_password(self):
        pw = "a" * 500
        h = self.hash_password(pw)
        # bcrypt silently truncates at 72 bytes; verification should still succeed
        self.assertTrue(self.verify_password(pw, h))

    def test_similar_passwords_dont_verify_cross(self):
        h1 = self.hash_password("password1")
        h2 = self.hash_password("password2")
        self.assertFalse(self.verify_password("password1", h2))
        self.assertFalse(self.verify_password("password2", h1))

    def test_case_sensitivity(self):
        h = self.hash_password("Password")
        self.assertFalse(self.verify_password("password", h))
        self.assertFalse(self.verify_password("PASSWORD", h))


if __name__ == "__main__":
    unittest.main()
