import type { FighterRegistrationProfileField } from '@/lib/fighterRegistrationProfile';

type SupportedLanguage = 'es' | 'en' | 'ru';

const COPY: Record<SupportedLanguage, {
  subject: string;
  genericName: string;
  greeting: (name: string) => string;
  intro: string;
  missingTitle: string;
  action: string;
  note: string;
  fields: Record<FighterRegistrationProfileField, string>;
}> = {
  es: {
    subject: 'Completa tu perfil de atleta en Strikers Match',
    genericName: 'atleta',
    greeting: (name) => `Hola ${name},`,
    intro: 'Tu perfil de atleta necesita información adicional para estar completo y poder utilizar el registro de eventos.',
    missingTitle: 'Información pendiente:',
    action: 'Actualizar mi perfil',
    note: 'Inicia sesión con el correo donde recibiste este mensaje y completa los campos indicados.',
    fields: {
      photo: 'Fotografía de perfil',
      fullName: 'Nombre y apellido',
      country: 'País actual',
      nationality: 'Nacionalidad y bandera',
      instagram: 'Instagram válido',
      discipline: 'Disciplina principal',
      weight: 'Categoría de peso',
      team: 'Club o equipo',
    },
  },
  en: {
    subject: 'Complete your Strikers Match fighter profile',
    genericName: 'fighter',
    greeting: (name) => `Hello ${name},`,
    intro: 'Your fighter profile needs additional information before it is complete and ready for event registration.',
    missingTitle: 'Missing information:',
    action: 'Update my profile',
    note: 'Sign in with the email address that received this message and complete the listed fields.',
    fields: {
      photo: 'Profile photograph',
      fullName: 'First and last name',
      country: 'Current country',
      nationality: 'Nationality and flag',
      instagram: 'Valid Instagram account',
      discipline: 'Primary discipline',
      weight: 'Weight category',
      team: 'Club or team',
    },
  },
  ru: {
    subject: 'Заполните профиль спортсмена в Strikers Match',
    genericName: 'спортсмен',
    greeting: (name) => `Здравствуйте, ${name}!`,
    intro: 'В профиле спортсмена не хватает информации. Заполните её, чтобы профиль был готов к регистрации на события.',
    missingTitle: 'Необходимо добавить:',
    action: 'Обновить профиль',
    note: 'Войдите с адресом электронной почты, на который пришло это сообщение, и заполните указанные поля.',
    fields: {
      photo: 'Фотография профиля',
      fullName: 'Имя и фамилия',
      country: 'Текущая страна',
      nationality: 'Гражданство и флаг',
      instagram: 'Действительный аккаунт Instagram',
      discipline: 'Основная дисциплина',
      weight: 'Весовая категория',
      team: 'Клуб или команда',
    },
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function normalizeReminderLanguage(value?: string | null): SupportedLanguage {
  return value === 'en' || value === 'ru' ? value : 'es';
}

export function buildFighterProfileReminderEmail(input: {
  fullName: string;
  language?: string | null;
  missingFields: FighterRegistrationProfileField[];
  profileUrl: string;
}) {
  const language = normalizeReminderLanguage(input.language);
  const copy = COPY[language];
  const recipientName = input.fullName.trim() || copy.genericName;
  const safeName = escapeHtml(recipientName);
  const safeUrl = escapeHtml(input.profileUrl);
  const labels = input.missingFields.map((field) => copy.fields[field]);
  const listHtml = labels.map((label) => `<li style="margin:0 0 8px">${escapeHtml(label)}</li>`).join('');

  return {
    subject: copy.subject,
    text: [
      copy.greeting(recipientName),
      '',
      copy.intro,
      '',
      copy.missingTitle,
      ...labels.map((label) => `- ${label}`),
      '',
      copy.note,
      input.profileUrl,
    ].join('\n'),
    html: `
      <div style="background:#f4f4f5;padding:32px 16px;font-family:Arial,sans-serif;color:#18181b">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-top:5px solid #C0001E;padding:32px">
          <p style="margin:0 0 24px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C0001E">Strikers Match</p>
          <h1 style="margin:0 0 18px;font-size:26px;line-height:1.15">${copy.greeting(safeName)}</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#52525b">${escapeHtml(copy.intro)}</p>
          <p style="margin:0 0 10px;font-size:14px;font-weight:700">${escapeHtml(copy.missingTitle)}</p>
          <ul style="margin:0 0 26px;padding-left:22px;font-size:14px;line-height:1.5;color:#3f3f46">${listHtml}</ul>
          <a href="${safeUrl}" style="display:inline-block;background:#C0001E;color:#ffffff;text-decoration:none;padding:14px 20px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escapeHtml(copy.action)}</a>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a">${escapeHtml(copy.note)}</p>
        </div>
      </div>
    `,
  };
}
