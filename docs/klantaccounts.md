# Klantaccounts, winkelmand en favorieten

Gebouwd op 10 september 2026. Klanten kunnen een account aanmaken, producten
bewaren met het hartje, en een winkelmand vullen. Gasten kunnen dat ook; wat
ze bewaren gaat mee zodra ze inloggen of registreren.

Afrekenen zit hier bewust niet in. De knop in de winkelmand staat uit tot
fase 4 is besproken (zie `docs/fase-4-afrekenen.md`).

## Wat het kan

- **Account**: registreren op `/account/registreren`, inloggen op
  `/account/inloggen`, en onder `/account` een overzicht, naam en e-mailadres
  wijzigen, wachtwoord wijzigen, een bezorgadres (alleen Nederland) en de
  favorieten. Uitloggen kan vanuit het zijmenu. Verwijderen op
  `/account/verwijderen`, met het wachtwoord als bevestiging.
- **Mail** (sinds 11 september 2026): bij registratie gaat een
  bevestigingsmail naar het adres; inloggen mag ook zonder bevestiging, het
  overzicht toont een herinnering met een knop om de mail opnieuw te sturen.
  Wachtwoord vergeten op `/account/wachtwoord-vergeten`: een mail met een
  link naar `/account/wachtwoord-herstellen`, een uur geldig, een keer te
  gebruiken; daarna zijn alle sessies ingetrokken. Een nieuw e-mailadres
  geldt pas nadat de link in de mail naar dat nieuwe adres is aangeklikt, ook
  als het oude adres nooit bevestigd was. Beide links komen uit op
  `/account/bevestigd`.
- **Favorieten**: het hartje op elke productkaart en op de productpagina.
  Zonder account in een cookie, met account in de database. Terug te vinden
  op `/favorieten` (ook voor gasten) en onder het account, in hetzelfde
  raster als de winkel.
- **Winkelmand** op `/winkelmand`: aantal aanpassen, verwijderen, subtotaal.
  Prijs, naam, foto en voorraad komen bij elke weergave uit de database; een
  artikel dat niet meer te koop is valt af met een melding, een aantal boven
  de voorraad wordt verlaagd met een melding. Maximaal 10 per artikel en 20
  verschillende artikelen.
- **Header**: een hartje en de winkelmand, elk met een groene teller die
  altijd zichtbaar is (ook bij nul), en de voornaam bij "Account". Een klik
  op het hartje opent een zijpaneel met de favorieten, ook voor gasten; het
  paneel haalt zijn inhoud pas bij openen op van `/favorieten/paneel`. Zonder
  JavaScript is het hartje een link naar `/favorieten`, de openbare
  favorietenpagina.

Alles werkt zonder JavaScript. Met JavaScript wisselt het hartje zonder de
pagina te herladen; de rest is gewone formulieren.

## Opzet

| Onderdeel | Waar |
|---|---|
| Rollen en toegang | `src/auth/sessie.ts`, `src/middleware.ts`, `src/actions/_helpers.ts` |
| Inloggen, registreren en wachtwoord herstellen via de Better Auth-handler (met rate limit) | `src/auth/inloggen.ts` |
| Mail: sjablonen (zuiver, met tests), versturen via Resend of loggen, en de mailer binnen Astro | `src/lib/mail/sjablonen.ts`, `versturen.ts`, `server.ts` |
| Wat Better Auth met de mails doet (herstellink, bevestiging, adreswijziging, verwijderen) | `src/auth/create.ts` |
| Tabellen `favorites`, `cart_items`, `customer_addresses` | `src/db/klanten-schema.ts`, migratie `drizzle/0004_klanten.sql` |
| Cookies van gasten (`hh_winkelmand`, `hh_favorieten`) | `src/lib/klanten/cookies.ts` |
| Winkelmand lezen, opschonen, schrijven | `src/lib/klanten/winkelmand.ts` |
| Favorieten | `src/lib/klanten/favorieten.ts` |
| Samenvoegen bij inloggen | `src/lib/klanten/samenvoegen.ts` (zuiver, met tests) en `gast.ts` |
| Adresvalidatie | `src/lib/klanten/adres.ts` |
| Actions | `src/actions/klant.ts`, `winkelmand.ts`, `favorieten.ts` |
| Componenten | `src/components/klant/` (Hartje, WinkelmandKnop, Teller, FavorietenPaneel, FavorietenLijst, Formulierveld, Melding, AccountMenu, AccountPagina); het gedeelde hartjesscript in `src/scripts/hartje.ts` |
| Pagina's | `src/pages/account/*` (ook `wachtwoord-vergeten`, `wachtwoord-herstellen`, `bevestigd`, `verwijderen`, `verwijderd`), `src/pages/favorieten/` (pagina en paneel-partial), `src/pages/winkelmand.astro`, `src/pages/geen-toegang.astro` |

**Een Better Auth voor klanten en beheerders.** Dezelfde tabel `auth_users`,
kolom `role`: `klant` (elke zelfregistratie, via `defaultRole`) of `admin`
(aangemaakt vanuit het paneel of het script). `/admin` en de beheer-actions
eisen de rol admin; een klant die daar komt krijgt `/geen-toegang`. Het
inlogscherm van het paneel weigert een klantaccount met dezelfde melding
als een fout wachtwoord.

**Gasten kosten geen query.** De middleware zoekt de sessie alleen op als de
sessiecookie van Better Auth er is, of op `/admin`, `/account` en bij een
action. Een ingelogde bezoeker kost een query per pagina, plus een voor de
teller in de header.

**Formulieren van elke pagina.** Een POST naar `winkelmand.*`,
`favorieten.wissel` of `klant.uitloggen` wordt door de middleware zelf
uitgevoerd en met een 303 teruggestuurd naar het veld `naar` (na een
controle dat het een pad op deze site is). De productkaart, de
productpagina en de favorietenpagina hoeven daar niets voor te doen, en
verversen verstuurt niets opnieuw. Fouten komen in een flash-cookie
(`hh_flash`) en worden op de doelpagina getoond.

**Samenvoegen.** Bij inloggen of registreren gaan de cookies het account
in: aantallen van dezelfde variant opgeteld tot 10, favorieten verenigd,
daarna worden de cookies gewist. Id's die niet bestaan worden overgeslagen.

## Beveiliging

- Wachtwoorden minstens 12 tekens, gehasht door Better Auth. Wijzigen vraagt
  het huidige wachtwoord en logt andere apparaten uit.
- Inloggen: vijf pogingen per minuut per IP. Registreren en wachtwoord
  vergeten: drie per tien minuten per IP, plus een honeypot-veld op het
  formulier. Herstellen, adres wijzigen en verwijderen zijn ook begrensd.
  Geteld in de database.
- Wachtwoord vergeten zegt nooit of een adres bestaat; de melding is voor
  iedereen gelijk. De herstelpagina stuurt geen referrer mee.
- Account verwijderen en het wachtwoord wijzigen vragen het huidige
  wachtwoord. Een beheerder kan zijn account niet via de klantkant
  verwijderen.
- Sessies zeven dagen, in de database, geen cookiecache: uitloggen geldt
  meteen.
- CSRF via de origin-controle van Astro op elke POST.
- `?naar=` en het veld `naar` accepteren alleen paden op de site, nooit
  `/admin` of `/api`.
- De account- en winkelmandpagina's zijn `noindex` en `Cache-Control:
  no-store`.
- In de cookies van gasten staan alleen id's en aantallen; de server
  vertrouwt er niets uit.

## Wat er bewust niet in zit

- **Verplichte bevestiging voor het inloggen.** Een onbevestigd adres mag
  inloggen en straks bestellen; de herinnering in het account volstaat.
  Verplicht maken is een schakelaar (`requireEmailVerification`) in
  `src/auth/create.ts`.
- **Bestellingen bij een verwijderd account.** Zodra bestellingen bestaan
  (fase 4) blijven die bewaard voor de boekhouding, losgekoppeld van het
  account.
- **Meerdere adressen, factuuradres, Belgie.** Een adres per klant, alleen
  Nederland.
- **Bestelgeschiedenis** staat sinds fase 4 onder `/account/bestellingen`,
  zie docs/bestellen.md.
- **Toevoegen aan de winkelmand zonder naar de winkelmand te gaan.** Nu
  altijd een redirect naar `/winkelmand` met "Verder winkelen" terug; een
  variant die op de pagina blijft is een kleine JavaScript-uitbreiding.

## Instellen

Dezelfde `DATABASE_URL` en `BETTER_AUTH_SECRET` als het beheerpaneel, plus
voor de mail `RESEND_API_KEY` (alleen verzendrechten, uit het eigen
Resend-account van HH Shops) in `.env` en in Vercel voor preview en
productie. Zonder sleutel, of met `MAIL_MODUS=log`, komen de mails in
`astro dev logs` in plaats van in een postvak; zo zijn de stromen lokaal te
testen. `MAIL_FROM` blijft leeg tot hh-shops.nl bij Resend geverifieerd is
(tot die tijd stuurt Resend alleen naar het eigen adres van de
accounthouder); daarna `HH Shops <noreply@hh-shops.nl>`.

Let op: Better Auth vangt een fout bij het versturen zelf af. Weigert
Resend een mail (bijvoorbeeld omdat het domein nog niet geverifieerd is en
het adres niet van de accounthouder is), dan ziet de bezoeker toch "we
hebben een mail gestuurd" en staat de fout alleen in de logs (`astro dev
logs`, op Vercel de runtime logs). Controleer na het omzetten van
`MAIL_FROM` dus een keer echt een wachtwoord-vergeten.

Migratie 0004 draaien met `npm run db:migrate` op elke database waar de
shop tegen praat. Het script `scripts/beheerder-aanmaken.ts` zet na het
registreren zelf de rol op admin.
