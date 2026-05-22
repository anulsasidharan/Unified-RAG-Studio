export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  user_id: string;
  role: string;
  email: string;
  name: string;
  subscription_tier: string;
  email_verified: boolean;
};

export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
};

export type RegisterResponse = {
  user_id: string;
  email: string;
  name: string;
  email_verified: boolean;
  subscription_tier: string;
  message: string;
  verification_token: string | null;
};

export type VerifyEmailRequest = {
  token: string;
};

export type VerifyEmailResponse = {
  user_id: string;
  email_verified: boolean;
};

export type PasswordResetRequest = {
  email: string;
};

export type PasswordResetConfirmRequest = {
  token: string;
  new_password: string;
};

export type PasswordResetResponse = {
  message: string;
  reset_token: string | null;
};

// /api/auth/me returns LoginResponse-compatible payload.
export type MeResponse = LoginResponse;

export type LogoutResponse = {
  message: string;
};
