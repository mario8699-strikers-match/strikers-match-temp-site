import { supabase } from '@/lib/supabaseClient';
import { uploadFile, deleteFile } from '@/lib/storageClient';
import type {
  BusinessListing,
  BusinessListingCategory,
  BusinessListingStatus,
  ServiceResponse,
} from '@/types';

const LISTING_IMAGE_FOLDER = 'business-listings';

export const BUSINESS_LISTING_CATEGORIES: BusinessListingCategory[] = [
  'gyms_academies',
  'recovery_wellness',
  'event_services',
  'gear_apparel',
  'nutrition_supplements',
  'local_business',
  'other',
];

export interface BusinessListingInput {
  owner_profile_id: string;
  title: string;
  category: BusinessListingCategory;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  instagram?: string | null;
}

function cleanUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function cleanInstagram(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@/, '');
}

export const directoryService = {
  async getPublished(category?: BusinessListingCategory | 'all'): Promise<ServiceResponse<BusinessListing[]>> {
    try {
      let query = supabase
        .from('business_listings')
        .select('*')
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as BusinessListing[], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAllForAdmin(): Promise<ServiceResponse<BusinessListing[]>> {
    try {
      const { data, error } = await supabase
        .from('business_listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as BusinessListing[], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async submit(input: BusinessListingInput, imageFile?: File | null): Promise<ServiceResponse<BusinessListing>> {
    try {
      let image_url: string | null = null;
      let image_storage_path: string | null = null;

      if (imageFile) {
        const { data: uploaded, error: uploadError } = await uploadFile(imageFile, LISTING_IMAGE_FOLDER);
        if (uploadError || !uploaded) return { data: null, error: uploadError ?? 'Upload failed.' };
        image_url = uploaded.url;
        image_storage_path = uploaded.key;
      }

      const { data, error } = await supabase
        .from('business_listings')
        .insert({
          owner_profile_id: input.owner_profile_id,
          title: input.title.trim(),
          category: input.category,
          description: input.description?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          website_url: cleanUrl(input.website_url),
          instagram: cleanInstagram(input.instagram),
          image_url,
          image_storage_path,
          status: 'pending_review',
        })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as BusinessListing, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async updateStatus(
    id: string,
    status: BusinessListingStatus,
    rejectionReason?: string | null
  ): Promise<ServiceResponse<BusinessListing>> {
    try {
      const { data, error } = await supabase
        .from('business_listings')
        .update({
          status,
          rejection_reason: status === 'rejected' ? (rejectionReason?.trim() || null) : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as BusinessListing, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async setFeatured(id: string, isFeatured: boolean): Promise<ServiceResponse<BusinessListing>> {
    try {
      const { data, error } = await supabase
        .from('business_listings')
        .update({ is_featured: isFeatured })
        .eq('id', id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as BusinessListing, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async delete(id: string, imageStoragePath?: string | null): Promise<ServiceResponse<null>> {
    try {
      if (imageStoragePath) await deleteFile(imageStoragePath);

      const { error } = await supabase
        .from('business_listings')
        .delete()
        .eq('id', id);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
