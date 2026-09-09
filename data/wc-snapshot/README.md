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
| `products-attributes.json` | Leeg. Bewijs dat er geen globale attributen bestaan |
| `products-collection-data.json` | Prijsbereik en telling zoals de shop ze zelf rapporteert |
| `images/` | 227 unieke afbeeldingsbestanden, origineel formaat, 30 MB |

## Wat de data laat zien

- 94 producten, waarvan **92 `simple` en 2 `variable`**
- **0 van de 94 heeft een SKU**
- **32 van de 94 is uitverkocht** (34 procent)
- 269 afbeeldingsverwijzingen, 227 uniek, waarvan **256 zonder alt-tekst**
- Prijzen van 7,90 tot 39,95 euro

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

Deze map met de hand aanpassen heeft geen zin. Het is een momentopname,
geen werkbestand. Het opschonen gebeurt in fase 2 en landt in de database.
