# HH Shops, plan van aanpak

> Dit document legt vast **wat** we bouwen en **waarom**.
> Het schrijft bewust niet voor **hoe**. Techniek, structuur en implementatie
> bepalen we per fase, op het moment dat we eraan toe zijn.

---

## In het kort

We bouwen een compleet nieuwe webshop voor HH Shops, los van hun huidige
WordPress-site. Een eigen storefront, een eigen database, een eigen checkout
en een eigen beheeromgeving. De huidige site gaat na de overstap uit de lucht.

HH Shops verkoopt huishoudelijke artikelen, kinderartikelen, cosmetica, tassen,
computeraccessoires en schoeisel. Ongeveer 94 producten in 9 categorieen, met
prijzen tussen de 8 en 40 euro. Nederlandstalig, Nederlandse klanten.

Dit is een echte klantwebshop. Hij moet werken, veilig zijn, en er professioneel
uitzien. Dat zijn de drie eisen waaraan alles wordt afgemeten.

---

## Waarom vervangen en niet opknappen

De huidige site draait op WordPress met WooCommerce en de Breakdance-pagebuilder.
We hebben hem doorgemeten voordat we deze keuze maakten. Wat we vonden:

| Wat | Meting |
|---|---|
| Logo en favicons | Wijzen naar `hh-shops.instawp.co`, een oud stagingdomein dat niet meer bestaat in DNS. Ze laden dus nergens |
| Afbeeldingen | 227 stuks. De 54 PNG's zijn samen 22 van de 30 MB, gemiddeld 413 KB met uitschieters tot 1,9 MB. De 170 JPG's zijn met 48 KB gemiddeld prima |
| Winkelpagina | Laadt alle 94 producten tegelijk, 313 KB aan HTML, terwijl er wel een link naar pagina 2 staat |
| Alt-teksten | 256 van de 269 afbeeldingsverwijzingen zonder. Slecht voor Google en onbruikbaar voor schermlezers |
| Productmodel | 92 van de 94 producten staan als `simple` in WooCommerce. Zestien daarvan zijn in werkelijkheid maat- of kleurvarianten van zes producten, los naast elkaar in de shop. Twee producten zijn wel als `variable` opgezet, waarvan er een dubbelt met drie losse maten |
| Artikelnummers | Geen enkel product heeft een SKU |
| Voorraad | 32 van de 94 is uitverkocht, 34 procent, en staat gewoon tussen de rest |
| Reviews | Nul in het systeem, terwijl de homepage wel klantbeoordelingen toont |

Los van elkaar zijn dit reparaties. Bij elkaar is het een site waarvan het
fundament niet klopt. Opknappen betekent vastzitten aan Breakdance en aan een
datamodel dat niet past bij wat ze verkopen. Opnieuw bouwen is hier sneller
en levert iets op dat de klant jaren vooruit kan.

**Wat we wel meenemen:** de 94 producten met hun teksten, prijzen, categorieen
en afbeeldingen. Dat is het bedrijf. De rest laten we achter.

---

## De richting die vastligt

Dit zijn keuzes die we samen hebben gemaakt. Ze staan, tenzij we een goede
reden vinden om erop terug te komen.

**Eigen shop, geen WordPress.** De nieuwe site staat volledig op zichzelf.
WordPress verdwijnt zodra de overstap rond is.

**De Neon-database wordt de bron van waarheid.** Die is nu nog leeg en vullen
we zelf met het assortiment.

**Eigen checkout met Mollie.** De klant rekent af op onze eigen site, met iDEAL
en de andere methodes die Nederlandse kopers verwachten. Geen doorverwijzing
naar een andere omgeving halverwege het bestelproces.

**Eigen beheeromgeving.** De klant moet zelf producten, prijzen, voorraad en
bestellingen kunnen beheren, zonder ons en zonder WordPress.

**Gehost op Vercel.**

**De opzet van bol.com als voorbeeld, niet het uiterlijk.** We nemen over wat
bol.com goed doet: snel kunnen scannen, filters bij de hand, veel bruikbare
informatie per product, een koopblok dat meeloopt. Maar met een eigen,
rustiger uitstraling en eigen kleuren.

---

## Designrichting

We werken met de `design-taste-frontend` skill die in dit project geinstalleerd
staat, onder `.agents/skills/`. Die bevat de regels waaraan het ontwerp moet
voldoen. Lees hem voordat je aan de UI begint.

**Het gevoel:** rustig, betrouwbaar, verzorgd. Een winkel waar je zonder
nadenken je pinpas trekt. Geen showpagina, geen felle kleuren, geen animaties
die aandacht vragen.

**Kleur:** bosgroen als enige accentkleur, op een warme grijze basis. Groen
leest als "op voorraad, veilig, ga door" en werkt goed op koopknoppen. Een
accentkleur, overal consequent doorgevoerd.

**Typografie:** Geist. Nuchter, goed leesbaar, en het ligt qua karakter dicht
bij wat bol.com gebruikt zonder dat we een gelicentieerd font nodig hebben.

**Dichtheid:** vol zoals bol.com, maar rustiger gestyled. Veel producten per
scherm en veel informatie per kaart, alleen zonder de banners en promoblokken
die het daar druk maken.

**Alleen een lichte modus.** Geen donkere variant.

**Harde regels uit de skill:** geen em-dash of en-dash in zichtbare tekst, geen
emoji, maximaal een accentkleur, een vaste hoekafronding door de hele site, en
elke knop en elk formulierveld haalt het contrastniveau WCAG AA. Alle
toestanden uitwerken, dus ook laden, leeg en fout, niet alleen het geval waarin
alles goed gaat.

---

## De fases

Elke fase is beschreven als een doel met een duidelijk eindpunt. Hoe je er komt,
bepaal je zelf op dat moment.

### Fase 1, fundament

Een werkende basis waar de rest op kan landen: het project draait, er is een
verbinding met de database, er is een datamodel dat past bij wat HH Shops
verkoopt, en de designtokens liggen vast zodat niemand later losse kleurcodes
gaat strooien.

Het datamodel moet in elk geval om kunnen gaan met producten die varianten
hebben, zoals maten. Dat is precies wat er nu misgaat.

**Klaar wanneer:** het project start, de database heeft een schema, en een
testproduct kan erin en er weer uit.

Deze fase is uitgewerkt in [docs/fase-1-fundament.md](docs/fase-1-fundament.md).

### Fase 2, het assortiment overzetten

De 94 producten verhuizen van de oude site naar de nieuwe database. De oude
WooCommerce-installatie heeft een open koppeling waar we alles uit kunnen
ophalen, dus dit hoeft niet met de hand.

Onderweg ruimen we op wat er mis is: de maatvarianten samenvoegen tot echte
producten met maten, artikelnummers toekennen, teksten opschonen, en alle
afbeeldingen naar een fatsoenlijk formaat en een fatsoenlijke omvang brengen.
Alt-teksten horen erbij, niet als optioneel veld maar als onderdeel van elke
afbeelding.

Maak dit herhaalbaar. Je gaat het meer dan een keer draaien.

**Klaar wanneer:** alle producten staan in de nieuwe database, kloppen, en de
54 zware PNG's zijn terug van 22 MB naar een fractie daarvan.

### Fase 3, de winkel

Het deel dat klanten zien: startpagina, categorieen, zoeken, filteren en
productpagina's.

Waar het om draait: iemand die iets zoekt moet het snel vinden, en op de
productpagina moet alles staan wat nodig is om te durven kopen. Prijs,
voorraad, wanneer het in huis is, waarom je dit product wil.

Uitverkochte producten verdienen aandacht. Een derde van het assortiment is
op dit moment niet leverbaar. Ze mogen niet doen alsof ze gewoon te koop zijn,
maar ze moeten ook niet zomaar verdwijnen.

**Klaar wanneer:** je kunt vanaf de startpagina een product vinden, bekijken en
in je winkelwagen leggen, op telefoon en op desktop.

### Fase 4, afrekenen

Winkelwagen, bestelproces en betaling via Mollie.

Dit is het deel waar geld omgaat, dus hier is saai en voorspelbaar beter dan
mooi. Controleer aan de serverkant altijd opnieuw wat iets kost en of het er
nog is. Ga er nooit van uit dat wat de browser meestuurt klopt.

Een betaling die mislukt of halverwege afbreekt moet net zo netjes aflopen als
een betaling die slaagt. Test dat, niet alleen het geval waarin alles goed gaat.

Hier horen ook de verplichte pagina's bij die een Nederlandse webshop moet
hebben: algemene voorwaarden, privacyverklaring, retourbeleid met het wettelijke
herroepingsrecht, verzendinformatie en contactgegevens met KvK- en btw-nummer.

**Klaar wanneer:** een testbestelling gaat er van begin tot eind doorheen, de
bestelling staat in de database, en klant en eigenaar krijgen bericht.

### Fase 5, beheer

Een afgeschermd deel waar de klant zelf producten toevoegt en aanpast, prijzen
en voorraad bijwerkt, afbeeldingen vervangt en bestellingen bekijkt.

Bedenk dat de klant geen techneut is. Het moet duidelijk zijn zonder handleiding.

**Klaar wanneer:** iemand kan zonder onze hulp inloggen, een product toevoegen
met foto en alt-tekst, en een bestelling afhandelen.

### Fase 6, veilig en vindbaar de lucht in

Beveiliging op orde, vindbaarheid op orde, en dan pas overzetten.

Bij beveiliging gaat het om de gebruikelijke dingen goed doen: geen geheimen
die in de browser terechtkomen, formulieren die niet misbruikt kunnen worden,
inlogpogingen die begrensd zijn, en gebruikersinvoer die nergens ongefilterd
doorheen glipt.

Bij vindbaarheid is het grootste risico dat de oude site rankings heeft die we
kwijtraken. Elke oude productlink en categorielink moet netjes doorverwijzen
naar de nieuwe plek. Dat is de belangrijkste taak van deze fase.

Eerst live op een testadres, alles nalopen, en pas daarna het domein omzetten.

**Klaar wanneer:** de site is doorgemeten op snelheid, toegankelijkheid en
beveiliging, de oude links verwijzen door, en de klant heeft groen licht gegeven.

---

## Wat bewust open blijft

Deze dingen bepalen we later, als we er zicht op hebben. Kom er gerust op terug
met een beter idee.

- Hoe het datamodel er precies uitziet
- Hoe we zoeken en filteren aanpakken, en hoe slim dat moet zijn
- Waar en hoe we afbeeldingen opslaan en verkleinen
- Hoe inloggen voor de beheeromgeving werkt
- Welke pakketten we gebruiken en welke we links laten liggen
- Hoe we de site opdelen in onderdelen
- Of er een startpagina met uitgelichte producten komt, of iets anders
- Of reviews later een plek krijgen, en zo ja hoe

Als een keuze hierboven strijdig blijkt met iets uit "de richting die vastligt",
zeg dat dan hardop in plaats van er stilletjes omheen te werken.

---

## Open vragen voor de klant

Deze kunnen wij niet beslissen.

1. **Wat gebeurt er met de uitverkochte producten?** Een derde van het
   assortiment is niet leverbaar. Komt er nieuwe voorraad, gaan ze eruit, of
   blijven ze staan als tijdelijk uitverkocht?
2. **Komen er echte productfoto's?** De huidige zijn deels met AI gemaakt. Aan
   de bestandsnamen te zien komen ze uit Copilot en ChatGPT. Echte foto's maken
   een groot verschil voor het vertrouwen.
3. **Klopt de bedrijfsinformatie nog?** KvK-nummer, btw-nummer, adres,
   retouradres en verzendtarieven hebben we nodig voor de verplichte pagina's.
4. **Blijft het bij deze 94 producten?** Dat bepaalt hoeveel aandacht zoeken en
   filteren nodig hebben.
5. **Wat gebeurt er met bestaande klantgegevens en oude bestellingen?** Moeten
   die mee, of beginnen we schoon?

---

## Praktisch

**Ontwikkelserver starten:**

```
npx astro dev --background
```

Beheren met `astro dev status`, `astro dev logs` en `astro dev stop`.
Zie ook `CLAUDE.md` in de repo.

**Database:** Neon PostgreSQL. De verbindingsgegevens horen in een `.env` die
niet in git komt.

> **Belangrijk:** het huidige databasewachtwoord is via de chat gedeeld en moet
> gerouleerd worden voordat de shop live gaat.

**Waar het assortiment vandaan komt:** de oude site heeft een open koppeling
onder `/wp-json/wc/store/v1/` waar producten en categorieen uit op te halen zijn.
Geen inloggegevens nodig.

Op 9 september 2026 is daar een volledige kopie van gemaakt in
[`data/wc-snapshot/`](data/wc-snapshot/README.md): 94 producten, 9 categorieen
en alle 227 afbeeldingen. Fase 2 werkt vanaf die kopie, niet vanaf de live site.
Als de klant morgen iets aanpast of de site uitzet, verliezen we niets.

**Ontwerpregels:** `.agents/skills/design-taste-frontend/SKILL.md`. Lees hem
voordat je aan de UI begint. Er staat ook een audit-aanpak in voor redesigns.

---

## Hoe we hiermee werken

Pak een fase, bepaal op dat moment hoe je hem invult, en overleg als je twijfelt
tussen twee richtingen. Dit document is de kaart, niet de route.

Loop je tegen iets aan dat hierboven verkeerd of achterhaald blijkt, werk het
dan bij. Een plan dat niet meer klopt is erger dan geen plan.
