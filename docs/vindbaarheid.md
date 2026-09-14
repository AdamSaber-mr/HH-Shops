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

**robots.txt en sitemap.xml.** De sitemap komt uit de database: 5 vaste
pagina's, 9 categorieen en elk zichtbaar product, met de datum van de laatste
wijziging. Een product dat in het beheerpaneel wordt toegevoegd of op
gearchiveerd gezet, staat er vanzelf goed in.

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
| Controlescript | `scripts/oude-links-controleren.ts` |

**De doorverwijzing hangt aan de 404, niet aan een route.** De middleware laat
het verzoek eerst zijn gang gaan en kijkt pas bij een 404 of het een oud adres
was. Dat kost een gewone pagina niets, en het werkt ongeacht wie die 404 gaf:
`/product/<onbekende slug>` komt van de productpagina zelf,
`/product-categorie/<slug>` bestaat als route helemaal niet. De uitzondering is
`?attribute_maten=38`: dat pad bestaat gewoon, dus daar komt nooit een 404 uit
en wordt de querystring vooraf opgeschoond. Dat kost geen query.

**Alleen `hh-shops.nl` mag in Google.** Elk ander adres, dus het testadres van
Vercel en elke preview, krijgt een robots.txt die alles weigert, en daar
bestaat de sitemap niet. Zo staat de winkel nooit twee keer in de index en kan
niemand op het testadres bestellen. Bij de domeinomzetting hoeft hier dus
niets omgezet te worden: het adres bepaalt het.

De sitemap blokkeert querystrings bewust niet in robots.txt. De filters op een
categoriepagina maken er veel, maar een oude productlink verwijst juist door
naar `?maat=XS`, en die moet Google kunnen volgen.

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

1. Het domein omzetten naar Vercel.
2. `https://hh-shops.nl/robots.txt` opvragen en controleren dat er `Allow: /`
   staat en een `Sitemap:`-regel. Staat er `Disallow: /`, dan komt het
   verzoek niet op `hh-shops.nl` binnen.
3. `https://hh-shops.nl/sitemap.xml` indienen in Google Search Console.
4. `site` in `astro.config.mjs` zetten op `https://hh-shops.nl`. Dat staat er
   nu bewust niet, omdat canonieke URL's anders naar de oude site wijzen.
5. Een paar oude links uit Google aanklikken en kijken of ze landen.

## Wat er bewust niet in zit

- **Canonieke URL's in de `<head>`.** Die horen bij het zetten van `site` in
  de Astro-config, stap 4 hierboven, en raken elke pagina van de winkel.
- **Gestructureerde gegevens** (product-JSON-LD, prijs en voorraad voor
  Google Shopping). Apart werk, en pas zinvol als de prijzen definitief zijn.
- **De losse blogpost van de oude site** (`/Drinkglazen - Set van 4 ...`) en
  zijn categorie. Er is geen product dat erbij hoort, dus die krijgen de
  foutpagina. Dat is het juiste antwoord voor een pagina die niet vervangen is.
- **De drie PDF's uit de oude voet** (algemene voorwaarden, privacyverklaring,
  cookieverklaring). Die stonden onder `/wp-content/uploads/2025/09/` en zijn
  bewaard in `data/oude-site/`. Ze worden niet doorverwezen: de nieuwe shop
  heeft er echte pagina's voor, en een PDF is daar een slechtere versie van.
  Wie de oude link nog volgt, krijgt de foutpagina met de weg terug.
