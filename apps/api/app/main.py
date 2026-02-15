from collections import Counter
from threading import Lock
from time import perf_counter

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import addresses, auth, orders, payouts, photos, users, work_types

app = FastAPI(title=settings.app_name, version="1.0.0")


class MetricsRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._requests_total = 0
        self._errors_total = 0
        self._duration_total_ms = 0.0
        self._status_counts: Counter[str] = Counter()
        self._path_counts: Counter[str] = Counter()

    def observe(self, path: str, status_code: int, duration_ms: float) -> None:
        status_key = str(status_code)
        with self._lock:
            self._requests_total += 1
            self._duration_total_ms += duration_ms
            self._status_counts[status_key] += 1
            self._path_counts[path] += 1
            if status_code >= 500:
                self._errors_total += 1

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            requests_total = self._requests_total
            avg_latency_ms = self._duration_total_ms / requests_total if requests_total else 0.0
            return {
                "requests_total": requests_total,
                "errors_total": self._errors_total,
                "avg_latency_ms": round(avg_latency_ms, 2),
                "status_counts": dict(self._status_counts),
                "top_paths": [
                    {"path": path, "count": count}
                    for path, count in self._path_counts.most_common(20)
                ],
            }


metrics_registry = MetricsRegistry()

cors_origins = settings.cors_allow_origins_list
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials="*" not in cors_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    started = perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = (perf_counter() - started) * 1000
        metrics_registry.observe(request.url.path, status_code, duration_ms)

v1 = APIRouter(prefix="/api/v1")
v1.include_router(auth.router)
v1.include_router(users.router)
v1.include_router(work_types.router)
v1.include_router(addresses.router)
v1.include_router(orders.router)
v1.include_router(photos.router)
v1.include_router(payouts.router)


@v1.get('/health', tags=["health"])
def health():
    return {'status': 'ok'}


@v1.get('/metrics', tags=["health"])
def metrics():
    return metrics_registry.snapshot()


@app.get('/healthz', tags=["health"])
def healthz():
    return {'status': 'ok'}


app.include_router(v1)
