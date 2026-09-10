# Fase 2, het assortiment overzetten

> Uitwerking van fase 2 uit [PLAN-VAN-AANPAK.md](../PLAN-VAN-AANPAK.md).
> Net als bij fase 1 gaat dit document wel in op het hoe, omdat de import het
> enige moment is waarop oud en nieuw naast elkaar bestaan. Wat we hier niet
> vastleggen, is straks weg.

## Context

Fase 1 is op 10 september 2026 in `main` gemerged. Daar staat alles waar deze
fase op landt: het Drizzle-schema met zes tabellen,
de migraties, een Vercel-deploy, en in `data/wc-snapshot/` een volledige kopie
van de oude site van 9 september 2026. Fase 2 werkt vanaf die kopie, niet vanaf
de live site.

Het schema van fase 1 heeft al op deze fase voorgesorteerd. Vier waarborgen
bepalen hoe de import eruit moet zien:

| Waarborg in de database | Gevolg voor de import |
|---|---|
| `product_images.url` mag geen `/wp-content/` bevatten | Elke afbeelding moet eerst naar Vercel Blob, anders gaat hij er niet in |
| `alt` is verplicht, 5 tot 250 tekens, en mag geen bestandsnaam zijn | 227 alt-teksten moeten geschreven worden. Overnemen kan niet, er is niets om over te nemen |
| `sku` is verplicht en uniek, formaat `HH-...` in hoofdletters | Artikelnummers moeten gegenereerd worden, en wel zo dat een tweede run dezelfde nummers geeft |
| `name` mag geen HTML-entiteit, en-dash of em-dash bevatten | 20 productnamen moeten opgeschoond worden voordat ze erin kunnen |

Daarnaast is er `legacy_urls`, precies voor deze fase gemaakt: de tabel bewaart
welk oud WooCommerce-id welk nieuw product is geworden. Dat is de sleutel
waarmee de import herhaalbaar wordt, en in fase 6 de bron voor de doorverwijzingen.

**Twee dingen die vandaag opnieuw gecontroleerd zijn:**

- De oude site draait nog, maar `per_page=100` geeft inmiddels een
  "Database Error" (HTTP 500). Met `per_page=50` in twee pagina's lukt het wel.
  De opnieuw-ophalen-instructie in `data/wc-snapshot/README.md` klopt dus niet
  meer en moet bijgewerkt worden. De inhoud van de snapshot is nog identiek aan
  wat de site nu teruggeeft: 94 producten, dezelfde prijzen en voorraden.
- De Neon-koppeling in deze werkomgeving ziet geen project "HH Shops". Het
  project staat volgens het fase 1-document in Adams eigen Neon-account. Wie de
  import draait, heeft de verbindingsreeksen van de `dev`-branch nodig, plus een
  Blob-token van het Vercel-project.

**Waar het in deze fase om draait:** de 94 producten gaan over, maar niet zoals
ze zijn. Het datamodel weigert bewust de rommel van de oude site. Deze fase is
dus voor de helft verhuizen en voor de helft opruimen, en het opruimwerk dat
niet te automatiseren is (alt-teksten, samenvoegbeslissingen) moet in git
landen als data, zodat een tweede run het niet weggooit.

## Klaar wanneer

1. `npm run import` vult een lege `dev`-branch in een keer vanuit
   `data/wc-snapshot/` plus `data/catalogus/`, zonder handwerk in de database
2. Een tweede run direct erna meldt nul wijzigingen
3. Elk oud product heeft een rij in `legacy_urls`, elke oude categorie ook. Geen gaten
4. Alle maat- en kleurvarianten zijn samengevoegd: 19 oude producten worden er 8,
   en de shop toont geen enkel product meer met een maat in de naam
5. Elk product heeft een artikelnummer per variant, elke afbeelding heeft een
   alt-tekst, breedte en hoogte, en staat in Vercel Blob als WebP
6. De 54 PNG's zijn van 22 MB naar minder dan 3 MB, het geheel van 30 MB naar
   minder dan 8 MB
7. De productpagina's van fase 1 tonen op het Vercel-testadres het echte
   assortiment, inclusief de werkschoenen met zes maten
8. Biome, Vitest en de build zijn groen. De tests dekken de opschoonregels

## Beslissingen

| Onderwerp | Keuze | Waarom |
|---|---|---|
| Bron | `data/wc-snapshot/`, nooit de live API | De snapshot staat in git en verandert niet. De live site valt om bij grote pagina's en kan elk moment uitgaan |
| Handwerk | Aparte bestanden in `data/catalogus/`, in git | Alt-teksten en samenvoegbeslissingen zijn mensenwerk. In het script zouden ze bij elke aanpassing meeveranderen, in de database zouden ze bij elke run overschreven worden |
| Artikelnummers | `HH-` plus volgnummer vanaf 1001, per variant een optie-achtervoegsel | Voorbeeld `HH-1001`, `HH-1002-38`, `HH-1007-BLAUW`. Het volgnummer staat in een register in git dat alleen groeit, dus een tweede run geeft dezelfde nummers en fase 5 telt gewoon door |
| Herkenning bij herhalen | `legacy_urls` op oud id, daarna slug, daarna invoegen | Slug alleen werkt niet: 19 producten worden er 8. Het oude id is de enige stabiele sleutel |
| Wat de import mag verwijderen | Alleen varianten en afbeeldingen van producten die hij zelf heeft aangemaakt | Producten die de klant in fase 5 zelf toevoegt hebben geen `legacy_urls`-rij en blijven onaangeraakt |
| Slugs | Oude productslugs blijven, behalve bij samengevoegde producten en `-2`-achtervoegsels | De oude URL's zijn de rankings. Wat verandert, staat in `legacy_urls` en wordt in fase 6 doorverwezen |
| Afbeeldingen | `sharp` naar WebP, kwaliteit 82, maximaal 1200 px, doorzichtige PNG op wit | Het grootste bestand is 1536 px breed, de mediaan 550. Vrijwel niets wordt kleiner van formaat, alles wordt lichter |
| Opslag | Vercel Blob, pad `producten/<bestandsnaam>.webp` | Naam afgeleid van het oude bestand, dus dezelfde foto bij meerdere producten wordt een keer geupload. Bestaat het al, dan slaat de import hem over |
| Uitverkochte producten | Gaan mee als `active` met voorraad 0 | Het plan zegt dat ze niet mogen verdwijnen. Hoe ze getoond worden is fase 3, en wat ermee gebeurt is klantvraag 1 |
| Variaties in `legacy_urls` | Niet als aparte rij | Een variatie heeft op de oude site geen eigen pad, alleen `?attribute_maten=38` achter het pad van de ouder. De `path`-kolom laat geen vraagteken toe. Varianten worden op SKU herkend |
| SEO-velden | Leeg laten | `seo_title` en `seo_description` verzinnen we niet. Fase 3 leidt ze af uit naam en korte beschrijving zolang ze leeg zijn |

Geverifieerde versies op het moment van schrijven: `@vercel/blob@2.8.0`,
`sharp@0.35.4`, `sanitize-html@2.17.7`. De rest staat al in fase 1.

---

## Stap 1, wat de oude data echt bevat

Voordat er een regel code komt, de cijfers. Alles hieronder is gemeten aan de
snapshot en vandaag opnieuw aan de live site.

**Producten.** 94 stuks, 92 `simple` en 2 `variable`. De twee variabele zijn de
werkschoenen (maten 38 tot en met 43) en de motivatie-drinkfles (blauw, roze,
groen), samen negen variatie-id's. Geen enkel product heeft een SKU, een merk,
een tag of een review. Er zijn geen aanbiedingsprijzen. Prijzen komen als hele
centen binnen (`"1495"`), dus die hoeven nergens omgerekend te worden.

**Voorraad.** `stock_availability.text` bevat het echte aantal. 32 producten
staan op "Uitverkocht". Twee producten melden 998 en 999 stuks, dat zijn
duidelijk invulwaarden en geen tellingen. Bij de werkschoenen meldt het
bovenliggende product 50 op voorraad terwijl vier van de zes maten uitverkocht
zijn: het aantal van een variabel product is dus onbruikbaar, alleen dat van de
variaties telt.

**De maat- en kleurvarianten.** Het fase 1-document telt zestien losse producten
van zes groepen. Het zijn er zeventien: `729 Waist Trainer Corset L` heeft geen
"maat" in de naam en is bij het tellen gemist. Met de twee variabele producten
erbij is dit de volledige lijst, na overleg met Adam op 10 september:

| Nieuw product | Oude id's | Optie | Waarden |
|---|---|---|---|
| Zwemvest Hond met Handvat | 532, 736, 737, 533 | Maat | XXS, XS, S, M |
| Werkschoenen, veiligheidsschoenen (29,95) | 842 (variaties 844 t/m 849) | Maat | 38 t/m 43 |
| Veiligheidsschoenen, werkschoenen (39,95) | 727, 728, 441 | Maat | 36, 37, 41 |
| Waist Trainer Corset | 733, 734, 729, 735 | Maat | S, M, L, XL |
| Hond Draagtas | 738, 742 | Maat | S, M |
| Fietsonderbroek met Zeem | 373, 525 | Maat | XL, XXL |
| Fluffy Pantoffels | 866, 869 | Kleur | Khaki, Zwart |
| Motivatie Drinkfles 2L | 123 (variaties 871 t/m 873) | Kleur | Blauw, Roze, Groen |

Negentien oude producten worden acht nieuwe. Het assortiment gaat daarmee van
94 naar 83 producten met in totaal 101 varianten.

Drie dingen in die tabel zagen er eerst uit als een probleem en zijn het niet:

- De werkschoenen van 29,95 en de losse maten van 39,95 zijn volgens Adam
  verschillende schoenen. Ze blijven dus twee producten, elk met eigen maten, en
  `441` is geen dubbel van variatie `847` maar gewoon maat 41 van de duurdere
  schoen. Het fase 1-document en het commentaar bij `legacy_urls` in
  `schema.ts` noemen die twee als voorbeeld van een dubbel; dat commentaar
  wordt bijgewerkt
- De fietsonderbroek zonder maat in de naam is maat XL. Dat staat in zijn eigen
  beschrijving ("Unisex -XL"), en de lange tekst noemt L, XL en XXL als
  beschikbare maten
- De pantoffels zonder kleur in de naam zijn khaki. Dat staat in de korte
  beschrijving en is op de foto te zien. Beide kleuren kosten 10,95 en zijn
  tijdelijk uitverkocht. De korte beschrijvingen noemen ook verschillende
  maten (38/39 en 40/41), waarschijnlijk een kopieerfout, en dat komt in het
  rapport

Wat er bewust niet in staat: de verpakkingsgroottes. `Relaxdays schoenen
organizer` in 12, 30 en 50 stuks, `Schoenen opbergsysteem` in 10, 20 en 24
stuks, en de borstelset in 3- en 4-delig. Dat zijn losse artikelen met eigen
prijzen en deels eigen foto's, en zo staan ze ook bij bol.com. Ze blijven apart,
zoals Adam heeft bevestigd. Samenvoegen kan later alsnog, uit elkaar halen is
lastiger.

Ook apart blijft `355 Honden Draagtas`: andere foto's, andere prijs,
uitverkocht. Dat is een ander product dan de `Hond Draagtas` in S en M.

**Teksten.** Twintig namen bevatten een en-dash, negentien als `&#8211;` en een
als letterlijk teken. Vijf namen zijn langer dan 60 tekens, de langste 80. Twee
namen gebruiken een `|` als scheidingsteken. De lange beschrijvingen zijn HTML
met `<p>`, `<ul>`, `<strong>`, maar ook 33 `<div>`'s, 6 `<section>`'s, koppen
van `<h1>` tot `<h3>`, en bij vier producten de `data-start`-attributen die
ChatGPT meegeeft bij kopieren. Tien producten hebben emoji in de tekst. Acht
korte beschrijvingen zijn langer dan de 600 tekens die het schema toelaat, de
langste 2394, en elf bevatten koppen of CSS-klassen. Een korte beschrijving die
een kopie van de lange is, is geen korte beschrijving.

**Afbeeldingen.** 269 verwijzingen naar 227 unieke bestanden, 30 MB in totaal.
Dertien verwijzingen hebben een alt-tekst, en die dertien zijn trefwoordenlijsten
met pijpen ertussen ("Hair Brush |Tangle | Haarborstels antiklit"), dus ook die
worden herschreven. Twee producten, 842 en 857, hebben de categoriegrafiek van
"Schoenen" respectievelijk "Slippers" als eerste productfoto staan. Dat zijn
geen productfoto's en ze gaan niet mee. De Store API geeft geen afmetingen mee,
alleen een `srcset` waaruit de breedte af te leiden is. De hoogte moet uit het
bestand zelf komen.

**Categorieen.** Negen, allemaal plat, allemaal met een afbeelding, geen enkele
met een beschrijving. Achtendertig producten staan alleen in "Overige". Dat is
een inhoudelijk probleem voor de klant en fase 3, niet voor de import: wij zetten
over wat er staat. Het pad op de oude site is `/product-categorie/<slug>`, en
een slug is `tassen-rugzakken-hondentassen-etc`.

## Stap 2, de opzet

Drie lagen, elk met een eigen plek:

```
data/wc-snapshot/        ruwe kopie van de oude site, verandert nooit
data/catalogus/          beslissingen en teksten van mensen, in git
scripts/import/          de code die de twee samenvoegt en wegschrijft
```

`data/catalogus/` bevat vijf bestanden:

| Bestand | Inhoud | Wie vult het |
|---|---|---|
| `groepen.json` | De acht samenvoegingen: welke oude id's, welke optienaam, welke waarde per id, welk id de teksten en foto's levert, en de nieuwe naam en slug | Wij, eenmalig, tabel uit stap 1 |
| `afbeeldingen.json` | Per uniek bestand: de alt-tekst, en eventueel `overslaan: true` | Alt-teksten met de hand, zie stap 5 |
| `producten.json` | Per oud id alleen wat afwijkt van de automatische opschoning: een betere naam, een merk, een handgeschreven korte beschrijving | Wij, alleen waar de automatische versie niet goed genoeg is |
| `categorieen.json` | Per oude slug: nieuwe slug, naam, volgorde en de alt-tekst van de categoriefoto | Wij, eenmalig, negen regels |
| `artikelnummers.json` | Register van oud id naar volgnummer | Het script, bij de eerste run. Daarna alleen aanvullen, nooit hernummeren |

Het script vult wat automatisch kan en weigert te draaien zolang er een
alt-tekst ontbreekt. Dat is streng, maar het alternatief is een import die
stilletjes 200 foto's laat liggen.

De code in `scripts/import/` deelt zich op langs dezelfde lijn: lezen van de
snapshot, opschonen van teksten, groeperen tot producten, verwerken en uploaden
van afbeeldingen, wegschrijven naar de database. De opschoonfuncties zijn puur
(tekst in, tekst uit) en krijgen tests met de echte lelijke gevallen uit de
snapshot als invoer. De verbinding loopt via het bestaande `scripts/db.ts`.

Drie commando's:

```bash
npm run import:contactsheet   # maakt een HTML-pagina met alle 227 foto's, om alt-teksten bij te schrijven
npm run import:check          # leest, schoont op, controleert, rapporteert. Schrijft niets
npm run import                # doet het echt, tegen de DATABASE_URL uit .env
```

`import:check` voert dezelfde controles uit die de database ook doet (lengte,
formaat, verboden tekens) maar dan voordat er ook maar een byte geupload is. Een
import die na 180 uploads vastloopt op een te lange naam is niet herhaalbaar,
die is vervelend.

## Stap 3, samenvoegen en artikelnummers

Voor elk product in `groepen.json` bepaalt het "leidende" oude id de naam, de
beschrijvingen, de categorieen en de foto's. De andere id's leveren alleen hun
variant: optiewaarde, prijs, voorraad. In alle acht groepen zijn de foto's van
de samengevoegde producten identiek, met een uitzondering: de twee pantoffels
hebben elk een eigen foto, in hun eigen kleur. Die twee foto's worden allebei
gekoppeld, elk aan zijn eigen variant via `variant_id`. Daar is die kolom voor.
Verder meldt de import in het rapport elke foto die door het samenvoegen niet
meegaat, zodat we kunnen ingrijpen als het toch gebeurt.

De naam van een samengevoegd product verliest zijn maat: `Zwemvest Hond met
Handvat maat XXS` wordt `Zwemvest Hond met Handvat`. Dat gebeurt niet met een
regex op het woord "maat", want `729 Waist Trainer Corset L` heeft dat woord
niet. De nieuwe naam staat gewoon in `groepen.json`.

`option_names` op het product wordt `["Maat"]` of `["Kleur"]`, met hoofdletter
en in enkelvoud. De oude data heeft `maten` en `Kleuren`, en `optionSummary()` in
`src/lib/catalog.ts` verwacht `maat` en `kleur` om er "4 maten" van te maken.

**Artikelnummers.** Het register in `artikelnummers.json` koppelt het leidende
oude id aan een volgnummer, beginnend bij 1001 in oplopende volgorde van oud id.
Het nummer wordt de SKU van een product zonder opties (`HH-1001`) en de basis
voor varianten (`HH-1002-38`, `HH-1007-BLAUW`, `HH-1005-XXL`). Het achtervoegsel
is de optiewaarde in hoofdletters met alles wat geen letter of cijfer is
vervangen door een streepje, dus `40/41` zou `40-41` worden. Dat voldoet aan de
formaatcontrole `^[A-Z0-9]+(-[A-Z0-9]+)*$` in het schema.

Bestaat het register nog niet, dan maakt het script het aan en stopt met de
melding dat het gecommit moet worden. Bestaat het wel, dan worden alleen
onbekende id's toegevoegd. Fase 5 pakt het hoogste nummer plus een.

> Let op: het seed-script van fase 1 heeft het zwemvest al in de database gezet
> met SKU's als `HH-ZWH-001-XXS`, zonder `legacy_urls`-rij. De import vindt dat
> product op slug, neemt het over, geeft het een legacy-rij en vervangt de
> varianten door de nieuwe met de nieuwe nummers. Daarna is `scripts/seed-dev.ts`
> overbodig en gaat weg, inclusief het npm-script. Het bewijs dat het leverde,
> levert de import nu.

## Stap 4, teksten opschonen

Alles automatisch, met `producten.json` als noodrem voor wat niet goed genoeg
wordt.

**Namen.** HTML-entiteiten decoderen. Een en-dash of em-dash met spaties
eromheen wordt een komma plus spatie, een `|` ook. Dubbele spaties en spaties
voor leestekens weg. Dan controleren tegen dezelfde regels als het schema: 3 tot
120 tekens, geen entiteiten, geen dashes. `Melkpoeder toren &#8211; set van 2
&#8211; BPA vrij` wordt zo `Melkpoeder toren, set van 2, BPA vrij`. Namen die na
opschonen nog langer zijn dan 60 tekens komen in het rapport. Voor die vijf en
voor de twee met een pijp schrijven we een betere naam in `producten.json`, want
`Gaming Headset | Headset met Microfoon geschikt voor Consoles en PC` wordt met
een komma niet beter.

**Lange beschrijvingen.** Door `sanitize-html` met een korte lijst toegestane
elementen: `p`, `ul`, `ol`, `li`, `strong`, `em`, `br`, `h3`. Alle attributen
weg, dus ook de `class`- en `data-start`-rommel. `b` wordt `strong`, `h1` en
`h2` worden `h3` (de productnaam is al de `h1` van de pagina), `div`, `section`
en `span` worden uitgepakt zonder inhoud te verliezen. Daarna op de tekst:
entiteiten decoderen, emoji verwijderen, en-dashes met spaties naar komma's,
lege alinea's en reeksen `<br>` opruimen. Een reeks alinea's die elk met een
streepje beginnen, zoals bij de werkschoenen, wordt een echte lijst. Het
resultaat moet minstens 20 tekens zijn en geen `<script` bevatten, wat het
schema ook controleert.

**Korte beschrijvingen.** Altijd platte tekst, nooit HTML. De bron wordt
ontdaan van opmaak, en als hij langer is dan 300 tekens, dan alleen de eerste
alinea, afgekapt op een zinseinde. Het schema staat 600 toe, maar een korte
beschrijving van 600 tekens is op een productkaart niet kort. Wat afgekapt is,
staat in het rapport, zodat we voor die producten kunnen beslissen of een
handgeschreven versie in `producten.json` beter is.

**Merk.** Waar de naam er een bevat (Relaxdays, Tigernu, Geweo, Life's Green,
Eddy Toys, YAR, Elite) zetten we het in `producten.json`. Niet automatisch: een
woord dat op een merk lijkt is niet altijd een merk.

## Stap 5, afbeeldingen en alt-teksten

**Verwerken.** Elk uniek bestand uit `data/wc-snapshot/images/` gaat door
`sharp`: orientatie uit de metadata toepassen, passend maken binnen 1200 bij
1200 zonder vergroten, doorzichtige achtergrond op wit (er zit een
`removebg-preview` tussen), metadata strippen, opslaan als WebP op kwaliteit 82.
Breedte en hoogte lezen we na het verkleinen uit het resultaat, want die zijn
verplicht in het schema en de Store API geeft ze niet.

De verwachting, te verifieren bij de eerste run: de 54 PNG's van 22 MB naar
onder de 3 MB, de 170 JPG's van 8 MB naar ongeveer 5 MB, het geheel van 30 naar
onder de 8 MB. De grootste bestanden zijn de `Copilot_*.png`'s van 1,1 tot 1,9
MB, en juist die krimpen het hardst.

**Uploaden.** Naar Vercel Blob met `@vercel/blob`, `access: 'public'`,
`addRandomSuffix: false`, onder `producten/<bestandsnaam-als-slug>.webp`.
Categoriefoto's onder `categorieen/<slug>.webp`. Voor elke upload eerst een
`head()`: bestaat het pad al, dan overslaan. Zo is een tweede run gratis en
blijft de import werken als hij halverwege afbreekt. Het token
`BLOB_READ_WRITE_TOKEN` komt in `.env` en `.env.example`, alleen voor scripts.
De shop leest Blob via gewone URL's en heeft het token niet nodig.

> Let op: `astro.config.mjs` staat op twee plekken alleen `/producten/**` toe
> als extern beeldpad. Voor de categoriefoto's moet `/categorieen/**` erbij, op
> beide plekken. Vergeet je er een, dan geeft het beeld-endpoint een 403.

De drie zwemvestfoto's die in fase 1 met de hand zijn geupload
(`zwemvest-hond-met-handvat-1.jpg` en verder) worden vervangen door de versies
uit de import en kunnen daarna uit Blob.

**Alt-teksten.** Dit is het meeste handwerk van de fase en het is niet te
omzeilen. 227 unieke bestanden, elk een zin van 5 tot 250 tekens die beschrijft
wat er te zien is, met de productnaam erin als dat natuurlijk is. Geen
trefwoordenlijsten, geen pijpen, geen bestandsnamen. Het schema weigert
`Post-HH-Shops-15` en `550x687`, maar "productfoto" komt er ook niet in, dat is
een regel die wij zelf hanteren.

`npm run import:contactsheet` maakt daarvoor een pagina met elke foto, de
producten waar hij bij hoort, en de huidige alt-tekst uit `afbeeldingen.json`.
De werkverdeling is afgesproken: wij schrijven alle 227, de klant loopt ze na op
de contactsheet. Dat is sneller dan andersom en de klant ziet meteen welke
foto's slecht zijn, wat weer input is voor klantvraag 2 over echte productfoto's.

Een bestand met `overslaan: true` in `afbeeldingen.json` wordt niet geupload en
nergens gekoppeld. Dat is voor de twee categoriegrafieken die als productfoto
staan en voor wat we op de contactsheet verder nog tegenkomen.

Dezelfde foto bij meerdere producten (42 verwijzingen) wordt een bestand in
Blob en meerdere rijen in `product_images`. Het schema staat dat toe.
Samengevoegde producten krijgen elke foto een keer, ook als die bij alle vier de
oude producten stond.

## Stap 6, categorieen en oude links

De negen categorieen gaan over met een schone slug: `tassen` in plaats van
`tassen-rugzakken-hondentassen-etc`, `computer-artikelen` mag blijven. Naam,
volgorde en de alt-tekst van de categoriefoto staan in `categorieen.json`. De
foto zelf gaat via dezelfde weg als de productfoto's naar Blob, want ook
`categories.image_url` mag na de overstap niet meer naar WordPress wijzen.
Beschrijvingen blijven leeg, die zijn er niet.

`product_categories` wordt gevuld zoals de oude data het heeft: een product kan
in twee categorieen staan, en dat blijft zo. "Overige" gaat mee als gewone
categorie.

**`legacy_urls`** krijgt 103 rijen:

- 94 keer `product`: pad `/product/<oude slug>`, wijzend naar het nieuwe
  product, en bij een samengevoegd product ook naar de variant
- 9 keer `category`: pad `/product-categorie/<oude slug>`, wijzend naar de
  categorie

Paden zonder domein en zonder slash aan het eind, passend bij de controle
`^/[a-z0-9/-]+$` in het schema. De negen variaties krijgen geen rij, zie de
beslissingen. De enumwaarde `variation` blijft daardoor ongebruikt. Dat is
onschuldig, maar het commentaar bij de tabel in `schema.ts` beschrijft het
anders en wordt bijgewerkt.

## Stap 7, het importscript

De volgorde is de belangrijkste ontwerpkeuze:

1. Lees de snapshot en de vijf catalogusbestanden
2. Bouw het volledige doelmodel in het geheugen: 9 categorieen, 83 producten,
   101 varianten, alle afbeeldingen, 103 legacy-paden
3. Controleer alles tegen de schemaregels. Ontbreekt er een alt-tekst, is een
   naam te lang, botst een SKU: stoppen, alles melden, niets schrijven. Tot
   hier is `import:check`
4. Verwerk en upload de afbeeldingen. Idempotent per bestand, dus een afgebroken
   run doet bij herstart alleen wat nog ontbreekt
5. Schrijf naar de database in een transactie. Alles of niets, en het is
   meteen de tweede keer dat de WebSocket-driver bewijst dat hij transacties
   kan
6. Rapporteer: aantallen ingevoegd, bijgewerkt, verwijderd, plus de lijst
   aandachtspunten uit stap 4 van dit document

In de transactie, per tabel dezelfde aanpak als het seed-script van fase 1:
upsert op de natuurlijke sleutel, daarna verwijderen wat niet meer in de bron
staat, zodat het resultaat convergeert en niet stapelt.

| Tabel | Herkend op | Convergeert |
|---|---|---|
| `categories` | slug | Niet: categorieen verwijderen doet de import nooit |
| `products` | `legacy_urls` op oud id, anders slug, anders nieuw | Alleen producten met een legacy-rij worden bijgewerkt |
| `product_variants` | SKU | Varianten van een geimporteerd product die niet in de bron staan, gaan weg |
| `product_images` | product plus URL | Idem voor afbeeldingen |
| `product_categories` | samengestelde sleutel | Koppelingen die niet in de bron staan, gaan weg |
| `legacy_urls` | soort plus oud id | Niet: een oude link vergeten we nooit |

De regel "alleen wat een legacy-rij heeft" is wat fase 5 veilig maakt. Een
product dat de klant zelf toevoegt, kent de import niet en laat hij met rust.
De import kan dus ook na livegang nog draaien om bijvoorbeeld een betere
alt-tekst door te zetten, zonder dat het beheer van de klant erbij inschiet.

Het script draait als de andere scripts: `node --env-file=.env
scripts/import/index.ts`, tegen de `dev`-branch van Neon. De `main`-branch
wordt pas gevuld bij de livegang in fase 6, met precies hetzelfde commando en
een andere verbindingsreeks. Daarom moet dit herhaalbaar zijn: de echte run is
niet de eerste.

## Stap 8, tests

Vitest-tests voor de pure functies, met invoer die letterlijk uit de snapshot
komt:

- Naam opschonen: `Melkpoeder toren &#8211; set van 2 &#8211; BPA vrij`, de
  broekhangers van Life's Green met hun letterlijke en-dash en het
  registered-teken, en een naam met `|`
- HTML opschonen: een beschrijving met `data-start`, een met `<div>` en
  `<section>`, een met emoji, een met alinea's die met streepjes beginnen
- Korte beschrijving: een van 2394 tekens die op een zinseinde binnen 300 moet
  landen
- Voorraad uit tekst: `"53 op voorraad"` wordt 53, `"Uitverkocht"` wordt 0
- SKU-achtervoegsel: `XXS`, `38`, `Blauw`, `40/41`
- Alt-tekst geldig: de regels uit het schema plus onze eigen

Geen tests tegen de echte database of Blob. Wat daar mis kan gaan, vangt
`import:check` en de verificatie hieronder.

---

## Verificatie

```bash
npm run import:contactsheet    # alt-teksten schrijven en nalopen
npm run import:check           # moet eindigen met nul blokkerende punten
npm run import                 # eerste run, op een lege dev-branch
npm run import                 # tweede run, moet nul wijzigingen melden
npm run lint && npm test && npm run build
```

Puntsgewijs nalopen:

1. **De aantallen kloppen.** 9 categorieen, 83 producten, 101 varianten, 103
   rijen in `legacy_urls`. Het aantal afbeeldingsrijen staat in het rapport en
   moet gelijk zijn aan 269 min de overgeslagen en de dubbele van samengevoegde
   producten
2. **Niets is kwijt.** De som van alle voorraadaantallen en de som van alle
   prijzen over de varianten zijn gelijk aan dezelfde sommen over de snapshot,
   gerekend per variatie voor de twee variabele producten. Twee SQL-regels
3. **Elk product heeft minstens een variant en minstens een afbeelding.** Ook
   SQL. Het schema dwingt dat niet af, de import wel
4. **De tweede run is leeg.** Nul ingevoegd, nul bijgewerkt, nul verwijderd
5. **Blob is licht.** Totale omvang van `producten/` onder 8 MB, geen bestand
   boven 300 KB. Aflezen in het Vercel-dashboard of via `list()`
6. **De pagina's werken.** Op het Vercel-testadres de werkschoenen openen (zes
   maten, vier uitverkocht), de pantoffels (twee kleuren met elk een eigen
   foto), de drinkfles (drie kleuren), een product met een lange naam, en een
   uitverkocht product. Dit is de opstelling van fase 1 met
   echte data, meer niet
7. **Geen WordPress meer.** Een telling van afbeeldingsrijen met `hh-shops.nl`
   in de URL geeft nul. Het schema garandeert dat al, maar het is de belofte van
   deze fase en dus de moeite van een regel waard
8. **Groen.** Biome, Vitest, de build, en GitHub Actions op de branch

## Open punten

1. **Voorraad 998 en 999** bij de schoenenorganizers. Gaan er letterlijk zo in.
   Fase 3 toont boven een grens gewoon "op voorraad" zonder getal, en de klant
   corrigeert het in fase 5
2. **De snapshot-README** noemt `per_page=100`, wat inmiddels een 500 geeft.
   Bijwerken naar twee pagina's van 50
3. **Het lettertype.** Het plan zei Geist, en zo staat het in `main`. Adam heeft
   bij het bouwen van de startpagina op de branch `homepage` bewust voor Plus
   Jakarta Sans gekozen. Het plan is daarop aangepast. Fase 2 raakt de UI niet,
   maar wie `homepage` merget moet het fase 1-document op dat punt nalopen
4. **Toegang.** De import draait tegen de `dev`-branch van Neon en Vercel Blob.
   Beide staan in Adams accounts. Verbindingsreeksen en Blob-token gaan in de
   lokale `.env`, niet via de chat

## Beantwoord

Deze stonden hier eerst als open punt en zijn op 10 september 2026 met Adam
beslist. Ze staan hier zodat niemand ze opnieuw hoeft uit te zoeken.

- De losse maten van de veiligheidsschoenen (39,95) zijn een andere schoen dan
  het variabele product (29,95). Twee producten, geen prijsconflict
- Fietsonderbroek zonder maat is XL. Pantoffels zonder kleur zijn khaki
- Verpakkingsgroottes blijven losse producten, zoals bij bol.com
- Wij schrijven alle alt-teksten, de klant kijkt na
