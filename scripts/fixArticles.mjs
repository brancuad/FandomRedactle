import fs from 'fs';
import path from 'path';
import jitiFactory from 'jiti';

const jiti = jitiFactory(process.cwd());

const { SUPPORTED_FANDOMS } = jiti('./src/data/fandoms.ts');
const { CURATED_ARTICLES_BY_FANDOM } = jiti('./src/data/curatedArticles.ts');

const FILE_MAP = {
  atla: 'src/data/atla500Articles.ts',
  bbus: 'src/data/bigBrotherUsArticles.ts',
  bbcan: 'src/data/bigBrotherCanArticles.ts',
  bigbrother: 'src/data/bigBrotherArticles.ts',
  pokemon: 'src/data/pokemonArticles.ts',
  kingdomhearts: 'src/data/kingdomHeartsArticles.ts',
  finalfantasy: 'src/data/finalFantasyArticles.ts',
  amazingrace: 'src/data/amazingRaceArticles.ts',
  broadway: 'src/data/broadwayArticles.ts',
  disney: 'src/data/disneyArticles.ts',
  glee: 'src/data/gleeArticles.ts',
  dragonage: 'src/data/dragonAgeArticles.ts'
};

const args = process.argv.slice(2);
function getArg(name, defaultValue = undefined) {
  const match = args.find(a => a.startsWith(`--${name}=`));
  if (match) return match.split('=')[1];
  if (args.includes(`--${name}`)) return true;
  return defaultValue;
}

const targetFandom = getArg('fandom', 'atla');
const shouldApply = getArg('write', false) || getArg('apply', false);
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
Fandom Redactle - Article Catalog Fixer CLI
Usage:
  node scripts/fixArticles.mjs [options]

Options:
  --fandom=<id>     Fandom to fix (default: atla)
  --write, --apply  Apply changes directly to the data file (default: dry run preview)
  --help, -h        Show help message

Supported Fandoms:
${SUPPORTED_FANDOMS.map(f => `  - ${f.id.padEnd(16)} (${f.name})`).join('\n')}
`);
  process.exit(0);
}

const fandom = SUPPORTED_FANDOMS.find(f => f.id === targetFandom);
if (!fandom) {
  console.error(`❌ Unknown fandom: ${targetFandom}`);
  process.exit(1);
}

const filePath = FILE_MAP[targetFandom];
if (!filePath || !fs.existsSync(filePath)) {
  console.error(`❌ Source file not found for ${targetFandom}: ${filePath}`);
  process.exit(1);
}

function getApiBase(domain, sourceType = 'fandom') {
  return sourceType === 'wikipedia'
    ? `https://${domain}/w/api.php`
    : `https://${domain}/api.php`;
}

/**
 * Bulk checks titles in batches of 50 via action=query.
 */
async function batchQueryMetadata(titles, domain, sourceType) {
  const base = getApiBase(domain, sourceType);
  const results = new Map();
  const chunkSize = 50;

  for (let i = 0; i < titles.length; i += chunkSize) {
    const chunk = titles.slice(i, i + chunkSize);
    const url = `${base}?action=query&titles=${encodeURIComponent(chunk.join('|'))}&redirects=1&prop=info|pageprops&format=json&origin=*`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const redirectsMap = new Map();
      if (data.query?.redirects) {
        for (const r of data.query.redirects) {
          redirectsMap.set(r.from, r.to);
        }
      }

      const normalizedMap = new Map();
      if (data.query?.normalized) {
        for (const n of data.query.normalized) {
          normalizedMap.set(n.from, n.to);
        }
      }

      const pages = data.query?.pages || {};
      const pagesByTitle = new Map();
      for (const p of Object.values(pages)) {
        pagesByTitle.set(p.title, p);
      }

      for (const originalTitle of chunk) {
        const norm = normalizedMap.get(originalTitle) || originalTitle;
        const redir = redirectsMap.get(norm);
        const resolvedTitle = redir || norm;
        const page = pagesByTitle.get(resolvedTitle);

        if (!page || page.missing !== undefined) {
          results.set(originalTitle, {
            originalTitle,
            missing: true,
            isDisambiguation: false,
            byteLength: 0,
            redirectedTo: redir
          });
        } else {
          const isDisambig = Boolean(page.pageprops && ('disambiguation' in page.pageprops));
          results.set(originalTitle, {
            originalTitle,
            pageId: page.pageid,
            resolvedTitle: page.title,
            missing: false,
            isDisambiguation: isDisambig,
            byteLength: page.length || 0,
            redirectedTo: redir
          });
        }
      }
    } catch (err) {
      for (const t of chunk) {
        results.set(t, { originalTitle: t, error: err.message });
      }
    }
  }

  return results;
}

/**
 * Searches the wiki for candidate matches for missing or broken titles.
 */
async function searchWikiCandidates(title, domain, sourceType) {
  const base = getApiBase(domain, sourceType);
  // Search with full title first
  const searchQueries = [title];
  // If title has parentheses e.g. "Kya (mother of Katara)", also try bare title "Kya"
  const stripped = title.replace(/\s*\([^)]+\)/g, '').trim();
  if (stripped && stripped !== title) {
    searchQueries.push(stripped);
  }

  // Also try distinctive individual tokens (e.g. for "Ollie Moffitt" -> "Ollie")
  const tokens = stripped.split(/\s+/).filter(w => w.length >= 4 && !/^(the|and|part|from|zone|city|area|team)$/i.test(w));
  for (const tok of tokens) {
    if (!searchQueries.includes(tok)) {
      searchQueries.push(tok);
    }
  }

  for (const q of searchQueries) {
    try {
      const url = `${base}?action=opensearch&search=${encodeURIComponent(q)}&limit=5&format=json`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const suggestions = (data[1] || []).filter(s => s && !s.toLowerCase().includes('(disambiguation)'));
      if (suggestions.length > 0) {
        return suggestions;
      }
    } catch {
      // ignore
    }
  }
  return [];
}

async function run() {
  console.log(`\n============================================================`);
  console.log(`🔧 Article Fixer CLI: ${fandom.name} (${fandom.id})`);
  console.log(`   Source File: ${filePath}`);
  console.log(`   Mode: ${shouldApply ? '⚡ WRITE (Applying Changes)' : '👀 DRY RUN (Preview Only)'}`);
  console.log(`============================================================\n`);

  const originalArticles = CURATED_ARTICLES_BY_FANDOM[fandom.id] || [];
  if (originalArticles.length === 0) {
    console.error(`❌ No articles found in catalog for ${fandom.id}`);
    process.exit(1);
  }

  process.stdout.write(`⚡ Checking ${originalArticles.length} articles on ${fandom.apiDomain}... `);
  const metadataMap = await batchQueryMetadata(originalArticles, fandom.apiDomain, fandom.sourceType);
  console.log(`Done.`);

  const currentSet = new Set(originalArticles);
  const replacements = new Map(); // originalTitle -> newTitle
  const removals = new Map();     // originalTitle -> reason
  const claimedTitles = new Set(); // tracks unique target titles

  // 1. Process Redirects
  for (const title of originalArticles) {
    const meta = metadataMap.get(title);
    if (!meta || meta.missing || !meta.redirectedTo) continue;

    const target = meta.redirectedTo;
    // If target is already in the original list or already claimed by another redirect: duplicate!
    if (currentSet.has(target) || claimedTitles.has(target)) {
      removals.set(title, `Duplicate of existing article "${target}"`);
    } else {
      replacements.set(title, target);
      claimedTitles.add(target);
    }
  }

  // 2. Process Missing / 404 / Disambiguation Titles
  const brokenTitles = originalArticles.filter(t => {
    const meta = metadataMap.get(t);
    return meta && (meta.missing || meta.isDisambiguation);
  });

  if (brokenTitles.length > 0) {
    console.log(`🔎 Searching wiki for ${brokenTitles.length} missing/broken titles...`);

    for (const title of brokenTitles) {
      const suggestions = await searchWikiCandidates(title, fandom.apiDomain, fandom.sourceType);
      if (suggestions.length === 0) {
        removals.set(title, 'No matching article found on wiki (404)');
        continue;
      }

      // Pick top candidate
      const candidate = suggestions[0];

      // Check if candidate is already in the list or already claimed
      if (currentSet.has(candidate) || claimedTitles.has(candidate)) {
        removals.set(title, `Sub-topic or duplicate of "${candidate}"`);
      } else {
        replacements.set(title, candidate);
        claimedTitles.add(candidate);
      }
    }
  }

  // Display Proposed Changes
  console.log(`\n------------------------------------------------------------`);
  console.log(`📋 Proposed Fixes Summary:`);
  console.log(`   🔄 Replacements / Canonical Title Updates: ${replacements.size}`);
  console.log(`   🗑️  Removals (Duplicates / Sub-topics / 404s):    ${removals.size}`);
  console.log(`   ✅ Unchanged Valid Articles:                 ${originalArticles.length - replacements.size - removals.size}`);
  console.log(`------------------------------------------------------------\n`);

  if (replacements.size > 0) {
    console.log(`🔄 Title Replacements (${replacements.size}):`);
    for (const [from, to] of replacements.entries()) {
      console.log(`   "${from}"  -->  "${to}"`);
    }
    console.log();
  }

  if (removals.size > 0) {
    console.log(`🗑️  Articles to Remove (${removals.size}):`);
    for (const [title, reason] of removals.entries()) {
      console.log(`   "${title}"  (${reason})`);
    }
    console.log();
  }

  if (!shouldApply) {
    console.log(`💡 To apply these changes directly to ${filePath}, run:`);
    console.log(`   npm run fix -- --fandom=${fandom.id} --write\n`);
    return;
  }

  // Phase: Apply changes directly to the source file
  console.log(`💾 Applying changes to ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1. Apply replacements
  for (const [from, to] of replacements.entries()) {
    // Exact string in quotes
    const quoteRegex = new RegExp(`(["'])${escapeRegExp(from)}\\1`, 'g');
    content = content.replace(quoteRegex, `$1${to}$1`);
  }

  // 2. Remove discarded lines cleanly
  for (const [removeTitle, reason] of removals.entries()) {
    // Matches the line with optional trailing comma and whitespace
    const lineRegex = new RegExp(`^[ \\t]*["']${escapeRegExp(removeTitle)}["'],?[^\\r\\n]*\\r?\\n`, 'gm');
    content = content.replace(lineRegex, '');
  }

  // Clean up any double empty lines introduced
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`🎉 Successfully updated ${filePath}!`);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
