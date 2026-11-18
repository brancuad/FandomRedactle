import fs from 'fs';
import path from 'path';
import jitiFactory from 'jiti';

const jiti = jitiFactory(process.cwd());

// Load project data
const { SUPPORTED_FANDOMS } = jiti('./src/data/fandoms.ts');
const { CURATED_ARTICLES_BY_FANDOM } = jiti('./src/data/curatedArticles.ts');

// CLI Arguments
const args = process.argv.slice(2);
function getArg(name, defaultValue = undefined) {
  const match = args.find(a => a.startsWith(`--${name}=`));
  if (match) return match.split('=')[1];
  if (args.includes(`--${name}`)) return true;
  return defaultValue;
}

const targetFandom = getArg('fandom', 'pokemon');
const mode = getArg('mode', 'deep'); // 'fast' | 'deep'
const limit = getArg('limit') ? parseInt(getArg('limit'), 10) : undefined;
const concurrency = getArg('concurrency') ? parseInt(getArg('concurrency'), 10) : 5;
const generateReport = getArg('report', true) !== 'false';
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
Fandom Redactle - Article Quality Auditor
Usage:
  node scripts/auditArticles.mjs [options]

Options:
  --fandom=<id>        Fandom ID to audit (e.g. pokemon, atla, bbus, broadway) or 'all' (default: pokemon)
  --mode=<fast|deep>   'fast' checks metadata/stubs in bulk; 'deep' parses sections & extracts (default: deep)
  --limit=<number>     Only audit the first N articles (useful for quick spot checks)
  --concurrency=<N>    Concurrent requests for deep mode (default: 5)
  --report=<true|false>Write markdown audit report to reports/ (default: true)
  --help, -h           Show this help message

Available Fandoms:
${SUPPORTED_FANDOMS.map(f => `  - ${f.id.padEnd(16)} (${f.name})`).join('\n')}
`);
  process.exit(0);
}

function getApiBase(domain, sourceType = 'fandom') {
  return sourceType === 'wikipedia'
    ? `https://${domain}/w/api.php`
    : `https://${domain}/api.php`;
}

// Decode basic HTML entities
function decodeHtml(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Fast, dependency-free HTML cleaner simulating fandomApi.ts sanitization.
 */
function parseAndScoreHtml(rawHtml, sourceType = 'fandom') {
  // 1. Detect hero image
  let hasImage = false;
  let imageUrl = null;
  const imgRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(rawHtml)) !== null) {
    const fullTag = imgMatch[0];
    const src = imgMatch[1];
    if (src && !src.startsWith('data:')) {
      if (sourceType === 'wikipedia') {
        if (fullTag.includes('infobox') || fullTag.includes('thumb')) {
          imageUrl = src;
          hasImage = true;
          break;
        }
      } else {
        if (fullTag.includes('pi-image') || fullTag.includes('portable-infobox') || fullTag.includes('thumb')) {
          imageUrl = src.replace(/\/scale-to-width-down\/\d+/, '/scale-to-width-down/600');
          hasImage = true;
          break;
        }
      }
    }
  }

  // 2. Strip unwanted containers & boilerplate
  let cleaned = rawHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<table[\s\S]*?<\/table>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<audio[\s\S]*?<\/audio>/gi, '');

  // Strip elements with noisy classes
  const noisyClasses = [
    'portable-infobox', 'infobox', 'navbox', 'toc', 'mw-editsection', 'reference',
    'gallery', 'license-description', 'page-footer', 'wds-dropdown', 'category-page__header',
    'thumb', 'messagebox', 'mw-empty-elt', 'hatnote', 'mw-references-wrap', 'refbegin',
    'reflist', 'sistersitebox', 'noprint', 'mbox-small', 'ambox', 'tmbox', 'cmbox'
  ];
  const classPattern = new RegExp(`<([a-z0-9]+)[^>]*class=["'][^"']*(?:${noisyClasses.join('|')})[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
  // Run replacement twice to handle nested noisy divs
  cleaned = cleaned.replace(classPattern, '');
  cleaned = cleaned.replace(classPattern, '');

  // 3. Extract sections, paragraphs, and list items
  const blockRegex = /<(h2|h3|p|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  const sections = [];
  let currentHeading = 'Intro';
  let currentParas = [];
  let bulletCount = 0;
  let paragraphCount = 0;
  let totalWordsInProse = 0;
  let totalWordsInBullets = 0;

  const isDiscardHeading = (h) => /^(references|see also|external links|site navigation|gallery|notes|contents)$/i.test(h);

  while ((match = blockRegex.exec(cleaned)) !== null) {
    const tag = match[1].toLowerCase();
    const rawContent = match[2].replace(/<[^>]+>/g, ' ');
    const text = decodeHtml(rawContent).trim().replace(/\s+/g, ' ');

    if (tag === 'h2' || tag === 'h3') {
      const heading = text.replace(/\[edit\]/gi, '').trim();
      if (isDiscardHeading(heading)) continue;
      if (currentParas.length > 0) {
        sections.push({ heading: currentHeading, paragraphs: [...currentParas] });
        currentParas = [];
      }
      currentHeading = heading;
    } else if (tag === 'p' || tag === 'blockquote') {
      if (text.length > 25) {
        currentParas.push(text);
        paragraphCount++;
        const words = text.split(/\s+/).filter(Boolean).length;
        totalWordsInProse += words;
      }
    } else if (tag === 'li') {
      if (text.length > 5) {
        currentParas.push('• ' + text);
        bulletCount++;
        const words = text.split(/\s+/).filter(Boolean).length;
        totalWordsInBullets += words;
      }
    }
  }

  if (currentParas.length > 0) {
    sections.push({ heading: currentHeading, paragraphs: currentParas });
  }

  const allWords = totalWordsInProse + totalWordsInBullets;
  const proseRatio = allWords > 0 ? totalWordsInProse / allWords : 0;
  const leadSection = sections[0];
  const leadWords = leadSection
    ? leadSection.paragraphs.join(' ').split(/\s+/).filter(Boolean).length
    : 0;

  return {
    wordCount: allWords,
    proseWords: totalWordsInProse,
    bulletWords: totalWordsInBullets,
    sectionCount: sections.length,
    paragraphCount,
    bulletCount,
    proseRatio,
    leadWords,
    hasImage,
    imageUrl
  };
}

/**
 * Calculates a composite 0-100 quality score for Redactle playability.
 */
function calculateQualityScore(metrics, meta) {
  const issues = [];
  let score = 0;

  if (meta.missing) {
    return { score: 0, status: 'BROKEN', issues: ['404: Article does not exist on wiki'] };
  }
  if (meta.isDisambiguation) {
    return { score: 0, status: 'REJECT', issues: ['Disambiguation page'] };
  }

  // 1. Word Count (max 40 pts)
  const wc = metrics.wordCount;
  if (wc >= 500 && wc <= 2500) {
    score += 40;
  } else if (wc >= 350 && wc < 500) {
    score += 30;
    issues.push(`Slightly short (${wc} words)`);
  } else if (wc >= 200 && wc < 350) {
    score += 20;
    issues.push(`Short stub (${wc} words)`);
  } else if (wc < 200) {
    score += 5;
    issues.push(`Critical: Very short stub (<200 words: ${wc})`);
  } else if (wc > 2500 && wc <= 4500) {
    score += 35;
  } else if (wc > 4500 && wc <= 7000) {
    score += 25;
    issues.push(`Long article (${wc} words)`);
  } else {
    score += 15;
    issues.push(`Extremely long (${wc} words)`);
  }

  // 2. Prose vs Bullet Ratio (max 25 pts)
  if (metrics.proseRatio >= 0.75) {
    score += 25;
  } else if (metrics.proseRatio >= 0.50) {
    score += 18;
    issues.push(`Moderate bullet list content (${Math.round((1 - metrics.proseRatio) * 100)}% lists)`);
  } else if (metrics.proseRatio >= 0.30) {
    score += 10;
    issues.push(`Heavy listicle / stats (${Math.round((1 - metrics.proseRatio) * 100)}% lists)`);
  } else {
    score += 2;
    issues.push(`Critical: Overwhelmingly bullet lists/stats (<30% prose)`);
  }

  // 3. Lead Section Depth (max 20 pts)
  if (metrics.leadWords >= 50) {
    score += 20;
  } else if (metrics.leadWords >= 30) {
    score += 15;
  } else if (metrics.leadWords >= 15) {
    score += 8;
    issues.push(`Weak lead section (${metrics.leadWords} words)`);
  } else {
    score += 0;
    issues.push(`Critical: Missing or empty lead section (<15 words)`);
  }

  // 4. Hero Image (max 15 pts)
  if (metrics.hasImage) {
    score += 15;
  } else {
    issues.push('No hero image found');
  }

  // Check if title redirected
  if (meta.redirectedTo) {
    issues.push(`Redirects to: "${meta.redirectedTo}"`);
  }

  let status = 'EXCELLENT';
  if (score < 40 || wc < 200) status = 'REJECT';
  else if (score < 65) status = 'WARNING';
  else if (score < 80) status = 'PLAYABLE';

  return { score, status, issues };
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
 * Deep audits a single article by fetching its parsed HTML.
 */
async function deepAuditArticle(title, domain, sourceType, meta) {
  if (meta.missing || meta.isDisambiguation) {
    const evaluation = calculateQualityScore({ wordCount: 0, proseRatio: 0, leadWords: 0, hasImage: false }, meta);
    return { title, meta, metrics: null, evaluation };
  }

  const base = getApiBase(domain, sourceType);
  const target = meta.resolvedTitle || title;
  const parseUrl = `${base}?action=parse&page=${encodeURIComponent(target)}&prop=text&redirects=1&format=json&origin=*`;

  try {
    const res = await fetch(parseUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.error) {
      const evaluation = { score: 0, status: 'BROKEN', issues: [data.error.info || 'API parse error'] };
      return { title, meta, metrics: null, evaluation };
    }

    const rawHtml = data.parse?.text?.['*'] || '';
    const metrics = parseAndScoreHtml(rawHtml, sourceType);
    const evaluation = calculateQualityScore(metrics, meta);

    return { title, meta, metrics, evaluation };
  } catch (err) {
    const evaluation = { score: 0, status: 'BROKEN', issues: [`Network fetch failed: ${err.message}`] };
    return { title, meta, metrics: null, evaluation };
  }
}

/**
 * Runs concurrency-limited async tasks.
 */
async function asyncPool(limit, items, iteratorFn) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    results.push(p);

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

/**
 * Main auditing runner for a given fandom.
 */
async function auditFandom(fandomConfig) {
  const list = CURATED_ARTICLES_BY_FANDOM[fandomConfig.id];
  if (!list || list.length === 0) {
    console.log(`⚠️  No articles found for fandom: ${fandomConfig.id}`);
    return null;
  }

  const articlesToTest = limit ? list.slice(0, limit) : list;
  console.log(`\n============================================================`);
  console.log(`🔍 Auditing ${fandomConfig.name} (${fandomConfig.id})`);
  console.log(`   Wiki: ${fandomConfig.apiDomain} (${fandomConfig.sourceType || 'fandom'})`);
  console.log(`   Articles: ${articlesToTest.length} (Mode: ${mode.toUpperCase()})`);
  console.log(`============================================================`);

  // Step 1: Bulk metadata check
  process.stdout.write(`⚡ Running batch metadata pre-check... `);
  const metadataMap = await batchQueryMetadata(articlesToTest, fandomConfig.apiDomain, fandomConfig.sourceType);
  console.log(`Done.`);

  let auditResults = [];

  if (mode === 'fast') {
    // Fast mode: assess based on byte length and metadata
    for (const title of articlesToTest) {
      const meta = metadataMap.get(title) || { missing: true };
      const issues = [];
      let score = 70;
      let status = 'PLAYABLE';

      if (meta.missing) {
        score = 0;
        status = 'BROKEN';
        issues.push('404: Article missing');
      } else if (meta.isDisambiguation) {
        score = 0;
        status = 'REJECT';
        issues.push('Disambiguation page');
      } else {
        if (meta.byteLength < 2500) {
          score = 30;
          status = 'REJECT';
          issues.push(`Likely stub (<2.5KB raw size: ${meta.byteLength} bytes)`);
        } else if (meta.byteLength < 5000) {
          score = 55;
          status = 'WARNING';
          issues.push(`Small article (<5KB: ${meta.byteLength} bytes)`);
        }
        if (meta.redirectedTo) {
          issues.push(`Redirects to: "${meta.redirectedTo}"`);
        }
      }

      auditResults.push({
        title,
        meta,
        metrics: { rawBytes: meta.byteLength || 0 },
        evaluation: { score, status, issues }
      });
    }
  } else {
    // Deep mode: parse HTML content and calculate playability metrics
    let completed = 0;
    process.stdout.write(`📖 Parsing articles [0/${articlesToTest.length}]...`);

    auditResults = await asyncPool(concurrency, articlesToTest, async (title) => {
      const meta = metadataMap.get(title) || { missing: true };
      const res = await deepAuditArticle(title, fandomConfig.apiDomain, fandomConfig.sourceType, meta);
      completed++;
      if (completed % 10 === 0 || completed === articlesToTest.length) {
        process.stdout.write(`\r📖 Parsing articles [${completed}/${articlesToTest.length}]...`);
      }
      return res;
    });
    console.log(` Complete!`);
  }

  // Aggregate stats
  const total = auditResults.length;
  const excellent = auditResults.filter(r => r.evaluation.status === 'EXCELLENT').length;
  const playable = auditResults.filter(r => r.evaluation.status === 'PLAYABLE').length;
  const warnings = auditResults.filter(r => r.evaluation.status === 'WARNING').length;
  const rejected = auditResults.filter(r => r.evaluation.status === 'REJECT').length;
  const broken = auditResults.filter(r => r.evaluation.status === 'BROKEN').length;
  const redirected = auditResults.filter(r => r.meta?.redirectedTo).length;

  console.log(`\n📊 Audit Summary:`);
  console.log(`   ✅ Excellent:  ${excellent} (${Math.round((excellent / total) * 100)}%)`);
  console.log(`   🟢 Playable:   ${playable} (${Math.round((playable / total) * 100)}%)`);
  console.log(`   ⚠️  Warnings:   ${warnings} (${Math.round((warnings / total) * 100)}%)`);
  console.log(`   ❌ Rejected:   ${rejected} (${Math.round((rejected / total) * 100)}%)`);
  if (broken > 0) console.log(`   🚨 Broken/404: ${broken} (${Math.round((broken / total) * 100)}%)`);
  if (redirected > 0) console.log(`   🔄 Redirects:  ${redirected}`);

  // Highlight problematic articles
  const flagList = auditResults.filter(r => r.evaluation.status === 'REJECT' || r.evaluation.status === 'BROKEN');
  if (flagList.length > 0) {
    console.log(`\n🚨 Critical Issues (Stubs / Broken / Disambiguation):`);
    flagList.slice(0, 15).forEach(f => {
      console.log(`   - "${f.title}": ${f.evaluation.issues.join('; ')}`);
    });
    if (flagList.length > 15) {
      console.log(`   ... and ${flagList.length - 15} more (see full report)`);
    }
  }

  // Generate Markdown Report
  if (generateReport) {
    const reportDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const reportPath = path.join(reportDir, `audit-${fandomConfig.id}.md`);
    let md = `# Article Quality Audit: ${fandomConfig.name} (${fandomConfig.id})\n\n`;
    md += `**Date:** ${new Date().toISOString().split('T')[0]}  \n`;
    md += `**Wiki Base:** ${fandomConfig.apiDomain} (${fandomConfig.sourceType || 'fandom'})  \n`;
    md += `**Total Audited:** ${total} articles  \n\n`;

    md += `## Summary Breakdown\n\n`;
    md += `| Category | Count | Percentage |\n`;
    md += `| :--- | :--- | :--- |\n`;
    md += `| 🌟 Excellent (Score 80-100) | ${excellent} | ${Math.round((excellent / total) * 100)}% |\n`;
    md += `| 🟢 Playable (Score 65-79) | ${playable} | ${Math.round((playable / total) * 100)}% |\n`;
    md += `| ⚠️ Warnings (Score 40-64) | ${warnings} | ${Math.round((warnings / total) * 100)}% |\n`;
    md += `| ❌ Rejected / Stubs (Score < 40) | ${rejected} | ${Math.round((rejected / total) * 100)}% |\n`;
    md += `| 🚨 Broken / 404 | ${broken} | ${Math.round((broken / total) * 100)}% |\n`;
    md += `| 🔄 Redirects Found | ${redirected} | - |\n\n`;

    if (flagList.length > 0) {
      md += `## ❌ Action Required: Rejected & Broken Articles\n\n`;
      md += `Articles that should be removed or replaced from \`${fandomConfig.id}Articles.ts\`:\n\n`;
      md += `| Article Title | Status | Issues | Words |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      flagList.forEach(item => {
        const words = item.metrics?.wordCount ?? 'N/A';
        md += `| **${item.title}** | \`${item.evaluation.status}\` | ${item.evaluation.issues.join(', ')} | ${words} |\n`;
      });
      md += `\n`;
    }

    const warningList = auditResults.filter(r => r.evaluation.status === 'WARNING');
    if (warningList.length > 0) {
      md += `## ⚠️ Suboptimal Articles (Warnings)\n\n`;
      md += `Articles with low word counts, weak lead sections, or list-heavy structures:\n\n`;
      md += `| Article Title | Score | Words | Prose % | Issues |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      warningList.forEach(item => {
        const words = item.metrics?.wordCount ?? 'N/A';
        const prose = item.metrics?.proseRatio != null ? `${Math.round(item.metrics.proseRatio * 100)}%` : 'N/A';
        md += `| **${item.title}** | ${item.evaluation.score} | ${words} | ${prose} | ${item.evaluation.issues.join(', ')} |\n`;
      });
      md += `\n`;
    }

    const redirectList = auditResults.filter(r => r.meta?.redirectedTo);
    if (redirectList.length > 0) {
      md += `## 🔄 Redirect Cleanups\n\n`;
      md += `Update these titles to match their canonical target title directly:\n\n`;
      md += `| Listed Title | Canonical Target Title |\n`;
      md += `| :--- | :--- |\n`;
      redirectList.forEach(item => {
        md += `| \`${item.title}\` | \`${item.meta.redirectedTo}\` |\n`;
      });
      md += `\n`;
    }

    fs.writeFileSync(reportPath, md, 'utf-8');
    console.log(`\n📄 Detailed markdown report saved to: reports/audit-${fandomConfig.id}.md`);
  }

  return { total, excellent, playable, warnings, rejected, broken, redirected };
}

async function main() {
  if (targetFandom === 'all') {
    for (const fandom of SUPPORTED_FANDOMS) {
      await auditFandom(fandom);
    }
  } else {
    const fandom = SUPPORTED_FANDOMS.find(f => f.id === targetFandom);
    if (!fandom) {
      console.error(`❌ Fandom "${targetFandom}" not recognized. Run with --help to see supported IDs.`);
      process.exit(1);
    }
    await auditFandom(fandom);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
