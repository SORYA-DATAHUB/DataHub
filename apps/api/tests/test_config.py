import pytest

from datahub.core.config import Settings


def test_production_rejects_development_secrets() -> None:
    settings = Settings(env="production")
    with pytest.raises(RuntimeError, match="development secrets"):
        settings.assert_safe_for_runtime()


def test_log_level_is_normalized() -> None:
    assert Settings(log_level="warning").log_level == "WARNING"
