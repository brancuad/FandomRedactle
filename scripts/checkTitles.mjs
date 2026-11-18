const checks = [
  "The Queen's Gambit",
  "In Harm's Way",
  "Empress Yeshe",
  "Kuzon (Seven Havens)",
];
const BASE = "https://avatar.fandom.com/api.php";
for (const t of checks) {
  const url = `${BASE}?action=parse&page=${encodeURIComponent(t)}&prop=text&redirects=1&format=json&origin=*`;
  const d = await fetch(url).then(r => r.json());
  if (d.error) console.log(`${t} -> MISSING (${d.error.code})`);
  else console.log(`${t} -> OK: ${d.parse.title}`);
}
