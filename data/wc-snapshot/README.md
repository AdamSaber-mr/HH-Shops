# Snapshot van de oude WooCommerce-site

Ruwe kopie van het assortiment zoals het op **9 september 2026** op
`hh-shops.nl` stond, opgehaald via de open Store API onder
`/wp-json/wc/store/v1/`.

Dit is de bron voor fase 2. Zolang deze map er staat, zijn we niet meer
afhankelijk van of de oude site blijft draaien.

## Wat er in zit

| Bestand | Inhoud |
|---|---|
| `products.json` | 94 producten, onbewerkt zoals de API ze teruggaf |
| `categories.json` | 9 categorieen met hun aantallen |
| `product-variations.json` | De 9 variaties van de twee `variable`-producten, per stuk opgehaald |
| `products-attributes.json` | Leeg. Bewijs dat er geen globale attributen bestaan |
| `products-collection-data.json` | Prijsbereik en telling zoals de shop ze zelf rapporteert |
| `images/` | 227 unieke afbeeldingsbestanden, origineel formaat, 30 MB |

## Wat de data laat zien

- 94 producten, waarvan **92 `simple` en 2 `variable`**
- **0 van de 94 heeft een SKU**
- **32 van de 94 is uitverkocht** (34 procent)
- 269 afbeeldingsverwijzingen, 227 uniek, waarvan **256 zonder alt-tekst**
- Prijzen van 7,90 tot 39,95 euro
- **19 van de 94 productnamen bevatten `&#8211;`**, een en-dash als HTML-entiteit.
  Die moet er bij de migratie uit, want de ontwerpregels verbieden en-dashes in
  zichtbare tekst

## Voorraad is een getal, geen ja of nee

Makkelijk over het hoofd te zien: `stock_availability.text` bevat het echte
aantal, niet alleen "op voorraad". Verdeling over de 94 producten:

```
32x Uitverkocht      18x 53 op voorraad   13x 15 op voorraad
12x  5 op voorraad    5x 50 op voorraad    2x 20 op voorraad
 2x  1 op voorraad    2x 999 op voorraad   rest: 6, 13, 14, 25, 30, 48, 52
```

Het veld `stock_quantity` in de nieuwe database is dus volledig te vullen uit
deze snapshot. Zonder deze constatering had fase 2 aantallen moeten verzinnen of
alles op nul moeten zetten.

## De variaties, apart opgehaald

`products.json` verwijst naar 9 variatie-ids maar bevat ze niet. Ze zijn daarna
per stuk opgehaald via `/wp-json/wc/store/v1/products/<id>` en staan in
`product-variations.json`.

| id | ouder | variatie | prijs | voorraad |
|---|---|---|---|---|
| 844 | 842 | maten 38 | 29,95 | 20 |
| 845 | 842 | maten 39 | 29,95 | 19 |
| 846 | 842 | maten 40 | 29,95 | uitverkocht |
| 847 | 842 | maten 41 | 29,95 | uitverkocht |
| 848 | 842 | maten 42 | 29,95 | uitverkocht |
| 849 | 842 | maten 43 | 29,95 | uitverkocht |
| 871 | 123 | Kleuren Blauw | 11,99 | 25 |
| 872 | 123 | Kleuren Roze | 11,99 | 25 |
| 873 | 123 | Kleuren Groen | 11,99 | 25 |

Let op de tegenstrijdigheid: product 842 meldt zelf "50 op voorraad", maar vier
van de zes maten zijn uitverkocht. Het bovenliggende voorraadgetal is bij een
variabel product dus niet bruikbaar.

De twee `variable`-producten zijn *Werkschoenen - Veiligheidsschoenen*
(maten 38 tot en met 43, 6 variaties) en *Motivatie Drinkfles 2L*
(3 kleuren). WooCommerce kan het dus wel, maar het is bij twee producten
gebleven. De overige maatvarianten staan als losse producten in de shop:

- Zwemvest Hond met Handvat, maten XXS, XS, S en M
- Veiligheidsschoenen, maten 36, 37 en 41, los naast het `variable`-product
- Waist Trainer Corset, maten S, M en XL
- Hond Draagtas, maten S en M
- Fietsonderbroek met Zeem, met en zonder maataanduiding
- Fluffy Pantoffels, twee losse kleurvarianten

## Afbeeldingen

| Formaat | Aantal | Gemiddeld | Totaal | Grootste |
|---|---|---|---|---|
| PNG | 54 | 413 KB | 22 MB | 1874 KB |
| JPG | 170 | 48 KB | 8 MB | 166 KB |
| WebP | 3 | 43 KB | 0 MB | 45 KB |

Mediaan 53 KB. Tien bestanden boven 500 KB, acht boven 1 MB.

De winst in fase 2 zit vrijwel volledig in die 54 PNG's. De JPG's zijn al
redelijk. Veel bestandsnamen beginnen met `Copilot_` of `ChatGPT`, wat de
aanname bevestigt dat een deel van de foto's met AI gemaakt is.

## Opnieuw ophalen

Zolang de oude site nog draait:

```
curl -sS "https://hh-shops.nl/wp-json/wc/store/v1/products?per_page=100"
curl -sS "https://hh-shops.nl/wp-json/wc/store/v1/products/categories?per_page=100"
```

```
curl -sS "https://hh-shops.nl/wp-json/wc/store/v1/products/844"
```

Deze map met de hand aanpassen heeft geen zin. Het is een momentopname,
geen werkbestand. Het opschonen gebeurt in fase 2 en landt in de database.
