# Vindbaarheid en de oude links

> Gebouwd op 14 september 2026, het vindbaarheidsdeel van fase 6. De rest van
> die fase (de beveiliging, de domeinomzetting zelf) staat er los van.

De oude site op `hh-shops.nl` draait nog op WordPress en heeft posities in
Google. Zodra het domein naar deze shop wijst, wijzen al die links naar
adressen die hier niet bestaan. Dit is wat dat opvangt.

## Wat het doet

**Elke oude link komt op de goede plek uit.** 94 producten, 9 categorieen en
de 7 vaste pagina's van de oude site, allemaal met een 301. Dat is de
belangrijkste taak van fase 6 uit het plan van aanpak.

| Oud adres | Waar het heen gaat |
|---|---|
| `/product/<oude slug>` | `/product/<nieuwe slug>` |
| `/product/zwemvest-hond-met-handvat-maat-xs` | `/product/zwemvest-hond-met-handvat?maat=XS` |
| `/product/werkschoenen?attribute_maten=38` | `/product/werkschoenen?maat=38` |
| `/product-categorie/<slug>` | `/categorie/<slug>` |
| `/winkel`, `/shop` | `/producten` |
| `/winkelwagen`, `/cart` | `/winkelmand` |
| `/mijn-account` | `/account` |
| `/`, `/contact`, `/over-ons`, `/afrekenen` | bestaan hier al onder dezelfde naam |

Met en zonder afsluitende schuine streep, want WordPress zette hem er standaard
achter en de sitemap van de oude site niet.

Op de oude site stonden losse maten als aparte producten (vier keer
"Zwemvest Hond", een per maat). Hier is dat een product met varianten, dus de
oude link neemt die maat mee als keuze in de URL. De bezoeker ziet precies wat
hij zocht, met de prijs en de voorraad van die maat.

**Een eigen foutpagina** op `src/pages/404.astro`, met de categorieen erop.
Wie hier belandt wilde iets kopen; dan is een lijst met categorieen een beter
antwoord dan het woord "404".

**robots.txt en sitemap.xml.** De sitemap komt uit de database: de vaste
pagina's, 9 categorieen en elk zichtbaar product, met de datum van de laatste
wijziging. Een product dat in het beheerpaneel wordt toegevoegd of op
gearchiveerd gezet, staat er vanzelf goed in.

**Gestructureerde gegevens (JSON-LD).** Dezelfde prijs, voorraad en
artikelnummers die al op de pagina staan, nog een keer in een vorm die Google
zonder gokken leest. Daarmee komt onder de zoekresultaten de prijs te staan,
"op voorraad", wat verzenden kost en dat retourneren binnen veertien dagen
kosteloos is, en komen de producten in aanmerking voor de gratis vermeldingen
in Shopping. Zie "Gestructureerde gegevens" hieronder.

## Opzet

| Onderdeel | Waar |
|---|---|
| Vorm van een pad, vaste pagina's, oude variantkeuze (zuiver, getest) | `src/lib/oude-links/paden.ts` |
| Het opzoeken in `legacy_urls` | `src/lib/oude-links/opzoeken.ts` |
| De doorverwijzing zelf | `src/middleware.ts` |
| Foutpagina | `src/pages/404.astro` |
| robots.txt en de sitemap (zuiver, getest) | `src/lib/vindbaarheid/regels.ts` |
| De catalogus voor de sitemap | `src/lib/vindbaarheid/gegevens.ts` |
| De twee adressen | `src/pages/robots.txt.ts`, `src/pages/sitemap.xml.ts` |
| Gestructureerde gegevens (zuiver, getest) | `src/lib/vindbaarheid/jsonld.ts` |
| Het blok op de pagina zetten | `src/components/JsonLd.astro` |
| Controlescript | `scripts/oude-links-controleren.ts` |

**De doorverwijzing hangt aan de 404, niet aan een route.** De middleware laat
het verzoek eerst zijn gang gaan en kijkt pas bij een 404 of het een oud adres
was. Dat kost een gewone pagina niets, en het werkt ongeacht wie die 404 gaf:
`/product/<onbekende slug>` komt van de productpagina zelf,
`/product-categorie/<slug>` bestaat als route helemaal niet. De uitzondering is
`?attribute_maten=38`: dat pad bestaat gewoon, dus daar komt nooit een 404 uit
en wordt de querystring vooraf opgeschoond. Dat kost geen query.

**Alleen `hh-shops.nl` mag in Google.** Elk ander adres, dus het
`workers.dev`-adres en elke preview, krijgt een robots.txt die alles weigert, en daar
bestaat de sitemap niet. Zo staat de winkel nooit twee keer in de index en kan
niemand op het testadres bestellen. Bij de domeinomzetting hoeft hier dus
niets omgezet te worden: het adres bepaalt het.

De sitemap blokkeert querystrings bewust niet in robots.txt. De filters op een
categoriepagina maken er veel, maar een oude productlink verwijst juist door
naar `?maat=XS`, en die moet Google kunnen volgen.

## Gestructureerde gegevens

Op de productpagina staat een `Product` met het aanbod, en een
`BreadcrumbList`. Op de startpagina staat een `OnlineStore` met de
bedrijfsgegevens. De bedragen komen uit `bestellen/instellingen.ts`, dezelfde
bron als de winkelmand, zodat Google niets anders leest dan wat de klant
afrekent.

Een product met een variant krijgt een gewoon `Offer` met zijn eigen prijs,
voorraad en artikelnummer. Een product met keuzes krijgt een `AggregateOffer`
met de laagste en de hoogste prijs. Dat laatste is niet de rijkste vorm die
schema.org kent (dat is `ProductGroup` met `hasVariant`), maar wel de vorm die
Google zonder uitzondering accepteert, en het gaat om twee producten in het
hele assortiment.

**Geen sterren.** De winkel heeft 8,1 op bol.com, maar niet per product, en een
gemiddelde van een ander kanaal bij een product zetten is precies waar Google
handmatige maatregelen voor geeft. Dezelfde afweging als op de productpagina
zelf, waar ook geen verzonnen sterren staan.

**Het retourbeleid staat hard in de code**: veertien dagen, kosteloos,
Nederland. Dat komt uit de eigen algemene voorwaarden (artikel 5.1) en de
bevestiging van 14 september 2026. Verandert het, dan verandert het ook op
`/klantenservice/retourneren` en in de voorwaarden; Google trekt aan het
kortste eind als die pagina's iets anders beloven.

**De Content-Security-Policy houdt dit niet tegen.** Een
`<script type="application/ld+json">` is geen script maar een gegevensblok en
valt niet onder `script-src`. Dat is niet aangenomen maar nagelopen: een pagina
met precies de policy uit `src/middleware.ts` in een echte browser geladen, het
blok bleef staan, was leesbaar, en Chrome meldde geen enkele overtreding.

## Nakijken

```
npm run links:controleren
```

Loopt elk adres uit `legacy_urls` plus de vaste pagina's langs de
doorverwijzing, in beide vormen (met en zonder afsluitende streep), en
controleert of het doel echt bestaat en zichtbaar is. Leest alleen.

Draaien voor de domeinomzetting, en daarna nog eens: een product dat in het
beheerpaneel op gearchiveerd wordt gezet verandert hier het antwoord, en dat
hoor je te zien voordat Google het ziet. Stand op 14 september 2026: 226
adressen gecontroleerd, alles verwijst door.

## Bij de domeinomzetting

De volledige afvinklijst staat in `docs/domeinomzetting.md`. Wat daarvan met
vindbaarheid te maken heeft:

1. `https://hh-shops.nl/robots.txt` opvragen en controleren dat er `Allow: /`
   staat en een `Sitemap:`-regel. Staat er `Disallow: /`, dan komt het
   verzoek niet op `hh-shops.nl` binnen.
2. `https://hh-shops.nl/sitemap.xml` indienen in Google Search Console.
3. `site` in `astro.config.mjs` zetten op `https://hh-shops.nl`. Dat staat er
   nu bewust niet, omdat canonieke URL's anders naar de oude site wijzen.
4. `npm run links:controleren` tegen de productiedatabase, en daarna een paar
   oude links uit Google met de hand aanklikken.

## Wat er bewust niet in zit

- **Canonieke URL's in de `<head>`.** Die horen bij het zetten van `site` in
  de Astro-config, stap 4 hierboven, en raken elke pagina van de winkel.
- **`ProductGroup` met `hasVariant`** voor de twee producten met maten of
  kleuren, en gestructureerde gegevens op de categoriepagina's (`ItemList`).
  Allebei een verfijning van wat er nu staat, geen gat.
- **De losse blogpost van de oude site** (`/Drinkglazen - Set van 4 ...`) en
  zijn categorie. Er is geen product dat erbij hoort, dus die krijgen de
  foutpagina. Dat is het juiste antwoord voor een pagina die niet vervangen is.
- **De drie PDF's uit de oude voet** (algemene voorwaarden, privacyverklaring,
  cookieverklaring). Die stonden onder `/wp-content/uploads/2025/09/` en zijn
  bewaard in `data/oude-site/`. Ze worden niet doorverwezen: de nieuwe shop
  heeft er echte pagina's voor, en een PDF is daar een slechtere versie van.
  Wie de oude link nog volgt, krijgt de foutpagina met de weg terug.
