import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/storageClient';
import type { LoginFormData, RegisterFormData, ServiceResponse, AuthSession, UserRole, PromoterFederationStatus, Profile } from '@/types';

const SESSION_PROFILE_COLUMNS = `
  id, full_name, email, role, city, state, country, phone, date_of_birth,
  bio, instagram, photo_url, promoter_federation_status, is_available, additional_roles, is_banned,
  created_at, updated_at
`;

const SESSION_CACHE_MS = 30_000;
const PROFILE_RETRY_DELAYS_MS = [250, 500, 1000];
let sessionCache: { expiresAt: number; response: ServiceResponse<AuthSession> } | null = null;
let sessionRequest: Promise<ServiceResponse<AuthSession>> | null = null;

export const AUTH_PROFILE_MISSING_ERROR = 'AUTH_PROFILE_MISSING';
export const AUTH_PROFILE_UNAVAILABLE_ERROR = 'AUTH_PROFILE_UNAVAILABLE';

function clearSessionCache() {
  sessionCache = null;
  sessionRequest = null;
}

function cacheSessionResponse(response: ServiceResponse<AuthSession>) {
  if (response.data?.user && response.data.profile) {
    sessionCache = {
      expiresAt: Date.now() + SESSION_CACHE_MS,
      response,
    };
  } else {
    sessionCache = null;
  }
  return response;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function fetchProfileByUserId(
  userId: string,
  options: { retry?: boolean } = {}
): Promise<{ profile: Profile | null; error: string | null }> {
  const retryDelays = options.retry ? PROFILE_RETRY_DELAYS_MS : [];
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select(SESSION_PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) return { profile: data as Profile, error: null };
    if (error) lastError = error.message;

    const delay = retryDelays[attempt];
    if (delay) await wait(delay);
  }

  return { profile: null, error: lastError };
}

async function fetchSessionWithProfile(): Promise<ServiceResponse<AuthSession>> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return { data: null, error: error?.message ?? null };

    const { profile, error: profileError } = await fetchProfileByUserId(session.user.id);

    return {
      data: {
        user: { id: session.user.id, email: session.user.email! },
        profile,
      },
      error: profileError ? AUTH_PROFILE_UNAVAILABLE_ERROR : null,
    };
  } catch {
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

export const authService = {
  async login({ email, password }: LoginFormData): Promise<ServiceResponse<AuthSession>> {
    try {
      clearSessionCache();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) return { data: null, error: error.message };

      const { profile, error: profileError } = await fetchProfileByUserId(data.user.id, { retry: true });

      if (profileError) {
        await supabase.auth.signOut();
        return { data: null, error: AUTH_PROFILE_UNAVAILABLE_ERROR };
      }

      if (!profile) {
        await supabase.auth.signOut();
        return { data: null, error: AUTH_PROFILE_MISSING_ERROR };
      }

      return cacheSessionResponse({
        data: {
          user: { id: data.user.id, email: data.user.email! },
          profile,
        },
        error: null,
      });
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async register(formData: RegisterFormData): Promise<ServiceResponse<AuthSession>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: formData.role,
            city: formData.city || null,
            phone: formData.phone || null,
            date_of_birth: formData.date_of_birth || null,
            gym_name: formData.gym_name || null,
            bio: formData.bio || null,
            instagram: formData.instagram || null,
          },
        },
      });

      if (error) return { data: null, error: error.message };
      if (!data.user) return { data: null, error: 'Registration failed.' };

      if (data.session) {
        const { profile, error: profileError } = await fetchProfileByUserId(data.user.id, { retry: true });

        if (profileError) {
          await supabase.auth.signOut();
          return {
            data: {
              user: { id: data.user.id, email: data.user.email! },
              profile: null,
            },
            error: AUTH_PROFILE_UNAVAILABLE_ERROR,
          };
        }

        if (!profile) {
          await supabase.auth.signOut();
          return {
            data: {
              user: { id: data.user.id, email: data.user.email! },
              profile: null,
            },
            error: AUTH_PROFILE_MISSING_ERROR,
          };
        }

        return cacheSessionResponse({
          data: {
            user: { id: data.user.id, email: data.user.email! },
            profile,
          },
          error: null,
        });
      }

      // Profile is created automatically by the on_auth_user_created trigger.
      // No session means Supabase email confirmation is enabled.
      return {
        data: {
          user: { id: data.user.id, email: data.user.email! },
          profile: null,
        },
        error: null,
      };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async logout(): Promise<ServiceResponse<null>> {
    try {
      clearSessionCache();
      const { error } = await supabase.auth.signOut();
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async updateProfile(
    id: string,
    updates: {
      full_name?: string;
      city?: string | null;
      phone?: string | null;
      bio?: string | null;
      instagram?: string | null;
      photo_url?: string | null;
      promoter_federation_status?: PromoterFederationStatus;
      is_available?: boolean;
      additional_roles?: UserRole[];
    }
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id);
      if (error) return { data: null, error: error.message };
      clearSessionCache();
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async uploadProfilePhoto(
    file: File,
    folder: string = 'vendor-photos'
  ): Promise<ServiceResponse<string>> {
    try {
      const { data, error } = await uploadFile(file, folder);
      if (error || !data) return { data: null, error: error ?? 'An unexpected error occurred.' };
      return { data: data.url, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getSession(): Promise<ServiceResponse<AuthSession>> {
    if (sessionCache && sessionCache.expiresAt > Date.now()) {
      return sessionCache.response;
    }

    if (sessionRequest) {
      return sessionRequest;
    }

    sessionRequest = fetchSessionWithProfile()
      .then(cacheSessionResponse)
      .finally(() => {
        sessionRequest = null;
      });

    return sessionRequest;
  },

  /**
   * Send a password reset email via Supabase Auth.
   * The email contains a link that redirects to /reset-password.
   */
  async resetPassword(email: string): Promise<ServiceResponse<null>> {
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  /**
   * Update the current user's password (requires a valid session from the reset link).
   */
  async updatePassword(newPassword: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  /**
   * Delete the current user's account via the server-side API route.
   * The API uses the service role key to delete the auth user.
   */
  async deleteAccount(): Promise<ServiceResponse<null>> {
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { data: null, error: body.error ?? 'Error al eliminar la cuenta.' };
      }

      // Sign out locally after successful deletion
      clearSessionCache();
      await supabase.auth.signOut();
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
