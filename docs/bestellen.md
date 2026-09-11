# Bestellen en betalen

> Gebouwd op 11 september 2026, fase 4 uit het plan van aanpak. Winkelmand
> en accounts bestonden al (docs/klantaccounts.md); dit is het afrekenen,
> de betaling via Mollie, de bestelmails en het bestelbeheer.

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
  Mollie zelf (iDEAL en creditcard; Klarna pas na een echte test). Zonder
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
- **Beheerpaneel** onder `/admin/bestellingen`: lijst met filter op status
  en zoeken, detail met artikelen, klant, adres en het volledige logboek,
  knoppen "Markeer als verzonden" en "Controleer bij Mollie".
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
| Mailsjablonen bestelling | `src/lib/mail/sjablonen.ts` |
| Actions | `src/actions/afrekenen.ts` (open), `src/actions/bestellingen.ts` (beheer) |
| Pagina's | `src/pages/afrekenen.astro`, `bestelling/[token].astro`, `betaling-test/[id].astro`, `api/mollie/webhook.ts`, `account/bestellingen.astro`, `admin/bestellingen/` |

**De statuspagina is de sleutel.** Het bestelnummer is te raden, het token
(32 willekeurige bytes) niet. Mollie stuurt de klant naar de tokenpagina
terug; de mail linkt ernaar.

**Alleen Mollie's antwoord telt.** De webhook bevat alleen een id; de
redirect zegt niets. In beide gevallen wordt `payments.get` gedaan en de
bestelling in de transactie gelockt (`FOR UPDATE`), zodat webhook en
statuspagina elkaar niet in de weg zitten. De overgang is idempotent.

**CSRF.** Astro's eigen herkomstcontrole staat uit (`checkOrigin: false`)
omdat die geen uitzonderingen kent; `src/middleware.ts` doet dezelfde
controle zelf, met `/api/mollie/` als enige uitzondering. De webhook
bewijst zichzelf doordat hij de status bij Mollie navraagt.

**Previews.** Vercel-previews staan achter Deployment Protection. De
webhook-URL krijgt daar `?x-vercel-protection-bypass=<geheim>` mee
(`VERCEL_AUTOMATION_BYPASS_SECRET`). Lokaal kan Mollie ons niet bereiken;
dan geen webhook, en de statuspagina vraagt zelf na.

## Instellen

| Variabele | Waar | Waarvoor |
|---|---|---|
| `MOLLIE_API_KEY` | `.env`, Vercel preview en productie | `test_...` tot de livegang, daarna `live_...`. `MOLLIE_API_TEST_KEY` wordt ook gelezen |
| `MOLLIE_MODUS=nep` | lokaal | de nagebootste Mollie afdwingen, ook met sleutel |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | `.env`, door Vercel gezet op previews | webhook op een preview |
| `BESTELLING_MAIL_NAAR` | optioneel | eigenaar-adres; standaard info@hh-shops.nl |
| `RESEND_API_KEY` | zie docs/klantaccounts.md | de mails |

Migratie 0006 draaien met `npm run db:migrate` op elke database. In
productie weigert de koppeling te starten zonder Mollie-sleutel.

Voor de livegang: in het Mollie-dashboard de gegevens van de winkel
(KvK, bankrekening, website) laten controleren, de livesleutel in Vercel
zetten, en een bestelling van een paar euro echt doen en terugbetalen.

## Wat er bewust niet in zit

- Factuur-pdf en verzendlabels: later, bij het bestelbeheer.
- Kortingscodes.
- Betaalmethode kiezen op de eigen afrekenpagina; het is een parameter in
  de Mollie-aanroep.
- Terugbetalen vanuit het paneel: via het Mollie-dashboard.
- De verplichte pagina's (voorwaarden, privacy, retour): apart, in overleg
  met de collega's. Het vinkje bij het afrekenen linkt al naar
  `/algemene-voorwaarden`.
