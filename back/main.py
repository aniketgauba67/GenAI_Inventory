"""******************************* main.py ***************************************
 *
 *  Module: FastAPI Application Entrypoint
 *
 *  This module configures middleware, routers, and scheduler lifecycle for
 *  the backend API.
 *
 *  The module provides:
 *
 *  - FastAPI application construction.
 *  - CORS middleware configuration.
 *  - router registration for upload, auth, review, manager, customer, chat,
 *  and volunteer inventory routes.
 *
 *  Key Structures Used:
 *
 *  - FastAPI app instance, router modules, and scheduler lifecycle context.
 *
 *  This module ensures:
 *
 *  - the API starts consistently from package and local backend
 *  entrypoints.
 *  - background scheduler jobs start and stop with the web application.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Keep the old local start command working:
#   cd back && uvicorn main:app --reload --port 8000
# The deploy path still uses the package entrypoint: back.main:app.
if __package__ in {None, ""}:
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

from back import scheduler
from back.config import CORS_ORIGINS
from back.routers.auth import router as auth_router
from back.routers.chat import router as chat_router
from back.routers.customer import router as customer_router
from back.routers.manager import router as manager_router
from back.routers.review import router as review_router
from back.routers.upload import router as upload_router
from back.routers.volunteer_inventory import router as volunteer_inventory_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Start and stop background jobs with the FastAPI lifecycle.

    Parameters:
        application: The FastAPI application instance managed by the server.

    Returns:
        An async context manager that starts the scheduler before requests are
        served and stops it during application shutdown.
    """
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="GenAI Inventory API", lifespan=lifespan)

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
app.include_router(customer_router)
app.include_router(chat_router)
