export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: string;
  subscription_tier: string;
  email_verified: boolean;
  is_active: boolean;
  profile_image_url: string | null;
  last_login: string | null;
  created_at: string;
};

export type UpdateProfileRequest = {
  name?: string;
  profile_image_url?: string;
};

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type UsageResponse = {
  documents_processed: number;
  api_calls_used: number;
  storage_used_mb: number;
  limits: Record<string, number>;
  usage_percentage: Record<string, number>;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, number | boolean>;
  is_active: boolean;
};

export type APIKey = {
  id: string;
  key_name: string;
  key_prefix: string;
  last_used: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
};

export type CreateAPIKeyRequest = {
  key_name: string;
  expires_at?: string;
};

export type CreateAPIKeyResponse = APIKey & { api_key: string };

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  subscription_tier: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  last_login: string | null;
};

export type AdminUsersListResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
};

export type CreateUserRequest = {
  email: string;
  name: string;
  password: string;
  role: string;
  subscription_tier: string;
};

export type UpdateUserRequest = {
  name?: string;
  role?: string;
  subscription_tier?: string;
  is_active?: boolean;
};

export type AnalyticsResponse = {
  total_users: number;
  active_users: number;
  new_registrations_30d: number;
  plan_distribution: Record<string, number>;
  role_distribution: Record<string, number>;
};

export type AdminPlan = {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, number | boolean>;
  is_active: boolean;
  created_at: string;
};
