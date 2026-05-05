"""Authentication schemas."""

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=256)


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
    email: EmailStr
    password: str = Field(min_length=6, max_length=256)
    name: str = Field(min_length=1, max_length=255)


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
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=16, max_length=256)
    new_password: str = Field(min_length=6, max_length=256)


class PasswordResetResponse(BaseModel):
    message: str
    reset_token: str | None = None


class LogoutResponse(BaseModel):
    message: str
