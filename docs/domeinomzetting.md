# De domeinomzetting

> Bijgewerkt op 14 september 2026. Dit is de afvinklijst voor het moment dat
> `hh-shops.nl` van WordPress naar deze shop gaat. Alles wat in code kon,
> is gedaan; wat hier staat kan alleen een mens doen, of moet op het moment
> zelf gebeuren.

> Naast dit document staat `docs/livegang.html`: dezelfde lijst om af te
> vinken, te openen met een dubbelklik. Dit bestand is de toelichting, dat
> bestand is de werklijst.

Het domein blijft hetzelfde, alleen wat erachter draait verandert. Dat is
gunstig: Google houdt de geschiedenis van het domein. Alleen de adressen
binnen het domein veranderen, en die verwijzen allemaal door
(`docs/vindbaarheid.md`). Een verhuisverzoek in Search Console is dus niet
nodig.

## Stand op 14 september 2026

| Wat | Stand |
|---|---|
| DNS `hh-shops.nl` | Wijst naar 162.55.38.56, de oude WordPress-server |
| Mail | Microsoft 365, SPF `-all` alleen Outlook, **geen DMARC** |
| Resend | `hh-shops.nl` staat er niet in (geen `resend._domainkey`) |
| Mollie | Profiel heet "Test profile", website example.org, **unverified**, Klarna staat aan |
| Inloggen op het nieuwe domein | Geregeld, zie `src/auth/create.ts` |
| Oude links, robots, sitemap | Geregeld, zie `docs/vindbaarheid.md` |
| btw-nummer | Onbekend, staat ook niet op de oude site |

## Vooraf, kan nu al

Dit hoeft niet op hetzelfde moment en is het meeste werk. Begin met de eerste
twee: daar zit doorlooptijd bij een ander.

1. **Mollie.** Er is nog geen echt profiel. Maak er een op naam van de winkel
   met de KvK, de bankrekening en `https://hh-shops.nl` als website, en laat
   het verifiëren. Zet daarna iDEAL en creditcard aan en **Klarna uit** (die
   staat nu aan, en de collega heeft bevestigd dat hij er niet komt). De
   livesleutel (`live_...`) gaat als `MOLLIE_API_KEY` naar Cloudflare
   (`npx wrangler secret put MOLLIE_API_KEY`), alleen voor
   Production. Zonder sleutel weigert de shop in productie af te rekenen; dat
   is met opzet, zodat een klant nooit op een testpagina belandt.

2. **Resend.** Meld `hh-shops.nl` aan en zet de DNS-records die Resend geeft.
   Resend gebruikt daarvoor een subdomein (`send.hh-shops.nl`), dus aan de
   bestaande SPF voor Microsoft 365 hoeft niets te veranderen. Zet daarna
   `MAIL_FROM="HH Shops <noreply@hh-shops.nl>"` op Cloudflare. Zolang dit niet
   staat, gaan alle mails van de shop, ook de bestelbevestiging en de
   verzendmail, alleen naar het eigen adres van de accounthouder.

3. **Zet er een DMARC-record bij.** Dat staat los van Resend en ontbreekt nu
   helemaal. Zonder DMARC belanden bestelbevestigingen vaker in de spam, en
   Google en Yahoo eisen het van iedereen die wat volume stuurt. Begin
   voorzichtig, op alleen rapporteren:

   ```
   _dmarc.hh-shops.nl   TXT   "v=DMARC1; p=none; rua=mailto:info@hh-shops.nl"
   ```

   Na een paar weken rapporten kan `p=none` naar `p=quarantine`.

4. **`CRON_SECRET` op Cloudflare.** Let op: de dagelijkse cron loopt hier niet
   meer langs, die komt binnen via `scheduled()` in `src/worker.ts`. Dit geheim
   beveiligt alleen nog het handmatig aanroepen van
   `/api/cron/bestellingen-opschonen`. Zonder deze
   variabele weigert `/api/cron/bestellingen-opschonen` elk verzoek, ook dat
   van het platform zelf, en blijft er niets opgeschoond langs die weg:
   bestellingen die op
   een betaling bleven hangen houden hun voorraad vast. Een nieuwe waarde
   maken:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

5. **Migratie 0008 op de main-database.** Die is op de dev-branch gedraaid,
   niet op main. `.env.productie` was leeg; vul daar de verbinding van de Neon
   **main**-branch in, allebei de vormen:

   ```
   DATABASE_URL            met connection pooling AAN  (host met -pooler)
   DATABASE_URL_UNPOOLED   met connection pooling UIT  (zelfde host zonder)
   ```

   Draai hem dan met:

   ```
   npm run db:migrate:productie            kijken, doet niets
   npm run db:migrate:productie -- --doe   echt draaien
   ```

   **Niet met `npm run db:migrate`.** Dat leest altijd `.env`, dus de
   dev-branch, ook als je er een ander env-bestand voor zet: een variabele die
   al in de omgeving staat wint van `process.loadEnvFile('.env')` in
   `drizzle.config.ts`, maar andersom niet. Vergeet je dat een keer, dan denk
   je dat productie bij is terwijl dat niet zo is. `scripts/migreren.ts` toont
   daarom eerst welke database het betreft en weigert als het de dev-branch
   blijkt te zijn.

6. **Het btw-nummer.** Verplicht om te noemen (artikel 3:15d BW) en het staat
   nergens op de oude site, dus het moet uit de eigen aangifte komen. Invullen
   in `src/lib/juridisch.ts` op de frontend-branch.

7. **Het retouradres bevestigen.** Ook in `src/lib/juridisch.ts`. Een verkeerd
   adres kost een klant zijn pakket.

## De omzetting zelf

8. `hh-shops.nl` en `www.hh-shops.nl` als custom domain aan de Worker
   koppelen en de DNS omzetten. Inloggen werkt daarna meteen: beide adressen
   staan al in `TOEGESTANE_HOSTS` en `VERTROUWDE_HERKOMSTEN`
   (`src/auth/create.ts`), en `src/auth/create.test.ts` houdt in de gaten dat
   ze er blijven staan.

9. `site: 'https://hh-shops.nl'` in `astro.config.mjs` zetten. Dat staat er nu
   bewust niet: zolang het domein naar WordPress wijst, zouden canonieke URL's
   naar de oude site verwijzen. Dit hoort bij dezelfde deploy als de
   omzetting, samen met het toevoegen van de canonieke link in de `<head>`.

## Meteen erna nakijken

10. `https://hh-shops.nl/robots.txt` moet `Allow: /` tonen en een
    `Sitemap:`-regel. Staat er `Disallow: /`, dan komt het verzoek niet op
    `hh-shops.nl` binnen en klopt er iets niet aan het domein.

11. `https://hh-shops.nl/sitemap.xml` indienen in Google Search Console.

12. `npm run links:controleren` draaien tegen de productiedatabase, en daarna
    een paar oude links uit Google met de hand aanklikken.

13. Inloggen op `/admin` en op `/account`, met een bestaand account.

14. **Een echte bestelling doen van een paar euro**, met een echte betaling.
    Controleren dat de bevestiging aankomt bij een adres dat niet van de
    winkel is, hem in het paneel op verzonden zetten met een
    track-and-tracecode, en controleren dat die verzendmail ook aankomt.
    Daarna terugbetalen via het Mollie-dashboard.

## Wat er daarna nog los van staat

- De verplichte pagina's, die op de frontend-branch worden gemaakt.
- Het herroepingsformulier. De eigen algemene voorwaarden (artikel 5.3)
  verplichten de winkel dat op verzoek te geven, en het bestaat nog niet.
- Terugbetalen vanuit het paneel en een factuur-pdf, bewust later
  (`docs/bestellen.md`).
