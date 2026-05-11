"""Authentication schemas."""

from pydantic import BaseModel, Field, field_validator


def _validate_email(v: str) -> str:
    v = v.strip().lower()
    if "@" not in v or len(v) < 3:
        raise ValueError("Enter a valid email address")
    return v


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=256)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return _validate_email(v)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user_id: str
    role: str

    email: str
    name: str
    subscription_tier: str
    email_verified: bool


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=6, max_length=256)
    name: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return _validate_email(v)


class RegisterResponse(BaseModel):
    user_id: str
    email: str
    name: str
    email_verified: bool = False
    subscription_tier: str
    message: str
    # In production this would be sent via email. In dev we may return the token.
    verification_token: str | None = None


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=16, max_length=256)


class VerifyEmailResponse(BaseModel):
    user_id: str
    email_verified: bool


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return _validate_email(v)


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=16, max_length=256)
    new_password: str = Field(min_length=6, max_length=256)


class PasswordResetResponse(BaseModel):
    message: str
    reset_token: str | None = None


class LogoutResponse(BaseModel):
    message: str
