import fs from 'node:fs';

const namespace = process.argv[2] ?? 'events';
const targetLocale = process.argv[3] ?? 'ru';
const sourcePath = `public/locales/en/${namespace}.json`;
const targetPath = `public/locales/${targetLocale}/${namespace}.json`;
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

function flatten(value, prefix = '', output = new Map()) {
  if (typeof value === 'string') {
    output.set(prefix, value);
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      flatten(item, prefix ? `${prefix}.${key}` : key, output);
    }
  }
  return output;
}

function getPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split('.');
  const finalKey = parts.pop();
  const parent = parts.reduce((current, key) => {
    current[key] ??= {};
    return current[key];
  }, object);
  parent[finalKey] = value;
}

function protectInterpolation(value) {
  const tokens = [];
  return {
    protectedValue: value.replace(/\{\{\s*[^}]+\}\}/g, (token) => {
      const marker = `__STRIKERS_TOKEN_${tokens.length}__`;
      tokens.push([marker, token]);
      return marker;
    }),
    tokens,
  };
}

function restoreInterpolation(value, tokens) {
  return tokens.reduce((result, [marker, token]) => {
    const flexibleMarker = new RegExp(marker.replaceAll('_', '[ _]*'), 'gi');
    return result.replace(flexibleMarker, token);
  }, value);
}

async function translate(value) {
  const { protectedValue, tokens } = protectInterpolation(value);
  const endpoint = new URL('https://translate.googleapis.com/translate_a/single');
  endpoint.searchParams.set('client', 'gtx');
  endpoint.searchParams.set('sl', 'en');
  endpoint.searchParams.set('tl', 'ru');
  endpoint.searchParams.set('dt', 't');
  endpoint.searchParams.set('q', protectedValue);

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Translation failed with HTTP ${response.status}`);
  const payload = await response.json();
  const translated = payload[0].map((segment) => segment[0]).join('');
  return restoreInterpolation(translated, tokens);
}

const missing = [...flatten(source)]
  .filter(([key]) => typeof getPath(target, key) !== 'string');

let completed = 0;
for (let index = 0; index < missing.length; index += 8) {
  const batch = missing.slice(index, index + 8);
  const translations = await Promise.all(batch.map(([, value]) => translate(value)));
  batch.forEach(([key], batchIndex) => setPath(target, key, translations[batchIndex]));
  completed += batch.length;
  if (completed % 40 === 0 || completed === missing.length) {
    console.log(`Translated ${completed}/${missing.length}`);
  }
}

fs.writeFileSync(targetPath, `${JSON.stringify(target, null, 2)}\n`);
console.log(`Updated ${targetPath}`);
