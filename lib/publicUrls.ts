type PublicRecord = { id: string; slug?: string | null };

export function isUuidIdentifier(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function publicIdentifier(record: PublicRecord) {
  return record.slug?.trim() || record.id;
}

export function eventPublicPath(event: PublicRecord) {
  return `/events/${publicIdentifier(event)}`;
}

export function fighterPublicPath(fighter: PublicRecord) {
  return `/fighters/${publicIdentifier(fighter)}`;
}

export function manualFighterPublicPath(fighter: PublicRecord) {
  return `/fighters/manual/${publicIdentifier(fighter)}`;
}
