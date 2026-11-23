import type { FighterRegistrationProfileField } from '@/lib/fighterRegistrationProfile';

type SupportedLanguage = 'es' | 'en' | 'ru';

const COPY: Record<SupportedLanguage, {
  subject: string;
  genericName: string;
  greeting: (name: string) => string;
  intro: string;
  standardTitle: string;
  standardIntro: string;
  standards: string[];
  missingTitle: string;
  action: string;
  note: string;
  managedSubject: (fighterName: string) => string;
  managedIntro: (fighterName: string) => string;
  managedAction: string;
  managedNote: string;
  fields: Record<FighterRegistrationProfileField, string>;
}> = {
  es: {
    subject: 'Completa tu perfil de atleta en Strikers Match',
    genericName: 'atleta',
    greeting: (name) => `Hola ${name},`,
    intro: 'Tu perfil de atleta necesita información adicional para estar completo y poder utilizar el registro de eventos.',
    standardTitle: 'Estándar obligatorio del perfil',
    standardIntro: 'Para proteger la calidad y la confianza de la comunidad, todos los perfiles están sujetos a moderación y deben cumplir estas reglas:',
    standards: [
      'Usa una fotografía reciente y de alta calidad: retrato claro, bien iluminado, sin imágenes borrosas ni filtros que oculten el rostro.',
      'Mantén toda la información del perfil completa, correcta y actualizada.',
      'Si el perfil no cumple estos requisitos, el equipo de Strikers Match podrá solicitar correcciones antes de aprobarlo como completo.',
    ],
    missingTitle: 'Información pendiente:',
    action: 'Actualizar mi perfil',
    note: 'Inicia sesión con el correo donde recibiste este mensaje y completa los campos indicados.',
    managedSubject: (fighterName) => `Actualiza el perfil de ${fighterName} en Strikers Match`,
    managedIntro: (fighterName) => `El perfil de ${fighterName}, que administras dentro de tu roster, necesita información adicional para estar completo y visible públicamente.`,
    managedAction: 'Actualizar perfil del atleta',
    managedNote: 'Inicia sesión con el correo donde recibiste este mensaje, abre tu roster y completa los campos indicados del atleta.',
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
    standardTitle: 'Required profile standard',
    standardIntro: 'To protect the quality and trust of the community, every profile is subject to moderation and must follow these rules:',
    standards: [
      'Use a recent, high-quality photograph: a clear, well-lit portrait with no blurry image or filter that hides your face.',
      'Keep all profile information complete, accurate, and up to date.',
      'If the profile does not meet these requirements, the Strikers Match team may request corrections before marking it complete.',
    ],
    missingTitle: 'Missing information:',
    action: 'Update my profile',
    note: 'Sign in with the email address that received this message and complete the listed fields.',
    managedSubject: (fighterName) => `Update ${fighterName}'s profile on Strikers Match`,
    managedIntro: (fighterName) => `${fighterName}'s profile, which you manage in your roster, needs additional information before it is complete and publicly visible.`,
    managedAction: 'Update fighter profile',
    managedNote: 'Sign in with the email address that received this message, open your roster, and complete the listed fighter fields.',
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
    standardTitle: 'Обязательный стандарт профиля',
    standardIntro: 'Чтобы поддерживать качество и доверие сообщества, каждый профиль проходит модерацию и должен соответствовать следующим правилам:',
    standards: [
      'Используйте недавнюю фотографию высокого качества: чёткий, хорошо освещённый портрет без размытия и фильтров, скрывающих лицо.',
      'Поддерживайте всю информацию профиля полной, точной и актуальной.',
      'Если профиль не соответствует требованиям, команда Strikers Match может запросить исправления, прежде чем отметить его как заполненный.',
    ],
    missingTitle: 'Необходимо добавить:',
    action: 'Обновить профиль',
    note: 'Войдите с адресом электронной почты, на который пришло это сообщение, и заполните указанные поля.',
    managedSubject: (fighterName) => `Обновите профиль ${fighterName} в Strikers Match`,
    managedIntro: (fighterName) => `В профиле ${fighterName}, которым вы управляете в своём составе, не хватает информации для полного и публичного профиля.`,
    managedAction: 'Обновить профиль спортсмена',
    managedNote: 'Войдите с адресом электронной почты, на который пришло это сообщение, откройте свой состав и заполните указанные поля спортсмена.',
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

function renderProfileReminderEmail(input: {
  recipientName: string;
  language: SupportedLanguage;
  missingFields: FighterRegistrationProfileField[];
  profileUrl: string;
  subject: string;
  intro: string;
  action: string;
  note: string;
}) {
  const language = input.language;
  const copy = COPY[language];
  const recipientName = input.recipientName.trim() || copy.genericName;
  const safeName = escapeHtml(recipientName);
  const safeUrl = escapeHtml(input.profileUrl);
  const labels = input.missingFields.map((field) => copy.fields[field]);
  const listHtml = labels.map((label) => `<li style="margin:0 0 8px">${escapeHtml(label)}</li>`).join('');
  const standardsHtml = copy.standards
    .map((standard) => `<li style="margin:0 0 8px">${escapeHtml(standard)}</li>`)
    .join('');

  return {
    subject: input.subject,
    text: [
      copy.greeting(recipientName),
      '',
      input.intro,
      '',
      copy.standardTitle,
      copy.standardIntro,
      ...copy.standards.map((standard) => `- ${standard}`),
      '',
      copy.missingTitle,
      ...labels.map((label) => `- ${label}`),
      '',
      input.note,
      input.profileUrl,
    ].join('\n'),
    html: `
      <div style="background:#f4f4f5;padding:32px 16px;font-family:Arial,sans-serif;color:#18181b">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-top:5px solid #C0001E;padding:32px">
          <p style="margin:0 0 24px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C0001E">Strikers Match</p>
          <h1 style="margin:0 0 18px;font-size:26px;line-height:1.15">${copy.greeting(safeName)}</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#52525b">${escapeHtml(input.intro)}</p>
          <div style="margin:0 0 24px;border:1px solid #e4e4e7;background:#fafafa;padding:18px">
            <p style="margin:0 0 8px;font-size:14px;font-weight:700">${escapeHtml(copy.standardTitle)}</p>
            <p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#52525b">${escapeHtml(copy.standardIntro)}</p>
            <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.5;color:#3f3f46">${standardsHtml}</ul>
          </div>
          <p style="margin:0 0 10px;font-size:14px;font-weight:700">${escapeHtml(copy.missingTitle)}</p>
          <ul style="margin:0 0 26px;padding-left:22px;font-size:14px;line-height:1.5;color:#3f3f46">${listHtml}</ul>
          <a href="${safeUrl}" style="display:inline-block;background:#C0001E;color:#ffffff;text-decoration:none;padding:14px 20px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escapeHtml(input.action)}</a>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a">${escapeHtml(input.note)}</p>
        </div>
      </div>
    `,
  };
}

export function buildFighterProfileReminderEmail(input: {
  fullName: string;
  language?: string | null;
  missingFields: FighterRegistrationProfileField[];
  profileUrl: string;
}) {
  const language = normalizeReminderLanguage(input.language);
  const copy = COPY[language];
  return renderProfileReminderEmail({
    recipientName: input.fullName,
    language,
    missingFields: input.missingFields,
    profileUrl: input.profileUrl,
    subject: copy.subject,
    intro: copy.intro,
    action: copy.action,
    note: copy.note,
  });
}

export function buildManagedFighterProfileReminderEmail(input: {
  recipientName: string;
  fighterName: string;
  language?: string | null;
  missingFields: FighterRegistrationProfileField[];
  profileUrl: string;
}) {
  const language = normalizeReminderLanguage(input.language);
  const copy = COPY[language];
  const fighterName = input.fighterName.trim() || copy.genericName;
  return renderProfileReminderEmail({
    recipientName: input.recipientName,
    language,
    missingFields: input.missingFields,
    profileUrl: input.profileUrl,
    subject: copy.managedSubject(fighterName),
    intro: copy.managedIntro(fighterName),
    action: copy.managedAction,
    note: copy.managedNote,
  });
}
