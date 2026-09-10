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
  favorieten. Uitloggen kan vanuit het zijmenu.
- **Favorieten**: het hartje op elke productkaart en op de productpagina.
  Zonder account in een cookie, met account in de database. Terug te vinden
  op `/account/favorieten`, in hetzelfde raster als de winkel.
- **Winkelmand** op `/winkelmand`: aantal aanpassen, verwijderen, subtotaal.
  Prijs, naam, foto en voorraad komen bij elke weergave uit de database; een
  artikel dat niet meer te koop is valt af met een melding, een aantal boven
  de voorraad wordt verlaagd met een melding. Maximaal 10 per artikel en 20
  verschillende artikelen.
- **Header**: de teller bij de winkelmand en de voornaam bij "Account".

Alles werkt zonder JavaScript. Met JavaScript wisselt het hartje zonder de
pagina te herladen; de rest is gewone formulieren.

## Opzet

| Onderdeel | Waar |
|---|---|
| Rollen en toegang | `src/auth/sessie.ts`, `src/middleware.ts`, `src/actions/_helpers.ts` |
| Inloggen en registreren via de Better Auth-handler (met rate limit) | `src/auth/inloggen.ts` |
| Tabellen `favorites`, `cart_items`, `customer_addresses` | `src/db/klanten-schema.ts`, migratie `drizzle/0004_klanten.sql` |
| Cookies van gasten (`hh_winkelmand`, `hh_favorieten`) | `src/lib/klanten/cookies.ts` |
| Winkelmand lezen, opschonen, schrijven | `src/lib/klanten/winkelmand.ts` |
| Favorieten | `src/lib/klanten/favorieten.ts` |
| Samenvoegen bij inloggen | `src/lib/klanten/samenvoegen.ts` (zuiver, met tests) en `gast.ts` |
| Adresvalidatie | `src/lib/klanten/adres.ts` |
| Actions | `src/actions/klant.ts`, `winkelmand.ts`, `favorieten.ts` |
| Componenten | `src/components/klant/` (Hartje, WinkelmandKnop, Formulierveld, Melding, AccountMenu, AccountPagina) |
| Pagina's | `src/pages/account/*`, `src/pages/winkelmand.astro`, `src/pages/geen-toegang.astro` |

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
- Inloggen: vijf pogingen per minuut per IP. Registreren: drie per tien
  minuten per IP, plus een honeypot-veld op het formulier. Geteld in de
  database.
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

- **Wachtwoord vergeten en e-mailbevestiging.** Er is nog geen mailkoppeling.
  Een klant die zijn wachtwoord kwijt is, moet nu contact opnemen. Zodra
  Resend (of een ander) gekoppeld is: `emailVerification` en
  `sendResetPassword` in `src/auth/create.ts`, en dan ook `changeEmail`
  weer via Better Auth in plaats van de directe update in
  `src/lib/klanten/account.ts`.
- **Account verwijderen.** Komt later; het is wel een AVG-verplichting voor
  de livegang.
- **Meerdere adressen, factuuradres, Belgie.** Een adres per klant, alleen
  Nederland.
- **Bestelgeschiedenis.** Na fase 4.
- **Toevoegen aan de winkelmand zonder naar de winkelmand te gaan.** Nu
  altijd een redirect naar `/winkelmand` met "Verder winkelen" terug; een
  variant die op de pagina blijft is een kleine JavaScript-uitbreiding.

## Instellen

Er komt niets bij: dezelfde `DATABASE_URL` en `BETTER_AUTH_SECRET` als het
beheerpaneel. Migratie 0004 draaien met `npm run db:migrate` op elke
database waar de shop tegen praat. Het script `scripts/beheerder-aanmaken.ts`
zet na het registreren zelf de rol op admin.
