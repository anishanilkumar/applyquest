# Import all the models, so that Base has them before being
# imported by Alembic or used by the application
from app.db.base_class import Base  # noqa
from app.models.user import User  # noqa
from app.models.application import Application, ApplicationHistory  # noqa
from app.models.network import NetworkContact  # noqa
from app.models.point_history import PointHistory  # noqa
from app.models.interview import Interview  # noqa
