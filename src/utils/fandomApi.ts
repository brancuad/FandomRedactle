import { Article, ArticleSection } from '../types';

/**
 * Fetch and sanitize an article from a Fandom wiki by title, or pick a random page.
 */
export async function fetchWikiArticle(
  title?: string,
  domain = 'avatar.fandom.com'
): Promise<Article> {
  let targetTitle = title;
  let pageId = 'LIVE';

  // Step 1: If no title is specified, query a random page from namespace 0
  if (!targetTitle) {
    const randUrl = `https://${domain}/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`;
    const randRes = await fetch(randUrl);
    if (!randRes.ok) throw new Error(`Failed to query ${domain}`);
    const randData = await randRes.json();
    const randomPage = randData.query?.random?.[0];

    if (!randomPage || !randomPage.title) {
      throw new Error("No page returned from random wiki query");
    }
    targetTitle = randomPage.title;
    pageId = String(randomPage.id || 'LIVE');
  }

  if (!targetTitle) {
    throw new Error("Article title is missing");
  }

  // Step 2: Fetch parsed HTML for target article
  const parseUrl = `https://${domain}/api.php?action=parse&page=${encodeURIComponent(targetTitle)}&prop=text&redirects=1&format=json&origin=*`;
  const parseRes = await fetch(parseUrl);
  if (!parseRes.ok) throw new Error(`Failed to fetch article content for ${targetTitle}`);
  const parseData = await parseRes.json();

  if (parseData.error) {
    throw new Error(parseData.error.info || `Could not find article "${targetTitle}"`);
  }

  if (parseData.parse?.title) {
    targetTitle = parseData.parse.title;
  }

  const rawHtml = parseData.parse?.text?.['*'];
  if (!rawHtml) throw new Error("Article content was empty");

  // Step 3: DOM Parser & Sanitization
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // Extract main article hero image before stripping infoboxes
  let imageUrl: string | undefined = undefined;
  const imgCandidate = doc.querySelector<HTMLImageElement>(
    '.portable-infobox figure.pi-image img, .pi-image-thumbnail, .portable-infobox img, .infobox img, figure.thumb img, .thumbimage'
  );
  if (imgCandidate) {
    const src = imgCandidate.getAttribute('data-src') || imgCandidate.getAttribute('src') || '';
    if (src && !src.startsWith('data:')) {
      imageUrl = src.replace(/\/scale-to-width-down\/\d+/, '/scale-to-width-down/600');
    }
  }

  // Strip unwanted elements
  const stripSelectors = [
    '.portable-infobox', 'aside', '.navbox', '.toc', '#toc', '.mw-editsection',
    '.reference', 'figure', '.gallery', '.audio', 'table', 'script', 'style',
    '.license-description', '.page-footer', '.wds-dropdown', '.category-page__header',
    '.infobox', '.thumb', '.messagebox', '#icons', '.mw-empty-elt'
  ];
  stripSelectors.forEach(sel => doc.querySelectorAll(sel).forEach(el => el.remove()));

  const root = doc.querySelector('.mw-parser-output') || doc.body;

  // Extract sections & paragraphs (properly handling lead paragraphs rendered as loose inline nodes)
  const extractedSections: ArticleSection[] = [];
  let currentHeading: string | null = null;
  let currentParas: string[] = [];
  let inlineBuffer = '';

  const flushInlineBuffer = () => {
    const clean = inlineBuffer.trim().replace(/\s+/g, ' ');
    if (clean.length > 25) {
      currentParas.push(clean);
    }
    inlineBuffer = '';
  };

  const isInlineNode = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) return true;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName.toUpperCase();
      return ['B', 'I', 'EM', 'STRONG', 'A', 'SPAN', 'SUB', 'SUP', 'SMALL', 'MARK', 'FONT', 'CODE'].includes(tag);
    }
    return false;
  };

  const isDiscardHeading = (heading: string): boolean => {
    return /^(references|see also|external links|site navigation|gallery|notes|contents)$/i.test(heading);
  };

  const childNodes = Array.from(root.childNodes);

  for (const node of childNodes) {
    if (isInlineNode(node)) {
      inlineBuffer += (node.textContent || '') + ' ';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toUpperCase();

      if (tag === 'H2' || tag === 'H3') {
        flushInlineBuffer();
        const headingText = el.textContent?.replace(/\[edit\]/gi, '').trim() || '';

        if (isDiscardHeading(headingText)) {
          // Skip discardable footer sections
          continue;
        }

        if (currentParas.length > 0) {
          extractedSections.push({ heading: currentHeading, paragraphs: [...currentParas] });
          currentParas = [];
        }
        currentHeading = headingText;
      } else if (tag === 'P' || tag === 'BLOCKQUOTE') {
        flushInlineBuffer();
        const cleanP = el.textContent?.trim().replace(/\s+/g, ' ') || '';
        if (cleanP.length > 25) {
          currentParas.push(cleanP);
        }
      } else if (tag === 'UL' || tag === 'OL') {
        flushInlineBuffer();
        const lis = Array.from(el.children).filter(c => c.tagName.toUpperCase() === 'LI');
        lis.forEach(li => {
          const cleanLi = li.textContent?.trim().replace(/\s+/g, ' ') || '';
          if (cleanLi.length > 2) {
            currentParas.push('• ' + cleanLi);
          }
        });
      } else if (tag === 'DL') {
        flushInlineBuffer();
        const dds = Array.from(el.children).filter(c => ['DD', 'DT'].includes(c.tagName.toUpperCase()));
        dds.forEach(dd => {
          const cleanDd = dd.textContent?.trim().replace(/\s+/g, ' ') || '';
          if (cleanDd.length > 3) {
            currentParas.push('• ' + cleanDd);
          }
        });
      } else if (tag === 'DIV' || tag === 'SECTION') {
        // If there's an inline buffer before this container, flush it
        flushInlineBuffer();

        // Check if container has internal paragraphs, headings, or lists
        const internalNodes = el.querySelectorAll('p, h2, h3, ul, ol, dl, blockquote');
        if (internalNodes.length > 0) {
          internalNodes.forEach(inner => {
            const inTag = inner.tagName.toUpperCase();
            if (inTag === 'H2' || inTag === 'H3') {
              const hText = inner.textContent?.replace(/\[edit\]/gi, '').trim() || '';
              if (!isDiscardHeading(hText)) {
                if (currentParas.length > 0) {
                  extractedSections.push({ heading: currentHeading, paragraphs: [...currentParas] });
                  currentParas = [];
                }
                currentHeading = hText;
              }
            } else if (inTag === 'P' || inTag === 'BLOCKQUOTE') {
              const cleanP = inner.textContent?.trim().replace(/\s+/g, ' ') || '';
              if (cleanP.length > 20) {
                currentParas.push(cleanP);
              }
            } else if (inTag === 'UL' || inTag === 'OL') {
              // Avoid duplicate parsing if nested inside another list
              if (inner.parentElement?.closest('ul, ol')) return;
              const lis = Array.from(inner.children).filter(c => c.tagName.toUpperCase() === 'LI');
              lis.forEach(li => {
                const cleanLi = li.textContent?.trim().replace(/\s+/g, ' ') || '';
                if (cleanLi.length > 2) {
                  currentParas.push('• ' + cleanLi);
                }
              });
            } else if (inTag === 'DL') {
              const dds = Array.from(inner.children).filter(c => ['DD', 'DT'].includes(c.tagName.toUpperCase()));
              dds.forEach(dd => {
                const cleanDd = dd.textContent?.trim().replace(/\s+/g, ' ') || '';
                if (cleanDd.length > 3) {
                  currentParas.push('• ' + cleanDd);
                }
              });
            }
          });
        } else {
          const cleanDiv = el.textContent?.trim().replace(/\s+/g, ' ') || '';
          if (cleanDiv.length > 35) {
            currentParas.push(cleanDiv);
          }
        }
      }
    }
  }

  // Flush any remaining inline text
  flushInlineBuffer();

  if (currentParas.length > 0) {
    extractedSections.push({ heading: currentHeading, paragraphs: [...currentParas] });
  }

  if (extractedSections.length === 0 || extractedSections.flatMap(s => s.paragraphs).length === 0) {
    throw new Error("Article too short or contains no readable text");
  }

  // Clean title: remove parenthetical disambiguations like "(character)" or "(location)"
  const finalTitle = parseData.parse?.title?.replace(/\s*\(.*?\)\s*/g, '').trim() || targetTitle;
  const uniquePageId = String(parseData.parse?.pageid || finalTitle.toLowerCase().replace(/[^a-z0-9]/g, '_'));

  return {
    id: `${domain}_${uniquePageId}`,
    title: finalTitle,
    sections: extractedSections,
    imageUrl
  };
}

// Backward compatible alias
export const fetchRandomWikiArticle = (domain?: string) => fetchWikiArticle(undefined, domain);
