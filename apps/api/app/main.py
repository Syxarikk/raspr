from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import addresses, auth, orders, payouts, photos, users, work_types

app = FastAPI(title="AdControl API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(work_types.router)
app.include_router(addresses.router)
app.include_router(orders.router)
app.include_router(photos.router)
app.include_router(payouts.router)


@app.get('/health')
def health():
    return {'status': 'ok'}
