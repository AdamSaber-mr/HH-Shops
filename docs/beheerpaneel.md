# Het beheerpaneel

> Gebouwd op 10 september 2026, buiten de fasevolgorde van het plan van
> aanpak om, omdat de klant meteen producten moest kunnen beheren.

Het paneel staat op `/admin` van de shop zelf: zelfde project, zelfde database,
zelfde deploy. Alleen bereikbaar na inloggen.

## Wat het kan

- **Producten**: zoeken, filteren op status en categorie, sorteren, bladeren.
  Voorraad en prijs direct in de lijst aanpassen. Aanmaken en bewerken met
  naam, adres, status, merk, beschrijvingen (eenvoudige tekstverwerker),
  categorieen en vindbaarheid. Archiveren en terugzetten; definitief
  verwijderen alleen vanuit het archief, na het typen van VERWIJDER.
- **Varianten**: maten of kleuren per product, elk met eigen prijs, van-prijs,
  btw, voorraad en aan/uit. Artikelnummers worden automatisch toegekend en
  tellen door op de nummers uit de import (`HH-1084` en verder).
- **Foto's**: uploaden (JPG, PNG, WebP, maximaal 4 MB), verplichte alt-tekst,
  volgorde, optioneel aan een maat of kleur gekoppeld. Een eerste foto kan
  meteen mee bij het aanmaken; een bestaande foto is te vervangen door een
  nieuw bestand met behoud van plek en alt-tekst. Elke foto gaat door
  dezelfde verwerking als de import: recht, op wit, maximaal 1200 pixels,
  WebP.
- **Categorieen**: naam, adres, volgorde, beschrijving en foto. Verwijderen
  kan alleen als er geen producten meer aan hangen.
- **Beheerders**: toevoegen en verwijderen. Iedereen die kan inloggen mag
  alles.

Alles werkt zonder JavaScript. Met JavaScript komen er een tekstverwerker,
een bevestiging voor verwijderen en een vroege melding bij een te groot
bestand bij.

## Opzet

| Onderdeel | Waar |
|---|---|
| Inloggen | Better Auth, `src/auth/`, tabellen in `src/db/auth-schema.ts` (migratie 0003) |
| Toegang | `src/middleware.ts`: alleen `/admin` en actions raken de sessie; de storefront niet |
| Formulieren | Astro Actions in `src/actions/`, invoer opgeschoond met `src/lib/tekst.ts` (dezelfde regels als de import) |
| Datalaag | `src/lib/admin/`, alles in transacties, fouten van de database worden veldfouten |
| Pagina's | `src/pages/admin/`, layout `src/layouts/AdminLayout.astro`, componenten `src/components/admin/` |
| Foto's | `src/lib/media.ts` (gedeeld met de import) en Vercel Blob |

De regels van het datamodel gelden onverkort: geen naam met en-dash, geen
foto zonder alt-tekst, geen negatieve voorraad. Het formulier meldt het
netjes; de database weigert het sowieso.

## Beveiliging

- Wachtwoorden minstens 12 tekens, gehasht door Better Auth.
- Vijf inlogpogingen per minuut per IP, geteld in de database (op serverless
  is een teller in het geheugen niets waard).
- Sessies zeven dagen, in de database, geen cookiecache: uitloggen en
  verwijderen gelden meteen.
- CSRF via de origin-controle van Astro op elke POST.
- Registratie staat uit; accounts komen alleen uit het paneel of het script.

## Instellen

1. `BETTER_AUTH_SECRET` (32+ tekens) in `.env` en in Vercel voor preview en
   productie. Lokaal aanmaken met
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
2. Migratie 0003 draaien: `npm run db:migrate`, op elke Neon-branch waar het
   paneel op draait.
3. De eerste beheerder aanmaken, buiten het paneel om:

   ```
   node --env-file=.env scripts/beheerder-aanmaken.ts naam@voorbeeld.nl "Voornaam Achternaam"
   ```

   Het script vraagt om het wachtwoord. Daarna gaan verdere beheerders via
   het paneel.
4. Foto's uploaden heeft de Blob-sleutels nodig. Op Vercel staan die er
   automatisch; lokaal via `vercel env pull` (zie `.env.example`).

## Wat er bewust niet in zit

- Wachtwoord vergeten: er is geen e-mailverzending. Een beheerder die zijn
  wachtwoord kwijt is, laat een collega zijn account verwijderen en opnieuw
  aanmaken, of gebruikt het script.
- Rollen: iedereen mag alles. Bij meer dan een handvol beheerders is dat het
  eerste om te heroverwegen.
- Bestellingen: die tabel bestaat nog niet (fase 4).
- Meerdere foto's tegelijk uploaden.
