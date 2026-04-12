/**
 * Consent Service -- Parental consent for minor fighters (under 18).
 */

import { supabase } from '@/lib/supabaseClient';
import type { ParentalConsent, ServiceResponse } from '@/types';

/** Liability waiver text (Spanish). Hash is stored alongside the signature for legal proof. */
export const WAIVER_TEXT = `CONSENTIMIENTO INFORMADO Y EXONERACION DE RESPONSABILIDAD

Yo, en mi calidad de padre, madre o tutor legal del menor registrado en la plataforma Strikers Match, declaro lo siguiente:

1. Autorizo expresamente al menor a participar en eventos de deportes de combate organizados a traves de la plataforma Strikers Match, incluyendo pero no limitado a: boxeo, muay thai, MMA, kickboxing, karate, judo, lucha libre, jiu-jitsu y disciplinas relacionadas.

2. Reconozco que los deportes de combate conllevan riesgos inherentes de lesiones fisicas, incluyendo pero no limitado a: contusiones, fracturas, conmociones cerebrales y otras lesiones que pueden resultar en incapacidad temporal o permanente.

3. Certifico que el menor se encuentra en condiciones fisicas adecuadas para participar en dichas actividades deportivas y cuenta con la aprobacion medica correspondiente.

4. Exonero de toda responsabilidad a Strikers Match, sus organizadores, promotores, y demas participantes por cualquier lesion, dano o perjuicio que pudiera sufrir el menor durante su participacion en eventos deportivos.

5. Me comprometo a estar presente o designar a un representante mayor de edad durante los eventos en los que participe el menor.

6. Entiendo que este consentimiento es valido desde la fecha de firma y permanecera vigente mientras el menor mantenga su cuenta activa en la plataforma.

Al firmar digitalmente este documento, confirmo que he leido, entendido y acepto todos los terminos establecidos anteriormente.`;

/** Calculate SHA-256 hash of text (for legal proof of waiver version signed) */
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Check if a date of birth makes someone under 18 today */
export function isMinor(dateOfBirth: string | null): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age < 18;
}

/** Submit parental consent with digital signature */
export async function submitConsent(
  fighterProfileId: string,
  parentInfo: {
    parent_full_name: string;
    parent_email: string;
    parent_phone: string;
    relationship: 'Padre' | 'Madre' | 'Tutor Legal';
  },
  signatureBase64: string
): Promise<ServiceResponse<ParentalConsent>> {
  try {
    const waiverHash = await hashText(WAIVER_TEXT);

    const { data, error } = await supabase
      .from('parental_consents')
      .insert({
        fighter_profile_id: fighterProfileId,
        parent_full_name: parentInfo.parent_full_name,
        parent_email: parentInfo.parent_email,
        parent_phone: parentInfo.parent_phone,
        relationship: parentInfo.relationship,
        signature_data: signatureBase64,
        waiver_text_hash: waiverHash,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: 'Error al registrar consentimiento.' };
  }
}

/** Get existing consent for a fighter */
export async function getConsent(
  fighterProfileId: string
): Promise<ServiceResponse<ParentalConsent>> {
  try {
    const { data, error } = await supabase
      .from('parental_consents')
      .select('*')
      .eq('fighter_profile_id', fighterProfileId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data ?? null, error: null };
  } catch {
    return { data: null, error: 'Error al verificar consentimiento.' };
  }
}

/** Check if a minor fighter has valid consent on file */
export async function hasValidConsent(fighterProfileId: string): Promise<boolean> {
  const { data } = await getConsent(fighterProfileId);
  return data !== null;
}
