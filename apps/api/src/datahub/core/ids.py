"""UUIDv7 generation (Python 3.13 has no stdlib uuid7; D-DB-02 requires app-generated v7 ids)."""

import os
import time
import uuid


def uuid7() -> uuid.UUID:
    """Return a time-ordered RFC 9562 UUIDv7."""
    millis = time.time_ns() // 1_000_000
    rand = int.from_bytes(os.urandom(10), "big")
    value = (millis & 0xFFFFFFFFFFFF) << 80
    value |= 0x7 << 76
    value |= ((rand >> 62) & 0xFFF) << 64
    value |= 0b10 << 62
    value |= rand & 0x3FFFFFFFFFFFFFFF
    return uuid.UUID(int=value)
