/**
 * Audits newly added avatar.fandom.com articles by hitting the MediaWiki parse API.
 * Reports: OK (exists + has content), REDIRECT (resolved to different title), MISSING, or SHORT.
 */

const NEW_ARTICLES = [
  // ATLA Book 1
  "The Boy in the Iceberg",
  "The Avatar Returns",
  "The Southern Air Temple",
  "The Warriors of Kyoshi",
  "The King of Omashu",
  "Imprisoned",
  "The Spirit World (Winter Solstice, Part 1)",
  "Avatar Roku (Winter Solstice, Part 2)",
  "The Waterbending Scroll",
  "Jet (episode)",
  "The Great Divide",
  "The Storm",
  "The Blue Spirit",
  "The Fortune Teller",
  "Bato of the Water Tribe",
  "The Deserter",
  "The Northern Air Temple",
  "The Waterbending Master",
  "The Siege of the North, Part 1",
  "The Siege of the North, Part 2",
  // ATLA Book 2
  "The Avatar State",
  "The Cave of Two Lovers",
  "Return to Omashu",
  "The Swamp",
  "Avatar Day (episode)",
  "The Blind Bandit",
  "Zuko Alone",
  "The Chase",
  "Bitter Work",
  "The Library",
  "The Desert",
  "The Serpent's Pass",
  "The Drill",
  "City of Walls and Secrets",
  "The Tales of Ba Sing Se",
  "Appa's Lost Days",
  "Lake Laogai",
  "The Earth King",
  "The Guru",
  "The Crossroads of Destiny",
  // ATLA Book 3
  "The Awakening",
  "The Headband",
  "The Painted Lady",
  "Sokka's Master",
  "The Beach",
  "The Avatar and the Fire Lord",
  "The Runaway",
  "The Puppetmaster",
  "Nightmares and Daydreams",
  "The Day of Black Sun, Part 1: The Invasion",
  "The Day of Black Sun, Part 2: The Eclipse",
  "The Western Air Temple",
  "The Firebending Masters",
  "The Boiling Rock, Part 1",
  "The Boiling Rock, Part 2",
  "The Southern Raiders",
  "The Ember Island Players",
  "Sozin's Comet, Part 1: The Phoenix King",
  "Sozin's Comet, Part 2: The Old Masters",
  "Sozin's Comet, Part 3: Into the Inferno",
  "Sozin's Comet, Part 4: Avatar Aang",
  // LOK Book 1
  "Welcome to Republic City",
  "A Leaf in the Wind",
  "The Revelation",
  "The Voice in the Night",
  "The Spirit of Competition",
  "And the Winner Is...",
  "The Aftermath",
  "When Extremes Meet",
  "Out of the Past",
  "Turning the Tides",
  "Skeletons in the Closet",
  "Endgame",
  // LOK Book 2
  "Rebel Spirit",
  "The Southern Lights",
  "Civil Wars, Part 1",
  "Civil Wars, Part 2",
  "Peacekeepers",
  "The Sting",
  "Beginnings, Part 1",
  "Beginnings, Part 2",
  "The Guide",
  "A New Spiritual Age",
  "Night of a Thousand Stars",
  "Harmonic Convergence (episode)",
  "Darkness Falls",
  "Light in the Dark",
  // LOK Book 3
  "A Breath of Fresh Air",
  "Rebirth",
  "The Queen's Gambit",
  "In Harm's Way",
  "The Metal Clan",
  "Old Wounds",
  "Original Airbenders",
  "The Terror Within",
  "The Stakeout",
  "Long Live the Queen",
  "The Ultimatum",
  "Enter the Void",
  "Venom of the Red Lotus",
  // LOK Book 4
  "After All These Years",
  "Korra Alone",
  "The Coronation",
  "The Calling",
  "Enemy at the Gates",
  "The Battle of Zaofu",
  "Reunion",
  "Remembrances",
  "Beyond the Wilds",
  "Operation Beifong",
  "Kuvira's Gambit",
  "Day of the Colossus",
  "The Last Stand",
  // Seven Havens characters
  "Pavi",
  "Nisha",
  "Agam",
  "Karthik",
  "Jae",
  "Daemin",
  "Empress Yeshe",
  "Kuzon (Seven Havens)",
  // Seven Havens locations/factions
  "Ellora",
  "Akasha",
  "New Ba Sing Se",
  "Feather Mountain",
  "Republic Forest",
  "The Cataclysm",
  "The Faceless",
  // Seven Havens episodes
  "On the Horizon",
  "Into the Storm",
  "The Order",
  "The Faceless (episode)",
  "The One Left Behind",
  "Night of the Afflicted",
  "What Lies Beneath",
  "The Envoys: Part One",
  "The Envoys: Part Two",
  "Ghosts and Spirits",
  "Battle of the Ruins",
  "The Dome",
  "The Root Chakra",
];

const BASE = "https://avatar.fandom.com/api.php";
const CONCURRENCY = 5;
const MIN_CONTENT_LENGTH = 200;

async function checkArticle(title) {
  const url = `${BASE}?action=parse&page=${encodeURIComponent(title)}&prop=text&redirects=1&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { title, status: "HTTP_ERROR", detail: res.status };
    const data = await res.json();

    if (data.error) {
      return { title, status: "MISSING", detail: data.error.code };
    }

    const resolvedTitle = data.parse?.title || title;
    const content = data.parse?.text?.["*"] || "";
    const textLength = content.replace(/<[^>]+>/g, "").length;

    if (textLength < MIN_CONTENT_LENGTH) {
      return { title, status: "SHORT", detail: `${textLength} chars, resolved="${resolvedTitle}"` };
    }

    const wasRedirected = resolvedTitle.toLowerCase() !== title.toLowerCase();
    return {
      title,
      status: wasRedirected ? "REDIRECT" : "OK",
      detail: wasRedirected ? `→ "${resolvedTitle}"` : `${textLength} chars`,
    };
  } catch (e) {
    return { title, status: "ERROR", detail: e.message };
  }
}

async function runInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(`\r  Checked ${Math.min(i + batchSize, items.length)}/${items.length}...`);
  }
  console.log();
  return results;
}

console.log(`\nAuditing ${NEW_ARTICLES.length} new articles against avatar.fandom.com...\n`);
const results = await runInBatches(NEW_ARTICLES, CONCURRENCY, checkArticle);

const ok       = results.filter(r => r.status === "OK");
const redirect = results.filter(r => r.status === "REDIRECT");
const missing  = results.filter(r => r.status === "MISSING");
const short    = results.filter(r => r.status === "SHORT");
const errors   = results.filter(r => r.status === "ERROR" || r.status === "HTTP_ERROR");

console.log(`✅ OK:       ${ok.length}`);
console.log(`↩️  REDIRECT: ${redirect.length}`);
console.log(`❌ MISSING:  ${missing.length}`);
console.log(`⚠️  SHORT:    ${short.length}`);
console.log(`💥 ERRORS:   ${errors.length}`);

if (redirect.length) {
  console.log("\n--- REDIRECTS (title may need updating) ---");
  redirect.forEach(r => console.log(`  "${r.title}"  ${r.detail}`));
}
if (missing.length) {
  console.log("\n--- MISSING (no article found) ---");
  missing.forEach(r => console.log(`  "${r.title}"  [${r.detail}]`));
}
if (short.length) {
  console.log("\n--- SHORT (stub / disambiguation page) ---");
  short.forEach(r => console.log(`  "${r.title}"  [${r.detail}]`));
}
if (errors.length) {
  console.log("\n--- ERRORS ---");
  errors.forEach(r => console.log(`  "${r.title}"  [${r.detail}]`));
}
