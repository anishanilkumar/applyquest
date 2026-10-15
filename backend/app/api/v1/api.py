from fastapi import APIRouter
from app.api.v1.endpoints import user, applications, network, login, share, interviews

api_router = APIRouter()
api_router.include_router(user.router, prefix="/user", tags=["user"])
api_router.include_router(applications.router, prefix="/applications", tags=["applications"])
api_router.include_router(network.router, prefix="/network", tags=["network"])
api_router.include_router(interviews.router, prefix="/interviews", tags=["interviews"])
api_router.include_router(login.router, tags=["login"])
api_router.include_router(share.router, prefix="/share", tags=["share"])
