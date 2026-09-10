# Fase 4, afrekenen

> Plan van 10 september 2026. Winkelwagen, bestelproces, betaling via Mollie,
> bestellingen in de database, bevestigingsmails en de verplichte pagina's.
> Het plan van aanpak zegt: hier is saai en voorspelbaar beter dan mooi.

## Context

Wat er staat als deze fase begint:

- Het assortiment zit in de database: 83 producten, 101 varianten, elk
  product heeft minstens een variant, prijzen zijn gehele centen inclusief
  btw, voorraad staat per variant.
- De storefront van de andere sessie heeft een startpagina, categoriepagina's
  en een productpagina met maatkeuze via de URL. Het koopblok toont al een
  knop "In winkelwagen", maar die doet nog niets. De header heeft een
  winkelwagen-icoon zonder teller.
- Het beheerpaneel op `/admin` beheert producten, varianten, foto's en
  categorieen. Bestellingen bekijken en afhandelen hoort bij fase 5.
- Er is nog geen Mollie-account. Dit plan is zo opgezet dat alles gebouwd en
  getest kan worden zonder sleutel, en dat de echte testbetalingen er als
  laatste stap bij komen zodra de sleutel er is.

Twee agents werken tegelijk in dezelfde repository. Zie "Afbakening" hieronder;
die afspraak is belangrijker dan elke technische keuze in dit document.

## Klaar wanneer

Een testbestelling gaat er van begin tot eind doorheen: product in de
winkelwagen, aantal aanpassen, gegevens invullen, betalen bij Mollie in
testmodus, terug op de site met een bevestiging, de bestelling staat in de
database met de juiste bedragen, de voorraad is verlaagd, en klant en eigenaar
hebben een mail. Een betaling die mislukt, geannuleerd wordt of verloopt loopt
net zo netjes af: de bestelling staat op geannuleerd, de voorraad is terug, en
de klant ziet wat er gebeurd is en wat hij kan doen.

Op telefoon en op desktop, zonder JavaScript.

## Beslissingen

| Onderwerp | Keuze | Waarom |
|---|---|---|
| Winkelwagen | Een cookie met alleen variant-id's en aantallen, geen sessie-opslag en geen tabel | Astro-sessies hebben op Vercel een aparte opslag (Redis) nodig, en een tabel vult zich met karren van bezoekers die nooit bestellen. De cookie bevat niets dat de server vertrouwt: prijzen, namen en voorraad komen bij elke weergave opnieuw uit de database. Knoeien met de cookie levert dus niets op, hooguit een lege regel die de server weggooit |
| Prijs en voorraad | Bij het plaatsen van de bestelling opnieuw uit de database, in een transactie | De browser stuurt alleen "welke variant, hoeveel". Wat het kost en of het er is, bepaalt de server. Dit is de kern van fase 4 volgens het plan van aanpak |
| Voorraad reserveren | Bij het plaatsen van de bestelling, met `stock_quantity >= aantal` als voorwaarde in dezelfde `UPDATE`; terug bij annuleren | Reserveren bij betaling zou betekenen dat twee klanten hetzelfde laatste exemplaar kunnen afrekenen. De voorwaarde in de update maakt de race onmogelijk zonder locks in de code |
| Betaling | Mollie Payments API via `@mollie/api-client` 4.6, betaalmethode kiezen op de pagina van Mollie | Minder bewegende delen: elke methode die in het Mollie-dashboard aanstaat verschijnt vanzelf, en wij hoeven geen lijst bij te houden. Keuze op onze eigen site kan later, het is een parameter |
| Status van een betaling | Alleen via `payments.get(id)` bij Mollie, nooit uit de webhook-body of de redirect | Zo schrijft Mollie het voor. De webhook geeft alleen een id; de redirect zegt niets over de uitkomst |
| Bestelling na mislukte betaling | Bestelling op geannuleerd, voorraad terug, klant kan met een knop de artikelen terug in de winkelwagen zetten | Simpeler en eerlijker dan een bestelling die met gereserveerde voorraad blijft wachten. Bij kleine voorraden (er zijn producten met 1 stuk) telt dat |
| Bestelnummer | `HH-100001` en verder, uit een eigen teller achter een advisory lock | Leesbaar aan de telefoon, oplopend voor de boekhouding, geen gat tussen twee bestellingen |
| Toegang tot de status- en bedanktpagina | Een willekeurig token van 32 bytes in de URL, niet het bestelnummer | Een bestelnummer is te raden; dan zie je andermans adres |
| Klantaccounts | Geen, alleen gastafrekenen | Het plan van aanpak begint schoon met klantgegevens. Accounts zijn een fase op zich en niet nodig om te verkopen |
| Verzending | Gratis vanaf 50 euro (bevestigd door Adam), daaronder een vast bedrag, alleen Nederland | De beloftes op de site. Bedrag en landen staan bij de vragen; beide zijn een constante |
| E-mail | Resend via de Node-SDK, een mail naar de klant en een naar de eigenaar bij een betaalde bestelling | Eenvoudige API, gratis tot 3.000 mails per maand, verzendt vanaf een eigen domein na een DNS-record. Tot dat record er is werkt het testdomein van Resend, alleen naar het eigen adres van de accounthouder |
| Verplichte pagina's | Gewone Astro-pagina's met de tekst erin, bedrijfsgegevens uit `src/lib/site.ts` | Geen CMS nodig voor zeven pagina's die een keer per jaar veranderen |
| Factuur-pdf | Niet in deze fase | De bevestigingsmail bevat alle regels en btw; een pdf hoort bij het bestelbeheer van fase 5 |

## Afbakening met de andere sessie

De andere sessie bouwt de storefront: startpagina, categorieen, productpagina,
en alles onder `src/components/` (bovenste niveau), `src/layouts/Layout.astro`,
`src/lib/catalog.ts`, `src/lib/site.ts`, `src/lib/navigation.ts` en
`src/styles/global.css`. Daar blijft fase 4 vanaf.

Fase 4 werkt in eigen mappen en bestanden:

```
src/db/orders-schema.ts               nieuwe tabellen, apart van schema.ts (zoals auth-schema.ts)
drizzle/0004_bestellingen.sql
src/lib/winkelwagen/                  cookie, regels berekenen, verzendkosten
src/lib/bestellen/                    bestelling plaatsen, statusovergangen, Mollie, mail
src/actions/winkelwagen.ts            toevoegen, aantal wijzigen, verwijderen
src/actions/afrekenen.ts              bestelling plaatsen, artikelen terugzetten
src/pages/winkelwagen.astro
src/pages/afrekenen.astro
src/pages/bestelling/[token].astro
src/pages/api/mollie/webhook.ts
src/components/afrekenen/             eigen submap: regel, adresvelden, samenvatting, koopformulier
src/pages/algemene-voorwaarden.astro, privacy.astro, contact.astro
src/pages/klantenservice/{verzenden,retourneren,betalen,veelgestelde-vragen}.astro
src/emails/                           tekst- en HTML-templates
scripts/bestellingen-opschonen.ts     vangnet, zie "Wat er mis kan gaan"
```

Er zijn twee plekken waar de twee kanten elkaar raken. Allebei worden ze zo
klein mogelijk gehouden en via Adam afgestemd, niet stilzwijgend gedaan:

1. **Het koopblok op de productpagina.** Fase 4 levert
   `src/components/afrekenen/KoopFormulier.astro`: een formulier met het
   variant-id, een aantal, en de knop. De andere sessie zet dat op de plek van
   de huidige knop, of geeft aan dat fase 4 die ene regel mag wisselen.
2. **De teller in de header.** Fase 4 levert `telWinkelwagen(Astro.cookies)`
   uit `src/lib/winkelwagen/cookie.ts`. Geen databasequery, alleen de cookie
   lezen. De andere sessie roept het aan bij het winkelwagen-icoon.

De footer linkt al naar `/contact`, `/klantenservice/...`,
`/algemene-voorwaarden` en `/privacy`. Die pagina's maakt fase 4; de andere
sessie hoeft ze niet te beginnen. Gedeelde bestanden die fase 4 wel aanraakt,
en die bij het mergen met de hand samengevoegd worden als het botst:
`astro.config.mjs` (env-schema, iconen), `drizzle.config.ts` (derde
schemabestand), `package.json`, `.env.example`.

Gewerkt wordt op branch `fase-4-afrekenen` in de bestaande worktree
`HH-Shops-admin`, gemerged in `main` per afgeronde stap, net als bij het
beheerpaneel.

## Datamodel

Drie tabellen in `src/db/orders-schema.ts`, met dezelfde aanpak als
`schema.ts`: de database weigert slechte data.

**orders**

| Kolom | Type | Toelichting |
|---|---|---|
| id | identity | |
| number | text, uniek | `HH-100001` |
| token | text, uniek | 32 willekeurige bytes, base64url; de sleutel van de statuspagina |
| status | enum | `awaiting_payment`, `paid`, `cancelled`, `shipped`. De laatste is voor fase 5 en staat er nu al, zodat die fase geen migratie van de enum nodig heeft |
| email, name, phone | text | telefoon optioneel |
| street, house_number, postal_code, city, country | text | `country` voorlopig alleen `NL`; postcode als `1234 AB` |
| customer_note | text | optioneel |
| subtotal_cents, shipping_cents, total_cents | integer | inclusief btw, gehele centen; `total = subtotal + shipping` als CHECK |
| vat_cents | integer | de btw in het totaal, berekend per regel |
| mollie_payment_id | text, uniek | leeg tot de betaling is aangemaakt |
| payment_method | text | uit Mollie, bijvoorbeeld `ideal` |
| paid_at, cancelled_at | timestamptz | |
| confirmation_sent_at | timestamptz | de mail gaat precies een keer |
| created_at, updated_at | timestamptz | |

**order_items**: `order_id`, `variant_id` (nullable, `on delete set null`, zodat
een verwijderd product de bestelgeschiedenis niet meeneemt), en een snapshot
van wat er verkocht is: `sku`, `product_name`, `option_text` ("Maat 42"),
`unit_price_cents`, `quantity`, `vat_rate`, `line_total_cents`, plus de
`image_url` van dat moment voor de mail en de statuspagina. Een bestelling
zonder regels bestaat niet: dat bewaakt de code in de transactie, niet een
constraint, want Postgres kan dat niet over twee tabellen heen.

**order_events**: `order_id`, `kind` (`created`, `payment_created`,
`webhook`, `status_changed`, `mail_sent`, `cleanup`), `payload` jsonb,
`created_at`. Elke webhook-aanroep komt hier in, ook als hij niets verandert.
Als er ooit een vraag is "wat is er met bestelling HH-100123 gebeurd", staat
het antwoord hier.

Een aparte tabel `order_counters` met een rij is niet nodig: het nummer komt
uit `max(number)` achter `pg_advisory_xact_lock(hashtext('hh_order'))`,
dezelfde constructie als de artikelnummers in het beheerpaneel.

## De stroom

```
productpagina ──(POST winkelwagen.toevoegen)──> /winkelwagen
                                                   │ aantal +/-, verwijderen (elk een formulier)
                                                   ▼
                                               /afrekenen ──(POST afrekenen.plaatsen)──┐
                                                                                        ▼
                                             transactie: bestelling + regels + voorraad af
                                                                                        │
                                             Mollie: payments.create(...)  ──fout──> bestelling annuleren, voorraad terug, melding
                                                                                        │
                                             cookie leeg, redirect naar de checkout van Mollie
                                                                                        │
                    Mollie ──POST /api/mollie/webhook (id)──> payments.get ──> statusovergang ──> mail
                                                                                        │
                    klant ──redirect──> /bestelling/<token>: toont de status uit de database
```

**Winkelwagen.** Cookie `hh_winkelwagen`, inhoud `variantId:aantal` per
regel, maximaal 20 regels, aantal 1 tot en met 10, een jaar geldig, `SameSite=Lax`,
`HttpOnly`. Bij elke weergave: varianten ophalen, regels van producten die
niet meer `active` zijn of varianten die uit staan stilzwijgend laten vallen,
en bij een aantal boven de voorraad het aantal verlagen met een melding
("Van dit artikel zijn er nog 2, we hebben je aantal aangepast"). De pagina
toont regels met foto, naam, optie, prijs per stuk, aantal, regeltotaal, het
subtotaal, de verzendkosten of "gratis", en de knop Afrekenen. Leeg: een nette
lege toestand met een link naar de categorieen.

**Afrekenen.** Een pagina, een formulier: e-mailadres, naam, straat,
huisnummer met toevoeging, postcode, plaats, telefoon (optioneel, "voor de
bezorger"), opmerking (optioneel), en een verplicht vinkje voor de algemene
voorwaarden en het herroepingsrecht. Rechts (op telefoon eronder) de
samenvatting: regels, subtotaal, verzendkosten, totaal, "inclusief btw". Geen
apart factuuradres in deze fase. Alle validatie aan de serverkant met Zod,
veldfouten terug in het formulier met de ingevulde waarden, zoals in het
beheerpaneel. Postcode-formaat `1234 AB` (met of zonder spatie, wordt
genormaliseerd), huisnummer een getal met optionele toevoeging.

**Plaatsen** (`afrekenen.plaatsen`), in deze volgorde:

1. Cookie lezen, varianten opnieuw ophalen, regels berekenen. Lege kar of
   alleen vervallen regels: terug naar de winkelwagen met een melding.
2. Transactie: nummer toekennen, `orders` en `order_items` schrijven, per
   regel `UPDATE product_variants SET stock_quantity = stock_quantity - $aantal
   WHERE id = $id AND stock_quantity >= $aantal`. Raakt een update nul rijen,
   dan rollback en terug naar de winkelwagen met "is inmiddels uitverkocht"
   of "er zijn er nog maar N". Event `created`.
3. Mollie: `payments.create` met bedrag als string met twee decimalen
   (`(totalCents / 100).toFixed(2)`, geen floats in de berekening, alleen in de
   opmaak), `description` "H&H Shops bestelling HH-100001", `redirectUrl`
   naar `/bestelling/<token>`, `webhookUrl` naar `/api/mollie/webhook`,
   `metadata` met bestel-id en nummer, `locale` `nl_NL`,
   `idempotencyKey` het bestelnummer. Mislukt dit (Mollie onbereikbaar, sleutel
   fout): bestelling meteen op `cancelled`, voorraad terug, melding "betalen
   lukt op dit moment niet, je bestelling is niet geplaatst". Event
   `payment_created` bij succes, met het payment-id op de bestelling.
4. Cookie leegmaken, redirect (303) naar `payment.getCheckoutUrl()`.

**Webhook** (`POST /api/mollie/webhook`, body `id=tr_...`): altijd 200
teruggeven als het id bekend is, ook als er niets verandert, want op een
andere status doet Mollie het opnieuw. Onbekend id: 404. Verwerking:
`payments.get(id)`, bestelling `SELECT ... FOR UPDATE`, event `webhook` met de
status, en dan de overgang:

| Mollie-status | Bestelling | Actie |
|---|---|---|
| `paid`, `authorized` | `awaiting_payment` naar `paid` | `paid_at`, `payment_method`, mails, event |
| `failed`, `canceled`, `expired` | `awaiting_payment` naar `cancelled` | voorraad terug, `cancelled_at`, event |
| `open`, `pending` | ongewijzigd | alleen het event |
| alles | al `paid` of `cancelled` | niets; een tweede `paid` na `cancelled` wordt gelogd als `conflict` en moet iemand bekijken (fase 5 toont dit) |

De overgangen zitten in een functie zonder Mollie erin
(`pasBetaalstatusToe(order, status)`), zodat ze getest worden zonder netwerk.
De webhook en de statuspagina roepen dezelfde functie aan.

**Statuspagina** `/bestelling/<token>`: leest de bestelling. Staat hij op
`awaiting_payment` en is er een payment-id, dan vraagt de pagina de status een
keer live op bij Mollie en past dezelfde overgang toe. Zo ziet de klant het
goede resultaat ook als de webhook nog onderweg is, wat bij iDEAL regelmatig
een paar seconden scheelt. Drie toestanden: betaald (bedankt, bestelnummer,
regels, adres, "je krijgt een mail op ..."), wachten (met een knop
"Status vernieuwen", gewoon een link naar dezelfde pagina) en geannuleerd
(uitleg, knop "Zet de artikelen terug in mijn winkelwagen", die de regels uit
de bestelling weer in de cookie zet en naar de winkelwagen gaat). De pagina
is `noindex` en heeft `Cache-Control: no-store`.

**Mails**, alleen bij `paid`, precies een keer (`confirmation_sent_at`
wordt in dezelfde transactie gezet als de statusovergang; mislukt het
verzenden, dan wordt dat een event en blijft de kolom leeg, zodat een
herhaalde webhook het opnieuw probeert):

- Klant: onderwerp "Je bestelling HH-100001 bij H&H Shops", regels, bedragen
  met btw, bezorgadres, wat er nu gebeurt, contactgegevens en de link naar de
  statuspagina. Tekst en HTML, geen afbeeldingen die geladen moeten worden.
- Eigenaar: onderwerp "Nieuwe bestelling HH-100001", dezelfde regels plus
  telefoonnummer en opmerking, en in fase 5 een link naar het beheerpaneel.

## Verplichte pagina's

Een Nederlandse webshop moet dit tonen; de footer linkt er al naar. Fase 4
schrijft de teksten in gewoon Nederlands, met de gegevens uit `site.ts` en
de nog ontbrekende gegevens als "INVULLEN", zoals `site.ts` dat al doet.

| Pad | Inhoud |
|---|---|
| `/algemene-voorwaarden` | Op basis van de modelvoorwaarden voor webshops: identiteit van de ondernemer, aanbod, overeenkomst, herroepingsrecht (14 dagen wettelijk), prijs, levering, betaling, klachten |
| `/privacy` | Welke gegevens (bestelling, adres, e-mail), waarvoor, hoe lang, verwerkers (Vercel, Neon, Mollie, Resend), rechten van de klant |
| `/klantenservice/retourneren` | Bedenktijd, hoe retourneren, retouradres, terugbetaling binnen 14 dagen, het modelformulier voor herroeping |
| `/klantenservice/verzenden` | Verzendkosten, gratis vanaf 50 euro, besteltijd en levertijd, bezorging in Nederland |
| `/klantenservice/betalen` | De methodes, veilig via Mollie, geen betaalgegevens bij ons |
| `/klantenservice/veelgestelde-vragen` | Een korte lijst; de teksten hierboven verwijzen erheen |
| `/contact` | E-mail, KvK, btw-nummer, adres; een contactformulier is een latere uitbreiding |

Het herroepingsrecht is een wettelijk minimum van 14 dagen. De productpagina
belooft nu "dertig dagen bedenktijd" en "voor 16.00 uur besteld"; de USP-balk
zegt 15:00. Een van de twee moet winnen, zie de vragen.

## Instellingen

| Variabele | Waar | Waarvoor |
|---|---|---|
| `MOLLIE_API_KEY` | `.env`, Vercel preview en productie | `test_...` tot de livegang, daarna `live_...`. Via `astro:env` als secret |
| `RESEND_API_KEY` | idem | mail |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | door Vercel gezet als "Protection Bypass for Automation" aanstaat | Zie hieronder |

Vaste getallen (verzendkosten, drempel, landen, eigenaar-adres) komen in
`src/lib/bestellen/instellingen.ts`, niet in env-variabelen: ze horen bij de
code en veranderen zelden.

**Webhook op een preview.** Preview-deploys zitten achter Deployment
Protection; een POST van Mollie krijgt daar een 401. Vercel heeft daar een
voorziening voor: "Protection Bypass for Automation" geeft een geheim dat als
query-parameter `x-vercel-protection-bypass` meegestuurd mag worden. Op een
preview zet fase 4 die parameter in de `webhookUrl`. Op productie is hij niet
nodig en wordt hij weggelaten. Lokaal kan Mollie de webhook niet bereiken;
daar bewijst de statuspagina met de live opvraging dat de stroom klopt, en de
webhook zelf wordt getest met een nagebootste Mollie-client.

**Zonder Mollie-sleutel.** De Mollie-aanroepen zitten achter een klein eigen
koppelvlak (`maakBetaling`, `haalBetaling`). Zolang `MOLLIE_API_KEY` ontbreekt
in een niet-productie-omgeving gebruikt de code een nagebootste versie die de
klant naar een eigen pagina `/betaling-test/<id>` stuurt met knoppen
"Betaald", "Mislukt", "Verlopen", die de webhook aanroepen. Zo is elk pad
lokaal en op een preview te testen voordat er een sleutel is. Op productie
weigert de app te starten zonder echte sleutel.

## Stappen

Elke stap eindigt met iets dat werkt en te laten zien is, en wordt na de
check in `main` gemerged.

1. **Datamodel.** `orders-schema.ts`, `drizzle.config.ts`, migratie 0004 op
   dev. Check: `npm run db:check`, de constraints weigeren een negatieve
   prijs, een totaal dat niet klopt en een land buiten de lijst.
2. **Winkelwagen.** Cookie-module met tests, `winkelwagen.ts`-actions,
   `/winkelwagen`, `KoopFormulier.astro`, `telWinkelwagen`. Check: zonder
   JavaScript een product toevoegen (met `curl` tegen de action, zoals bij het
   paneel), aantal wijzigen, regel verwijderen, kar met een vervallen variant
   ruimt zichzelf op, aantal boven voorraad wordt verlaagd met melding.
   Daarna het koopblok en de teller met de andere sessie afstemmen.
3. **Bestelling plaatsen.** `plaatsBestelling` in een transactie, nummering,
   voorraad, `/afrekenen` met validatie. Check: twee gelijktijdige
   bestellingen van het laatste exemplaar, een wint; alle veldfouten; een
   bestelling in de database met kloppende bedragen; voorraad verlaagd.
4. **Betaling en status.** Mollie-koppelvlak met nagebootste versie,
   statusovergangen met tests, webhook, statuspagina, terugzetten in de
   winkelwagen. Check: elk pad (betaald, mislukt, verlopen, dubbele webhook,
   webhook na annulering) tegen dev, met de nagebootste Mollie.
5. **Mails.** Resend-koppeling, templates, precies-een-keer. Check: mail komt
   aan bij het testadres, herhaalde webhook stuurt geen tweede mail, mislukte
   verzending wordt gelogd en later ingehaald.
6. **Verplichte pagina's.** De zeven pagina's, teksten, links vanuit het
   afrekenformulier. Check: elke footerlink werkt, geen INVULLEN meer waar
   Adam al antwoord op gaf.
7. **Vangnet en afronding.** `bestellingen-opschonen.ts` (bestellingen die
   langer dan 24 uur op `awaiting_payment` staan en volgens Mollie niet
   betaald zijn: annuleren, voorraad terug), documentatie, memory. Check:
   `npm run lint`, `npm test`, `npm run build`, `npm run check`, CI groen.
8. **Echte testbetalingen** zodra de sleutel er is: op een preview met de
   bypass-parameter iDEAL, creditcard en (als besloten) Klarna in testmodus,
   alle uitkomsten die de testmodus van Mollie aanbiedt. Daarna de sleutel in
   productie zetten en een bestelling van 1 cent-equivalent in testmodus op
   het productieadres.

## Wat er mis kan gaan

- **Bestelling aangemaakt, Mollie onbereikbaar.** Afgevangen in stap 3 van
  het plaatsen: meteen annuleren. Blijft er toch iets hangen (proces sterft
  tussen commit en Mollie), dan vangt het opschoonscript het op.
- **Webhook komt nooit.** De statuspagina vraagt zelf bij Mollie na. Het
  opschoonscript controleert na 24 uur nog een keer bij Mollie voordat het
  annuleert, zodat een betaalde bestelling zonder webhook alsnog op betaald
  komt.
- **Webhook twee keer, of na de live opvraging.** De overgangsfunctie is
  idempotent; de bestelling wordt met `FOR UPDATE` gelockt.
- **Betaald na annulering** (kan bij een trage bank in theorie). Wordt
  gelogd als conflict, voorraad wordt niet nog eens afgeboekt, en fase 5 toont
  het in het beheerpaneel zodat de eigenaar terugbetaalt of alsnog verzendt.
- **Klarna.** Via de Payments API komt Klarna op `authorized` en wordt pas
  geind na een capture. Of Mollie dat automatisch doet hangt af van de
  instellingen. Daarom staat Klarna pas aan na een echte test in stap 8; tot
  die tijd iDEAL en creditcard.
- **Grote cookie.** Maximaal 20 regels; meer geeft een melding op de
  winkelwagenpagina.
- **Sharp en Mollie in een serverless functie.** Mollie is alleen HTTP; geen
  risico. De functie van de webhook laadt geen sharp.

## Verificatie

- Unit: cookie lezen en schrijven (kapot, te lang, dubbele regels),
  verzendkosten rond de drempel, btw per regel, bestelnummer, adresvalidatie,
  statusovergangen inclusief de foute volgordes.
- Integratie tegen dev: plaatsen met voorraadrace, webhook-paden met de
  nagebootste Mollie, precies-een-keer van de mail.
- Handmatig zonder JavaScript op telefoonbreedte: de hele stroom.
- Op een preview met echte Mollie-testbetalingen, stap 8.
- `npm run import` daarna: nul wijzigingen, bestellingen blijven staan.

## Vragen aan Adam

Met een aanbeveling, zodat een "ja, doe maar" genoeg is.

1. **Verzendkosten onder 50 euro.** Aanbeveling 4,95 euro. Alleen Nederland
   in deze fase; Belgie kan later met een tweede tarief.
2. **Betaalmethode kiezen op de pagina van Mollie** (aanbeveling) of op onze
   eigen afrekenpagina. Klarna pas na de echte test in stap 8.
3. **E-mail via Resend** (aanbeveling). Nodig: wie beheert de DNS van
   hh-shops.nl, zodat er verzonden kan worden vanaf `bestellingen@hh-shops.nl`;
   en het adres waarop de eigenaar bestelmeldingen wil (aanbeveling
   `info@hh-shops.nl`, het adres van de oude site).
4. **Bedrijfsgegevens** voor de verplichte pagina's: adres, retouradres,
   btw-nummer, telefoonnummer. Wat er niet is komt als INVULLEN in de tekst,
   zodat de livegang in fase 6 een controlelijst heeft.
5. **Beloftes gelijktrekken.** Besteltijd 15:00 (USP-balk) of 16:00
   (productpagina)? Bedenktijd 14 dagen (wettelijk) of 30 dagen
   (productpagina)? Aanbeveling: 15:00 en 14 dagen, tenzij de klant bewust 30
   dagen wil aanbieden; dan moet dat ook in de voorwaarden.
6. **Mollie-account.** Aanmaken op mollie.com op naam van de klant (de
   uitbetaling gaat naar zijn rekening, dus dat kan niet op een ander).
   Testsleutel `test_...` in `.env` als `MOLLIE_API_KEY` via Notepad, en in
   Vercel bij preview en productie. Tot die tijd bouwt en test fase 4 met de
   nagebootste betaling.
7. **Protection Bypass for Automation** aanzetten in het Vercel-project
   (Settings, Deployment Protection), zodat de webhook van Mollie een preview
   kan bereiken. Mag ik dat zelf doen?

## Open punten voor later

- Kortingscodes, cadeaubonnen: geen enkele aanwijzing dat de klant dit wil.
- Factuur-pdf en verzendlabels: fase 5, bij het bestelbeheer.
- Klantaccounts en bestelgeschiedenis: apart besluit.
- Betaalmethode op de eigen pagina en Apple Pay: parameter in de
  Mollie-aanroep, kan wanneer gewenst.
- Een contactformulier op `/contact`: na fase 4, met dezelfde Resend-koppeling.
