import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/storageClient';
import type { LoginFormData, RegisterFormData, ServiceResponse, AuthSession, UserRole } from '@/types';

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export const authService = {
  async login({ email, password }: LoginFormData): Promise<ServiceResponse<AuthSession>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) return { data: null, error: error.message };

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      return {
        data: {
          user: { id: data.user.id, email: data.user.email! },
          profile: profile ?? null,
        },
        error: null,
      };
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

      // Profile is created automatically by the on_auth_user_created trigger
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
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async uploadProfilePhoto(file: File): Promise<ServiceResponse<string>> {
    try {
      const { data, error } = await uploadFile(file, 'vendor-photos');
      if (error || !data) return { data: null, error: error ?? 'An unexpected error occurred.' };
      return { data: data.url, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getSession(): Promise<ServiceResponse<AuthSession>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return { data: null, error: error?.message ?? null };

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      return {
        data: {
          user: { id: session.user.id, email: session.user.email! },
          profile: profile ?? null,
        },
        error: null,
      };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
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
      await supabase.auth.signOut();
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
