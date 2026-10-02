import { clamp } from './math.js';
export const NF = 2400;
export const MAX_CHAPTERS = 8;

// Every thread gets a story. Authored stories in stories.json claim their lines; every other
// line is a placeholder drawn from the photographs, repeats welcome.
export function buildStories(photos, authored = [], journal = [], curated = false) {
  const stories = new Array(NF);
  for (const s of authored) stories[s.line] = { ...s };
  for (let i = 0; i < NF; i++) {
    if (stories[i]) continue;
    if (curated) {
      // The close-up mosaic repeats the collection visually; chapter galleries retain
      // their unique photographs and factual metadata.
      const routes = authored.filter(s => s.id.startsWith('route-'));
      // Interleave chapters across nearby photo fibres; every fifth fibre is poetry.
      const photoOrdinal = i - Math.floor((i + 2) / 5);
      const source = routes[photoOrdinal % routes.length];
      const all = source.gallery ?? source.chapters;
      const gcd = (a, b) => b ? gcd(b, a % b) : a;
      let stride = 17; while (gcd(stride, all.length) !== 1) stride++;
      const offset = (i * stride) % all.length;
      const gallery = all;
      const indices = Array.from({length:Math.min(MAX_CHAPTERS, all.length)}, (_, k) => (offset + k) % all.length).sort((a,b) => a-b);
      const previews = indices.map(k => all[k]);
      stories[i] = { ...source, id: `line-${i + 1}`, line: i, kind: 'mosaic', nav_hidden: true, chapters: previews, gallery };
      continue;
    }
    const source = authored.length ? authored[i % authored.length] : null;
    const all = source?.gallery ?? photos.map(p => ({ photo: p.id, caption: p.description }));
    const start = (i * 7) % all.length;
    const gallery = all.slice(start).concat(all.slice(0, start));
    stories[i] = { id: `line-${i + 1}`, line: i, title: source?.title ?? '长征 · 沿途留影', chapters: gallery.slice(0, MAX_CHAPTERS), gallery };

  }
  const byId = new Map(photos.map((p, j) => [p.id, j]));
  for (const s of stories) {
    const hydrate = c => {
      const layer = byId.get(String(c.photo)), p = photos[layer];
      return { ...c, layer, src: p.src, aspect: p.aspect, caption: c.caption ?? p.description, credit: c.credit ?? p.photographer, date: c.date ?? p.date, text: c.text ?? p.text, source: p.source_page, material: p.material_type, kind: p.kind };
    };
    if (s.kind === 'light') { s.col = [.36, .045, .085]; s.rgb = '92 11 22'; continue; }
    s.chapters = s.chapters.map(hydrate);
    if (s.gallery) s.gallery = s.gallery.map(hydrate);
    // Journal entries: authored text wins; otherwise the shared template, spread so that every
    // story, however short, begins with the first entry and ends with the last.
    const n = s.chapters.length, T = journal.length;
    s.chapters.forEach((c, k) => {
      const t = T ? journal[Math.round(k * (T - 1) / Math.max(1, n - 1))] : {};
      c.date = c.date ?? t.date ?? '';
      c.text = c.text ?? t.text ?? '';
    });
    colourStory(s, photos);
  }
  return stories;
}

// A luminous version of the story's average colour: its thread's colour and its page's accent.
function colourStory(s, photos) {
  let r = 0, g = 0, b = 0;
  for (const c of s.chapters) { const a = photos[c.layer].avg; r += a[0]; g += a[1]; b += a[2]; }
  const n = s.chapters.length; r /= n; g /= n; b /= n;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (mx !== mn) h = mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
  const S = clamp(sat * 1.9 + 0.2, 0.45, 0.9), L = 0.62;
  const C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs((h % 2) - 1)), m = L - C / 2;
  const [rr, gg, bb] = h < 1 ? [C, X, 0] : h < 2 ? [X, C, 0] : h < 3 ? [0, C, X] : h < 4 ? [0, X, C] : h < 5 ? [X, 0, C] : [C, 0, X];
  s.col = [.58, .12, .18];
  s.rgb = s.col.map(v => Math.round(v * 255)).join(' ');
}
