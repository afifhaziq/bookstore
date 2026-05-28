from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    model_config = {"env_file": ".env"}


settings = Settings()
