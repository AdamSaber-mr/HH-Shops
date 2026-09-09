# Fase 1, het fundament

> Uitwerking van fase 1 uit [PLAN-VAN-AANPAK.md](../PLAN-VAN-AANPAK.md).
> Dit document gaat wel gedetailleerd in op het hoe, omdat elke latere fase hierop landt.

## Context

Het project is nu nog de kale Astro-starter: drie voorbeeldbestanden, geen adapter, geen
styling, geen database. De Neon-database is leeg. Alles moet er dus nog in.

**Waar het in deze fase om draait:** een fundament dat de fouten van de oude site
structureel onmogelijk maakt. Op de huidige site heeft geen enkel product een SKU, staan
12 maatvarianten als losse producten, en missen 256 afbeeldingen hun alt-tekst. Dat zijn
geen vergissingen van de beheerder, dat is een datamodel dat het toeliet. Het nieuwe model
dwingt het af.

## Klaar wanneer

1. `npx astro dev` start zonder fouten en `npx astro build` bouwt schoon
2. De database heeft een schema, met migratiebestanden in git
3. Een testproduct met twee maten gaat de database in en komt er weer uit
4. Een pagina toont dat product, met de juiste kleuren en het juiste font
5. Het staat live op een Vercel-testadres
6. Biome, Vitest en GitHub Actions draaien groen

## Beslissingen

| Onderwerp | Keuze | Waarom |
|---|---|---|
| Database-laag | Drizzle | Dicht op SQL, licht in serverless, migraties via drizzle-kit |
| Neon-driver | `neon-serverless` (WebSocket) | De HTTP-driver kan geen echte transacties. Bij afrekenen moeten bestelling en voorraadmutatie in een ondeelbare handeling |
| Varianten | Opties als `jsonb` op de variant | Kleur toevoegen kost later geen migratie |
| Variantregel | Elk product heeft minstens een variant | Winkelwagen en bestelproces hoeven nooit onderscheid te maken |
| Prijzen | Gehele centen, inclusief btw | Nooit floats bij geld. Nederlandse consumentenprijzen zijn inclusief |
| Omgevingsvariabelen | `astro:env` | Getypeerd, en geheimen komen gegarandeerd niet in de browserbundel |
| Hosting | Vercel, meteen in fase 1 | Platformproblemen nu vinden, niet in fase 6 |
| Gereedschap | Biome, Vitest, GitHub Actions | Alle drie nu opzetten is goedkoper dan achteraf |

Geverifieerde versies op het moment van schrijven: `astro@7.3.2`, `@astrojs/vercel@11.0.10`,
`drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `@neondatabase/serverless@1.1.0`,
`@tailwindcss/vite@4.3.3`, `@fontsource-variable/geist@5.3.0`, `@biomejs/biome@2.5.12`,
`vitest@5.0.0`, `astro-icon@1.2.0`, `@iconify-json/ph@1.2.2`.

---

## Stap 1, opruimen en projectconfiguratie

De startersbestanden weg: `src/components/Welcome.astro`, `src/assets/astro.svg`,
`src/assets/background.svg`. `Layout.astro` en `index.astro` worden herschreven.

`astro.config.mjs` krijgt:

- de Vercel-adapter met `output: 'server'`, want vrijwel alles wordt dynamisch
- `imageService: true`, zodat Vercel de afbeeldingsoptimalisatie doet
- de Tailwind v4 Vite-plugin
- een `env.schema` met `DATABASE_URL` als `context: "server", access: "secret"`

`Layout.astro` krijgt `lang="nl"`, een fatsoenlijke `<title>` en `color-scheme: light`,
omdat we bewust geen donkere modus bouwen en de pagina niet half moet omklappen op
telefoons die donker staan.

Er komt een `.env.example` in git met lege sleutels, zodat duidelijk is wat er nodig is.
De echte `.env` blijft erbuiten, die staat al in `.gitignore`.

> Let op: `drizzle-kit` draait buiten Astro om en ziet `astro:env` niet. Die leest `.env`
> rechtstreeks via dotenv in `drizzle.config.ts`. Beide wegen wijzen naar dezelfde
> variabele. Dat is geen duplicatie maar twee verschillende contexten.

## Stap 2, het styling-fundament

Tailwind v4 via de Vite-plugin, niet via PostCSS. In `src/styles/global.css` komt
`@import "tailwindcss"` plus een `@theme`-blok met de tokens uit het ontwerp:

| Token | Waarde | Gebruik |
|---|---|---|
| `--color-canvas` | `#FAFAF9` | paginaachtergrond |
| `--color-surface` | `#FFFFFF` | kaarten en panelen |
| `--color-border` | `#E7E5E4` | randen en scheidingslijnen |
| `--color-text` | `#1C1917` | koppen en bodytekst |
| `--color-text-muted` | `#78716C` | secundaire tekst |
| `--color-accent` | `#1F5E3D` | knoppen, links, prijs |
| `--color-accent-hover` | `#16452C` | hover |
| `--color-danger` | `#B91C1C` | uitverkocht en foutmeldingen |
| `--radius-control` | `6px` | knoppen en invoervelden |
| `--radius-card` | `8px` | kaarten en panelen |

Geist komt uit `@fontsource-variable/geist`, dus zelf gehost. Geen `<link>` naar Google
Fonts: dat kost een extra verbinding en lekt bezoekgegevens naar Google.

Iconen via `astro-icon` met `@iconify-json/ph` (Phosphor). Alleen de iconen die we echt
gebruiken komen in de bundel. Zelf SVG-paden tekenen doen we niet.

De ontwerpregels staan in `.agents/skills/design-taste-frontend/SKILL.md`. Relevant hier:
een accentkleur door de hele site, een vaste afrondingsschaal, geen em-dash of en-dash in
zichtbare tekst, geen emoji.

## Stap 3, de database

Drizzle met de `neon-serverless` driver. De verbinding komt in `src/db/client.ts` en wordt
eenmalig aangemaakt en hergebruikt, zodat we niet per serverless-aanroep een nieuwe
WebSocket opzetten.

Migratieopzet:

- `drizzle.config.ts` in de projectroot, schema wijst naar `src/db/schema.ts`
- `drizzle-kit generate` maakt SQL-bestanden in `drizzle/`, **die gaan mee in git**
- `drizzle-kit migrate` voert ze uit
- We gebruiken `push` niet buiten losse experimenten om. Zonder migratiebestanden kun je
  niet reconstrueren hoe de database aan zijn vorm is gekomen
- Migraties draaien niet automatisch bij een Vercel-build, dat is te riskant. Ze gaan
  handmatig via een npm-script

De eerste migratie zet ook `pg_trgm` en `unaccent` aan. Die hebben we nodig voor het
zoeken in fase 3, en nu meenemen kost een regel.

## Stap 4, het datamodel

Zes tabellen. Elke keuze hieronder repareert iets dat op de oude site misgaat.

**`categories`**

`id`, `slug` (uniek), `name`, `description`, `parent_id` (verwijst naar zichzelf, mag
leeg), `position`, tijdstempels. De negen categorieen zijn nu plat, maar `parent_id` ligt
klaar zodat subcategorieen later geen verbouwing zijn.

**`products`**

`id`, `slug` (uniek), `name`, `short_description`, `description`, `brand`, `status`
(`draft` / `active` / `archived`), `option_names` (tekstarray, bijvoorbeeld `["Maat"]`),
`seo_title`, `seo_description`, tijdstempels.

`status` in plaats van een simpele aan-uitvlag, zodat de klant aan een product kan werken
zonder het meteen zichtbaar te maken.

**`product_variants`**

`id`, `product_id`, `sku` (**uniek en verplicht**), `options` (`jsonb`, bijvoorbeeld
`{"Maat": "M"}`), `price_cents`, `compare_at_price_cents` (mag leeg), `vat_rate`
(standaard 21), `stock_quantity`, `position`, `is_active`, tijdstempels.

Waarborgen in de database zelf:

- `CHECK (price_cents >= 0)` en `CHECK (stock_quantity >= 0)`, zodat negatieve voorraad
  onmogelijk is en niet afhangt van of de applicatiecode het goed doet
- `UNIQUE (product_id, options)`, zodat je niet per ongeluk twee keer maat M aanmaakt
- een GIN-index op `options`, voor het filteren in fase 3

Dat `sku` verplicht is, is de directe reparatie van "0 van 94 producten heeft een
artikelnummer". De migratie in fase 2 moet ze dus genereren, er is geen ontsnapping.

**`product_images`**

`id`, `product_id`, `variant_id` (mag leeg, voor als een maat een eigen foto krijgt),
`url`, **`alt` verplicht**, `width`, `height`, `position`, tijdstempel.

`alt` staat op `NOT NULL`. Dat is de reparatie van de 256 ontbrekende alt-teksten: een
afbeelding zonder alt-tekst kan de database niet in.

`width` en `height` zijn verplicht, zodat de layout niet verspringt tijdens het laden.

**`product_categories`**

Koppeltabel met `product_id` plus `category_id` als samengestelde sleutel. Een product kan
in meerdere categorieen staan, wat op de oude site ook al zo is.

**Wat er bewust nog niet in zit:** winkelwagens, bestellingen en beheerders. Die horen bij
fase 4 en 5. Ze nu al modelleren betekent gokken naar hoe het afrekenen werkt.

## Stap 5, de verticale plak

Het bewijs dat alles samenwerkt.

`scripts/seed-dev.ts` zet er een realistisch testproduct in: een product met twee maten,
twee afbeeldingen met alt-tekst, gekoppeld aan een categorie. Realistisch en niet
`test123`, want dan zie je meteen of lange Nederlandse productnamen de layout breken.

De startpagina wordt tijdelijk een pagina die dat product uit de database haalt en toont.
Dat bewijst in een keer dat serverside renderen werkt, dat de databaseverbinding staat,
dat de tokens en Geist geladen zijn, en dat afbeeldingen door de optimalisatie van Vercel
gaan. Meteen ook iets dat je aan de klant kunt laten zien, in plaats van het
Astro-welkomstscherm.

In fase 3 wordt dit de echte startpagina.

## Stap 6, gereedschap

**Biome** voor opmaak en controle, met een `biome.json` die aansluit op de
Astro-conventies. Een commando, en veel sneller dan ESLint en Prettier apart.

**Vitest** met een eerste test die iets echts controleert. Bijvoorbeeld een helper die
centen naar een Nederlandse prijsweergave omzet, want `1495` moet `14,95` worden met een
komma en niet met een punt. Zo staat de opstelling er en is meteen duidelijk waar tests
voor bedoeld zijn.

**GitHub Actions** die bij elke push de Biome-controle, de tests en de build draait.
Zonder databasegeheimen: de build moet slagen zonder verbinding, anders staat het geheim
straks in de workflow.

## Stap 7, Vercel

Project koppelen, `DATABASE_URL` instellen voor preview en productie, en deployen naar een
testadres. Vanaf dat moment krijgt elke branch een eigen preview-link.

Het domein `hh-shops.nl` blijft voorlopig naar WordPress wijzen. Omzetten gebeurt pas in
fase 6, als alles er staat.

---

## Verificatie

```bash
npx astro dev --background     # zoals in CLAUDE.md
npx astro dev logs
npx astro build                # moet schoon bouwen
npx vitest run
npx biome check .
```

Puntsgewijs nalopen:

1. **Migraties** draaien op een schone database zonder fouten, en de SQL-bestanden staan
   in git
2. **Waarborgen werken.** Probeer bewust een variant met negatieve voorraad, een
   afbeelding zonder alt-tekst en twee varianten met dezelfde opties toe te voegen. Alle
   drie moeten door de database geweigerd worden, niet door de applicatiecode
3. **Het seed-script** is twee keer achter elkaar te draaien zonder dubbele rijen
4. **De pagina** toont het testproduct met beide maten, de juiste kleuren en Geist
5. **Geen geheimen in de browser.** Zoek in de gebouwde bestanden naar de
   databasegegevens, die mogen daar nergens in staan
6. **Live op Vercel**, met daar dezelfde pagina en een werkende databaseverbinding
7. **GitHub Actions** groen op de branch

## Open punten

1. **Het Neon-wachtwoord moet gerouleerd worden.** Het huidige is via de chat gedeeld.
   Adam pakt dit aan het eind op. Tot die tijd werken we met het bestaande wachtwoord.
   Zodra het gewisseld is, moet het op drie plekken bij: lokale `.env`, Vercel preview en
   Vercel productie
2. **Btw-tarief.** Alles staat standaard op 21 procent. Dat klopt voor huishoudelijke
   artikelen, cosmetica, tassen en schoeisel. Mocht er ooit iets bij komen dat onder 9
   procent valt, dan kan dat per variant afwijken zonder aanpassing
3. **Het merkveld** staat op producten. Of HH Shops daar iets mee doet is een vraag voor
   de klant, maar het veld kost niets en de oude data heeft het niet ingevuld
