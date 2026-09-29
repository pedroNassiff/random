from __future__ import annotations

import pytest

from futbol.application.errors import Invalid
from futbol.application.passwords import burn_time, hash_password, validate_password, verify_password


def test_hash_is_salted_and_verifies() -> None:
    a, b = hash_password("correcta-123"), hash_password("correcta-123")
    assert a != b and a.startswith("scrypt$")
    assert verify_password("correcta-123", a)
    assert not verify_password("incorrecta", a)


@pytest.mark.parametrize(
    "stored", ["", "texto-plano", "bcrypt$1$2$3$aa$bb", "scrypt$x$8$1$aa$bb", "scrypt$16$8$1$zz$bb"]
)
def test_malformed_or_foreign_hashes_never_verify(stored: str) -> None:
    assert not verify_password("lo-que-sea", stored)


def test_length_rules() -> None:
    validate_password("12345678")
    with pytest.raises(Invalid):
        validate_password("corta")
    with pytest.raises(Invalid):
        validate_password("x" * 129)


def test_burn_time_does_not_raise() -> None:
    burn_time("cualquiera")
