import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from routers.auth import router as auth_router
from routers.upload import router as upload_router
from routers.review import router as review_router
from routers.volunteer_inventory import router as volunteer_inventory_router
from routers.manager import router as manager_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="GenAI Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(auth_router)
app.include_router(review_router)
app.include_router(volunteer_inventory_router)
app.include_router(manager_router)
