import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { altProblems, cleanName } from '../../src/lib/tekst.ts';
import { CATALOGUS_DIR, imageFileName, readCatalogus, readSnapshot } from './lezen.ts';

/*
 * Een pagina met elke unieke foto, de producten waar hij bij hoort en de
 * alt-tekst uit afbeeldingen.json, om de alt-teksten te schrijven en na te
 * lopen. Lokaal openen, de foto's komen rechtstreeks uit de snapshot.
 *
 * Het bestand wordt gegenereerd en staat niet in git.
 */

type Gebruik = { id: number; naam: string; positie: number; van: number };

const snapshot = readSnapshot();
const catalogus = readCatalogus();

const gebruik = new Map<string, Gebruik[]>();
for (const p of [...snapshot.products, ...snapshot.variations]) {
	p.images.forEach((img, index) => {
		const file = imageFileName(img.src);
		const list = gebruik.get(file) ?? [];
		if (!list.some((g) => g.id === p.id)) {
			list.push({ id: p.id, naam: cleanName(p.name), positie: index, van: p.images.length });
		}
		gebruik.set(file, list);
	});
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

let ontbreekt = 0;
let fout = 0;
const kaarten = [...gebruik.entries()]
	.sort(([a], [b]) => a.localeCompare(b))
	.map(([file, uses]) => {
		const info = catalogus.afbeeldingen[file];
		const problems = info?.alt ? altProblems(info.alt) : [];
		let status: string;
		if (info?.overslaan) status = '<p class="status skip">Overgeslagen</p>';
		else if (!info?.alt) {
			ontbreekt++;
			status = '<p class="status missing">Alt-tekst ontbreekt</p>';
		} else if (problems.length > 0) {
			fout++;
			status = `<p class="status missing">${esc(problems.join(', '))}</p>`;
		} else status = '';
		return `
<article>
  <img src="../wc-snapshot/images/${encodeURIComponent(file)}" alt="" loading="lazy">
  <div>
    <p class="file">${esc(file)}</p>
    <ul>${uses.map((u) => `<li>${u.id}: ${esc(u.naam)} (foto ${u.positie + 1} van ${u.van})</li>`).join('')}</ul>
    ${status}
    ${info?.alt ? `<p class="alt">${esc(info.alt)}</p>` : ''}
    ${info?.opmerking ? `<p class="note">${esc(info.opmerking)}</p>` : ''}
  </div>
</article>`;
	});

const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Contactsheet HH Shops</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; margin: 2rem; color: #1c1917; background: #fafaf9; }
  h1 { font-size: 1.25rem; }
  article { display: grid; grid-template-columns: 240px 1fr; gap: 1rem; padding: 1rem; margin-bottom: 1rem; background: #fff; border: 1px solid #e7e5e4; border-radius: 8px; }
  img { width: 240px; height: 240px; object-fit: contain; background: #fff; border: 1px solid #e7e5e4; }
  .file { font-family: ui-monospace, monospace; color: #6b6560; margin: 0 0 .5rem; }
  ul { margin: 0 0 .5rem; padding-left: 1.2rem; }
  .alt { font-size: 1.05rem; margin: .25rem 0; }
  .note { color: #6b6560; font-style: italic; }
  .status { font-weight: 600; }
  .missing { color: #b91c1c; }
  .skip { color: #6b6560; }
</style>
</head>
<body>
<h1>Contactsheet: ${gebruik.size} unieke foto's, ${ontbreekt} zonder alt-tekst, ${fout} met een probleem</h1>
${kaarten.join('\n')}
</body>
</html>
`;

const out = join(CATALOGUS_DIR, 'contactsheet.html');
writeFileSync(out, html);
console.log(
	`[contactsheet] ${out}: ${gebruik.size} foto's, ${ontbreekt} zonder alt-tekst, ${fout} met een probleem`,
);
