from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ApplyQuest"
    API_V1_STR: str = "/api/v1"
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    SQLALCHEMY_DATABASE_URI: str | None = None
    SHARE_PASSWORD: str = "sharepassword"

    # Auth
    SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION_TO_A_STRONG_SECRET_KEY"
    # Static key for agent/MCP access. Empty disables API-key auth entirely.
    APPLYQUEST_API_KEY: str = ""

    # Email
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "ApplyQuest <noreply@applyquest.app>"
    USER_EMAIL: str = "aneesh.nl@gmail.com"
    MENTOR_EMAILS: str = ""  # comma-separated list

    class Config:
        env_file = ".env"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SQLALCHEMY_DATABASE_URI:
            self.SQLALCHEMY_DATABASE_URI = f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

settings = Settings()
