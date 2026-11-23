import type { FighterRegistrationProfileField } from '@/lib/fighterRegistrationProfile';

export interface AdminEmailRecipient {
  key: string;
  kind: 'registered' | 'manual';
  targetId: string;
  fighterName: string;
  recipientName: string;
  email: string;
  language?: string | null;
  isBanned: boolean;
  isHidden: boolean;
  location: string;
  missingFields: FighterRegistrationProfileField[];
  managerRole?: string;
  createdAt: string;
}
