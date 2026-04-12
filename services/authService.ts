import { supabase } from '@/lib/supabaseClient';
import type { LoginFormData, RegisterFormData, ServiceResponse, AuthSession } from '@/types';

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
    updates: { full_name?: string; city?: string | null; phone?: string | null }
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
};
