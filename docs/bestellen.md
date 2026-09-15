# Bestellen en betalen

> Gebouwd op 11 september 2026, fase 4 uit het plan van aanpak. Winkelmand
> en accounts bestonden al (docs/klantaccounts.md); dit is het afrekenen,
> de betaling via Mollie, de bestelmails en het bestelbeheer.
>
> Op 14 september 2026 uitgebreid met de verzendmail en track and trace
> (migratie 0008). Daarvoor hoorde de klant na "verzonden" niets meer.

## Wat het kan

- **Afrekenen** op `/afrekenen`: gegevens, bezorgadres (alleen Nederland),
  telefoon en opmerking optioneel, vinkje voor de voorwaarden. Gasten kunnen
  afrekenen; een ingelogde klant krijgt naam, e-mail en bezorgadres
  vooringevuld en de bestelling hangt aan het account.
- **Plaatsen**: de server rekent alles opnieuw uit (prijzen en voorraad uit
  de database, nooit uit de browser). In een transactie: bestelnummer
  (`HH-100001` en verder, zonder gaten), bestelling, regels als
  momentopname, en per regel de voorraad eraf met `stock_quantity >= aantal`
  als voorwaarde. Twee klanten die tegelijk het laatste exemplaar bestellen:
  een wint, de ander krijgt een melding en houdt zijn winkelmand.
- **Betalen** via de Payments API van Mollie: betaalmethode kiezen bij
  Mollie zelf. De code noemt geen methoden, dus wat de klant te zien krijgt
  staat in het Mollie-dashboard. Klarna komt er niet (bevestigd op 14
  september 2026); dat hoeft dus alleen in dat dashboard uit te staan. Zonder
  sleutel, buiten productie, een nagebootste Mollie op
  `/betaling-test/<id>` met knoppen Betaald, Mislukt, Verlopen en
  Geannuleerd, zodat elk pad lokaal en op een preview te testen is.
- **Afloop**: de webhook (`POST /api/mollie/webhook`) en de statuspagina
  (`/bestelling/<token>`) vragen de status bij Mollie zelf op en passen
  dezelfde overgang toe (`src/lib/bestellen/status.ts`, zuiver en getest).
  Betaald: mail naar de klant en naar de eigenaar, precies een keer.
  Mislukt, verlopen of geannuleerd: bestelling op geannuleerd, voorraad
  terug, knop "Zet de artikelen terug in mijn winkelmand". Betaald na
  annulering wordt als conflict gelogd en in het paneel getoond.
- **Verzenden**: in het paneel kiest de beheerder de vervoerder en vult hij
  de track-and-tracecode in; de bestelling gaat op verzonden en de klant
  krijgt meteen een mail met de code en een knop naar de volgpagina. Ook
  zonder code gaat die mail, want "je pakket is onderweg" is beter dan
  stilte. Een code die later alsnog binnenkomt of een tikfout is bij te
  werken, met een vinkje of de klant opnieuw bericht krijgt. Zie
  "Track and trace" hieronder.
- **Beheerpaneel** onder `/admin/bestellingen`: lijst met filter op status
  en zoeken, detail met artikelen, klant, adres, de verzendgegevens en het
  volledige logboek, knoppen "Markeer als verzonden en mail de klant" en
  "Controleer bij Mollie".
- **Account**: `/account/bestellingen` met de eigen bestellingen; elke
  bestelling linkt naar de statuspagina.
- **Vangnet**: `scripts/bestellingen-opschonen.ts` (met `--doe`) controleert
  bestellingen die langer dan 24 uur op een betaling wachten nog eens bij
  Mollie en annuleert ze anders met de voorraad terug.

Verzendkosten 4,24 euro, gratis vanaf 50 euro (`src/lib/bestellen/instellingen.ts`).

## Opzet

| Onderdeel | Waar |
|---|---|
| Tabellen `orders`, `order_items`, `order_events` | `src/db/orders-schema.ts`, migratie `drizzle/0006_bestellingen.sql` |
| Bedragen, btw, verzendkosten (zuiver, getest) | `src/lib/bestellen/bedragen.ts` |
| Statusovergangen (zuiver, getest) | `src/lib/bestellen/status.ts` |
| Mollie-koppeling, echt en nagebootst | `src/lib/bestellen/mollie.ts`, gekozen in `server.ts` |
| Plaatsen en betaling starten | `src/lib/bestellen/plaatsen.ts` |
| Betaling verwerken, annuleren, mails | `src/lib/bestellen/verwerken.ts`, `annuleren.ts` |
| Leesvragen | `src/lib/bestellen/lezen.ts` |
| Mailsjablonen bestelling en verzending | `src/lib/mail/sjablonen.ts` |
| Vervoerders en volglinks (zuiver, getest) | `src/lib/bestellen/verzending.ts` |
| Actions | `src/actions/afrekenen.ts` (open), `src/actions/bestellingen.ts` (beheer) |
| Pagina's | `src/pages/afrekenen.astro`, `bestelling/[token].astro`, `betaling-test/[id].astro`, `api/mollie/webhook.ts`, `account/bestellingen.astro`, `admin/bestellingen/` |

**De statuspagina is de sleutel.** Het bestelnummer is te raden, het token
(32 willekeurige bytes) niet. Mollie stuurt de klant naar de tokenpagina
terug; de mail linkt ernaar.

**Alleen Mollie's antwoord telt.** De webhook bevat alleen een id; de
redirect zegt niets. In beide gevallen wordt `payments.get` gedaan en de
bestelling in de transactie gelockt (`FOR UPDATE`), zodat webhook en
statuspagina elkaar niet in de weg zitten. De overgang is idempotent.

## Track and trace

De volglink wordt elke keer opnieuw uitgerekend uit de code en de postcode
van de klant, en staat niet in de database (`src/lib/bestellen/verzending.ts`).
Verandert een vervoerder zijn adres, dan kloppen oude bestellingen ook weer
zodra dat ene bestand klopt.

| Vervoerder | Wat de link nodig heeft |
|---|---|
| PostNL | code plus postcode |
| DHL | code plus postcode |
| DPD, GLS, UPS | alleen de code |
| Anders | de beheerder plakt zelf de volledige link |

"Anders" is voor een vervoerder die er niet bij staat, bijvoorbeeld als een
bestelling via een verkoopkanaal loopt dat zijn eigen volgpagina heeft. De
klant leest dan geen vervoerdersnaam, alleen "Je pakket is verzonden" met de
knop "Volg je pakket".

De code wordt opgeschoond voor hij wordt bewaard: spaties en punten eruit,
hoofdletters erop, want zo staat hij op het label en zo verwachten de
volgpagina's hem. `3s abcd 1234 567` wordt `3SABCD1234567`.

De verzendmail gaat precies een keer (`shipment_sent_at`), tenzij de
beheerder hem bewust opnieuw stuurt. Mislukt hij, dan blijft de bestelling
gewoon op verzonden staan, komt er een regel in het logboek en staat het
formulier klaar om het opnieuw te proberen. Een mail die niet aankomt mag het
inpakken niet ongedaan maken.

**CSRF.** Astro's eigen herkomstcontrole staat uit (`checkOrigin: false`)
omdat die geen uitzonderingen kent; `src/middleware.ts` doet dezelfde
controle zelf, met `/api/mollie/` als enige uitzondering. De webhook
bewijst zichzelf doordat hij de status bij Mollie navraagt.

**Previews.** Een preview op Workers staat gewoon open, dus Mollie komt er
zonder meer bij. Op Vercel zat daar nog een bypass-geheim omheen, omdat een
preview daar achter een inlogscherm stond; dat is bij de overstap vervallen.
Lokaal kan Mollie ons niet bereiken; dan geen webhook, en de statuspagina
vraagt zelf na.

## Instellen

| Variabele | Waar | Waarvoor |
|---|---|---|
| `MOLLIE_API_KEY` | `.dev.vars`, en `wrangler secret put` op Cloudflare | `test_...` tot de livegang, daarna `live_...`. `MOLLIE_API_TEST_KEY` wordt ook gelezen |
| `MOLLIE_MODUS=nep` | lokaal | de nagebootste Mollie afdwingen, ook met sleutel |
| `OMGEVING` | `wrangler.jsonc` zet `productie`; `.dev.vars` zet lokaal iets anders | bepaalt of de nagebootste Mollie mag draaien |
| `BESTELLING_MAIL_NAAR` | optioneel | eigenaar-adres; standaard info@hh-shops.nl |
| `RESEND_API_KEY` | zie docs/klantaccounts.md | de mails |

Migraties 0006 en 0008 draaien met `npm run db:migrate` op elke database. In
productie weigert de koppeling te starten zonder Mollie-sleutel.

Voor de livegang: in het Mollie-dashboard de gegevens van de winkel
(KvK, bankrekening, website) laten controleren, daar iDEAL en creditcard
aanzetten en Klarna uit laten, de livesleutel met `wrangler secret put` zetten, en een
bestelling van een paar euro echt doen en terugbetalen.

## Voor de privacyverklaring

Wat het bestelproces vastlegt, zodat de privacyverklaring (nog te maken)
het kan noemen:

- Per bestelling: naam, e-mailadres, bezorgadres, telefoonnummer en
  opmerking als de klant die geeft, de bestelde artikelen en bedragen, het
  betalingskenmerk van Mollie en de betaalmethode, en na verzending de
  vervoerder en de track-and-tracecode. Nodig om de bestelling uit te voeren
  en wettelijk zeven jaar te bewaren voor de boekhouding.
- Verwijdert een klant zijn account, dan verdwijnen account, favorieten,
  winkelmand en bezorgadres. De bestellingen blijven bewaard, losgekoppeld
  van het account (`user_id` wordt leeg), met de gegevens die erop staan.
- Verwerkers: Cloudflare (hosting en foto-opslag, Europa), Neon (database, Frankfurt), Mollie
  (betaling; ziet naam, bedrag en omschrijving, nooit onze wachtwoorden),
  Resend (mail), en de vervoerder die het pakket bezorgt (naam en adres).
- Cookies: alleen functioneel (sessie, winkelmand, favorieten, meldingen).

## Wat er bewust niet in zit

- Factuur-pdf en verzendlabels: later, bij het bestelbeheer. De
  track-and-tracecode wordt met de hand ingevuld; er is geen koppeling met
  een vervoerder die hem zelf ophaalt.
- Kortingscodes.
- Betaalmethode kiezen op de eigen afrekenpagina; het is een parameter in
  de Mollie-aanroep.
- Terugbetalen vanuit het paneel: via het Mollie-dashboard.
- De verplichte pagina's (voorwaarden, privacy, retour): apart, in overleg
  met de collega's. Het vinkje bij het afrekenen linkt al naar
  `/algemene-voorwaarden`.
