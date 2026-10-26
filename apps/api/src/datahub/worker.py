from typing import Any

from celery import Celery

from datahub.core.config import get_settings

settings = get_settings()
celery_app = Celery("datahub", broker=settings.celery_broker_url, backend=settings.celery_result_backend)
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_default_queue="default",
)


@celery_app.task(name="datahub.system.probe", bind=True, acks_late=True)  # type: ignore[untyped-decorator]
def probe(self: Any) -> dict[str, str]:
    return {"status": "ok", "task_id": self.request.id}
