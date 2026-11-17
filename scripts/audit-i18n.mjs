import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const localeRoot = path.join(projectRoot, 'public', 'locales');
const referenceLocale = 'en';
const locales = fs.readdirSync(localeRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const namespaces = fs.readdirSync(path.join(localeRoot, referenceLocale))
  .filter((file) => file.endsWith('.json'))
  .sort();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flatten(value, prefix = '', output = new Map()) {
  if (typeof value === 'string') {
    output.set(prefix, value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, output));
    return output;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      flatten(item, prefix ? `${prefix}.${key}` : key, output);
    });
  }

  return output;
}

function interpolationTokens(value) {
  return [...value.matchAll(/\{\{\s*([^},\s]+)[^}]*\}\}/g)]
    .map((match) => match[1])
    .sort();
}

let problemCount = 0;

for (const namespace of namespaces) {
  const referencePath = path.join(localeRoot, referenceLocale, namespace);
  const reference = flatten(readJson(referencePath));

  for (const locale of locales) {
    if (locale === referenceLocale) continue;
    const localePath = path.join(localeRoot, locale, namespace);
    if (!fs.existsSync(localePath)) {
      console.error(`[${locale}/${namespace}] missing namespace file`);
      problemCount += 1;
      continue;
    }

    const translated = flatten(readJson(localePath));
    for (const [key, referenceValue] of reference) {
      if (!translated.has(key)) {
        console.error(`[${locale}/${namespace}] missing: ${key}`);
        problemCount += 1;
        continue;
      }

      const expectedTokens = interpolationTokens(referenceValue);
      const translatedTokens = interpolationTokens(translated.get(key));
      if (expectedTokens.join('|') !== translatedTokens.join('|')) {
        console.error(
          `[${locale}/${namespace}] interpolation mismatch: ${key} `
          + `(expected ${expectedTokens.join(', ') || 'none'}; found ${translatedTokens.join(', ') || 'none'})`,
        );
        problemCount += 1;
      }
    }
  }
}

if (problemCount > 0) {
  console.error(`\nInternationalization audit found ${problemCount} problem(s).`);
  process.exitCode = 1;
} else {
  console.log(`Internationalization audit passed for ${locales.join(', ')}.`);
}
