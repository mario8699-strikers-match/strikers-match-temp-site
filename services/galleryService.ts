import { supabase } from '@/lib/supabaseClient';
import { uploadFile, deleteFile } from '@/lib/storageClient';
import type { GalleryPhoto, ServiceResponse } from '@/types';

const FOLDER = 'gallery';

export const galleryService = {
  async getAll(): Promise<ServiceResponse<GalleryPhoto[]>> {
    try {
      const { data, error } = await supabase
        .from('gallery_photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };

      const cdn = process.env.NEXT_PUBLIC_DO_SPACES_CDN;
      const photos: GalleryPhoto[] = (data ?? []).map((photo) => ({
        ...photo,
        url: cdn ? `${cdn}/${photo.storage_path}` : photo.storage_path,
      }));

      return { data: photos, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async upload(
    file: File,
    caption: string,
    eventName: string,
    adminId: string
  ): Promise<ServiceResponse<GalleryPhoto>> {
    try {
      const { data: uploaded, error: uploadError } = await uploadFile(file, FOLDER);
      if (uploadError || !uploaded) return { data: null, error: uploadError ?? 'Upload failed.' };

      const { data, error: dbError } = await supabase
        .from('gallery_photos')
        .insert({
          admin_id: adminId,
          storage_path: uploaded.key,
          caption: caption.trim() || null,
          event_name: eventName.trim() || null,
        })
        .select()
        .single();

      if (dbError) return { data: null, error: dbError.message };

      return {
        data: { ...data, url: uploaded.url },
        error: null,
      };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async delete(id: string, storagePath: string): Promise<ServiceResponse<null>> {
    try {
      await deleteFile(storagePath);

      const { error } = await supabase
        .from('gallery_photos')
        .delete()
        .eq('id', id);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
