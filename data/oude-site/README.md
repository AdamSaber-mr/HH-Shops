# De juridische documenten van de oude site

Opgehaald op **14 september 2026** uit de voet van `hh-shops.nl`, waar ze als
PDF stonden onder `/wp-content/uploads/2025/09/`. Ze zijn hier bewaard om
dezelfde reden als `data/wc-snapshot`: zodra het domein naar de nieuwe shop
wijst, is WordPress weg en zijn deze bestanden onvindbaar. Het zijn de enige
juridische teksten die de winkel had.

| Bestand | Wat het is |
|---|---|
| `Algemene-voorwaarden-webshop-hh-shops.pdf` | 20 artikelen, B2C, geldig sinds 1 januari 2025 |
| `Privacyverklaring-AVG-hh-shops.pdf` | 15 hoofdstukken, laatst gewijzigd 1 januari 2025 |
| `Cookieverklaring-hh-shops.pdf` | 7 hoofdstukken, 1 januari 2025 |

Alle drie zijn opgesteld met Rocket Lawyer. Ze zijn een sjabloon dat is
ingevuld, geen maatwerk, en dat is te merken: zie "Wat er niet klopt" hieronder.

## Wat eruit te halen is

**Bedrijfsgegevens.** "HH-shops, gevestigd te Rhoon, KvK-nummer 95788468"
(voorwaarden artikel 1) en "HH-Shops, Koperhoek 10 B, 3162 LA Rhoon, 95788468"
(privacyverklaring hoofdstuk 2). Dat klopt met wat er in `src/lib/site.ts`
staat.

**Geen btw-nummer.** Niet in de voet, niet op `/contact`, niet op `/over-ons`
en in geen van de drie PDF's. Het antwoord op "staat dat niet op de andere
website?" is dus nee. Een webshop die aan consumenten verkoopt moet zijn
btw-identificatienummer wel noemen (artikel 3:15d BW); dat moet dus uit de
eigen aangifte komen, niet van de oude site.

**Bedenktijd: 14 dagen.** Voorwaarden artikel 5.1: "binnen 14 dagen de
overeenkomst zonder opgave van redenen te ontbinden", gerekend vanaf ontvangst
van de hele bestelling. Nergens op de oude site staat dertig dagen.

**Garantie: twee jaar.** Artikel 16.1, "een periode van twee kalenderjaren na
ontvangst van het verkochte door koper".

**Klachttermijn: 10 werkdagen** na aflevering, schriftelijk (artikel 8.2).

**Herroepingsformulier.** Artikel 5.3: de verkoper is verplicht dat op verzoek
ter beschikking te stellen. Dat formulier bestaat nog niet.

**Bewaartermijn zeven jaar** voor klantgegevens (privacyverklaring
hoofdstuk 7), en gegevens blijven binnen de EER (hoofdstuk 9).

**Beoordelingen.** De contactpagina noemt "een gemiddelde beoordeling van 8,1
op bol.com" met vier citaten (Yvonne, Petra, Hans, Marleen).

## Wat er niet klopt met de nieuwe shop

Dit zijn geen kleinigheden; ze horen bij de herziening op tafel.

**De voorwaarden beloven het tegenovergestelde van de winkel.** Artikel 10.1:
"Levering geschiedt 'af fabriek/winkel/magazijn'. Dit houdt in dat alle kosten
voor koper zijn." De winkel belooft gratis verzending boven € 50. Dat is een
sjabloonbepaling die er bij een webshop niet hoort te staan. Bij een consument
wordt een onduidelijke bepaling in zijn voordeel uitgelegd, dus gevaarlijk voor
de klant is het niet, maar het hoort weg.

**De privacyverklaring zegt dat gegevens nooit gedeeld worden.** Hoofdstuk 8:
"We zullen je persoonsgegevens nooit met anderen delen." Dat was al niet waar
en is het nu zeker niet: de nieuwe shop gebruikt Mollie (betaling), Resend
(mail), Vercel (hosting) en Neon (database), en de vervoerder krijgt naam en
adres. De lijst verwerkers staat in `docs/bestellen.md` onder "Voor de
privacyverklaring".

**De cookieverklaring beschrijft cookies die er niet meer zijn.** De oude site
noemt Facebook, Google Adwords, Google Analytics en Google Search Console als
tracking cookies, en had daarvoor een toestemmingsbanner (WPConsent). De nieuwe
shop heeft die niet: alleen functionele cookies (sessie, winkelmand,
favorieten, meldingen), en de Content-Security-Policy in `src/middleware.ts`
laat externe scripts sowieso niet toe. Daarmee is een cookiebanner niet meer
nodig, en wordt de cookieverklaring een stuk korter en eerlijker.

**Klarna staat er nog op.** De oude site zegt op drie plekken "Betaal veilig
via iDEAL, creditcard of achteraf met Klarna". De collega heeft op 14 september
2026 bevestigd dat Klarna er niet komt.

## De antwoorden van de collega, 14 september 2026

Voor `src/lib/juridisch.ts` op de frontend-branch:

| Punt | Antwoord |
|---|---|
| btw-nummer | Staat niet op de oude site. Nog open. |
| Retourzending | Kosteloos voor de klant, melden via info@hh-shops.nl |
| Bezorgen | Maandag tot en met vrijdag |
| Klarna | Nee |
| Nieuwsbrief | Nee |
| Bedenktijd | Niet gevraagd; de eigen voorwaarden zeggen 14 dagen |
| Retouradres | Niet gegeven. Waarschijnlijk Koperhoek 10 B, maar dat moet bevestigd |

Een verkeerd retouradres kost een klant zijn pakket, dus dat blijft open tot
iemand het bevestigt.

## Opnieuw ophalen

Zolang de oude site nog draait:

```
curl -sS -O "https://hh-shops.nl/wp-content/uploads/2025/09/Algemene-voorwaarden-webshop-hh-shops.pdf"
curl -sS -O "https://hh-shops.nl/wp-content/uploads/2025/09/Privacyverklaring-AVG-hh-shops.pdf"
curl -sS -O "https://hh-shops.nl/wp-content/uploads/2025/09/Cookieverklaring-hh-shops.pdf"
```
