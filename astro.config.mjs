// @ts-check
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import icon from 'astro-icon';

/*
 * Geheimen komen NIET meer uit .env. De Cloudflare-adapter draait `astro dev`
 * en `astro preview` op workerd, en die leest `.dev.vars`. In productie zet
 * `wrangler secret put` ze. De .env blijft alleen voor drizzle-kit en de losse
 * scripts in scripts/, die buiten de Worker om draaien.
 */

/*
 * `astro dev` draait op workerd en gebruikt daar de RUNTIME-beeldservice. De
 * Images-binding struikelt daar over een lokaal bestand: voor src/assets/logo.png
 * maakt hij een /_image-URL zonder formaatparameter, die endpoint antwoordt met
 * 400 "Unsupported format: null", en omdat Astro de HTML streamt breekt de
 * respons dan af midden in de kop. Je krijgt een halve pagina, status 200, en
 * niets in de logs.
 *
 * In de gebouwde Worker speelt dat niet (daar is de pagina compleet), dus dit
 * geldt alleen voor de dev-server. Vandaar deze schakelaar.
 */
const isDev = process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
	// `site` staat er bewust nog niet. Zolang hh-shops.nl naar WordPress wijst,
	// zouden canonieke URL's naar de oude site verwijzen. Dit wordt in fase 6
	// gezet, tegelijk met de domeinomzetting.

	// Vrijwel elke pagina is dynamisch: voorraad, prijzen, winkelwagen.
	// Pagina's die wel statisch mogen, zetten zelf `export const prerender = true`.
	output: 'server',

	adapter: cloudflare({
		// Cloudflare Images doet de optimalisatie, via de IMAGES-binding uit
		// wrangler.jsonc. Dit is ook de standaard van de adapter, maar hij staat
		// er expliciet omdat het de opvolger is van `imageService: true` van
		// Vercel en je anders niet ziet waar de optimalisatie gebeurt.
		//
		// `build: 'compile'` laat het bouwen van de paar statische pagina's aan
		// sharp over, op je eigen machine. Alleen wat op verzoek gerenderd wordt
		// gaat langs de binding.
		// In dev doet sharp het lokaal (zie isDev hierboven); daarbuiten verwerkt
		// de Images-binding op verzoek, en bouwt sharp de paar statische pagina's.
		imageService: isDev ? 'compile' : { build: 'compile', runtime: 'cloudflare-binding' },
	}),

	// Welke externe hosts Astro zelf vertrouwt voor <Image />. Product- en
	// categoriefoto's staan in R2 en komen dus van een ander domein; zonder deze
	// patronen antwoordt het beeld-endpoint met 403 en laadt er geen enkele
	// productfoto.
	//
	// De hosts hieronder staan voluit: een wildcard mag van Astro alleen vooraan,
	// en `**.r2.dev` zou elke R2-bucket ter wereld vertrouwen.
	//
	// TWEE hosts, tijdelijk. De eerste is die van R2_PUBLIC_URL, waar nieuwe
	// uploads heen gaan. De tweede is de oude Vercel Blob-store: de 252 foto's
	// die nu in de database staan wijzen daar nog naartoe, want die rijen komen
	// uit de tijd voor de overstap. Zonder die tweede host haalt Astro ze niet
	// door de beeldoptimalisatie en blokkeert de CSP ze in productie: een winkel
	// zonder foto's.
	//
	// Weg te halen zodra `npm run fotos:naar-r2` gedraaid heeft en geen enkele
	// rij meer naar blob.vercel-storage.com wijst. Datzelfde geldt voor
	// OUDE_FOTO_HOST in src/middleware.ts.
	image: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'pub-2c35c155fd4b4b259aa441ad1c79c2e9.r2.dev',
				pathname: '/producten/**',
			},
			{
				protocol: 'https',
				hostname: 'pub-2c35c155fd4b4b259aa441ad1c79c2e9.r2.dev',
				pathname: '/categorieen/**',
			},
			{
				protocol: 'https',
				hostname: 'qjzaxiyu1pfuckle.public.blob.vercel-storage.com',
				pathname: '/producten/**',
			},
			{
				protocol: 'https',
				hostname: 'qjzaxiyu1pfuckle.public.blob.vercel-storage.com',
				pathname: '/categorieen/**',
			},
		],
	},

	integrations: [
		// Zonder expliciete `include` detecteert astro-icon het pakket
		// @iconify-json/ph en zet het de HELE Phosphor-set (4,5 MB JSON) in de
		// serverbundel. Het fase 1-document beweert het tegenovergestelde.
		// Deze lijst is de icoonvoorraad van het project: nieuw icoon nodig,
		// dan zet je het hier erbij.
		icon({
			include: {
				ph: [
					'magnifying-glass',
					'shopping-cart-simple',
					'user',
					'list',
					'x',
					'check',
					'caret-right',
					'caret-left',
					'caret-down',
					'minus',
					'plus',
					'truck',
					'arrow-counter-clockwise',
					'lock-simple',
					'warning-circle',
					// Beheerpaneel
					'sign-out',
					'squares-four',
					'package',
					'tag',
					'users',
					'pencil-simple',
					'trash',
					'archive',
					'arrow-up',
					'arrow-down',
					'upload-simple',
					'funnel',
					'image',
					'heart',
					'heart-fill',
					'arrow-left',
					'star-fill',
					'quotes',
					'clock',
					'arrow-right',
					'envelope-simple',
					'map-pin',
					'receipt',
					// Klantenservice en de verplichte pagina's
					'question',
					'file-text',
					'shield-check',
				],
			},
		}),
	],

	security: {
		// Foto-uploads in het beheerpaneel gaan als een action-body. Standaard is
		// 1 MB. Workers accepteert er 100, dus de rem zit hier niet meer in het
		// platform maar in wat redelijk is voor een productfoto; MAX_BESTAND in
		// src/lib/admin/fotos.ts staat op dezelfde 4 MB.
		actionBodySizeLimit: 4 * 1024 * 1024,
		// De controle op de herkomst van formulieren (CSRF) doet src/middleware.ts
		// zelf, met dezelfde regels als Astro, maar met een uitzondering voor de
		// webhook van Mollie: die POST komt van Mollie, zonder Origin-header, en
		// zou hier anders altijd een 403 krijgen. Astro kent geen uitzonderingen.
		checkOrigin: false,
	},

	build: {
		// Stijlen altijd als los bestand, nooit inline: dan kan de
		// Content-Security-Policy (src/middleware.ts) zonder 'unsafe-inline'
		// voor scripts en blijft de cache van de browser zijn werk doen.
		inlineStylesheets: 'never',
	},

	vite: {
		plugins: [tailwindcss()],
		build: {
			// Kleine scripts niet inline in de HTML zetten, om dezelfde reden.
			assetsInlineLimit: 0,

			rollupOptions: {
				output: {
					/*
					 * drizzle-orm in EEN chunk houden.
					 *
					 * Binnen dat pakket zit een circulaire import: int.common.js doet
					 * `class PgIntColumnBaseBuilder extends PgColumnBuilder`, en die
					 * ouder komt uit common.js. Node loste dat vanzelf op, maar zodra
					 * rollup de twee over aparte chunks verdeelt kan de verkeerde
					 * eerst aan de beurt komen. Dan is de ouder `undefined` en start de
					 * Worker niet meer op: "Class extends value undefined is not a
					 * constructor or null". Dat merk je niet bij het bouwen, alleen bij
					 * het draaien, en dan doet geen enkele pagina het nog.
					 *
					 * In een chunk staat de volgorde vast en is er niets te verdelen.
					 */
					manualChunks(id) {
						if (id.includes('node_modules/drizzle-orm')) return 'drizzle-orm';
					},
				},
			},
		},
		// GEEN `ssr.noExternal` hier. Voor Vercel stond er een handmatige lijst
		// (sanitize-html en zijn hele boom, omdat de Node-runtime daar een require
		// van ESM niet aankon). Op Workers is die reden weg, maar hem vervangen
		// door `noExternal: true` is fout gebleken: dan bundelt Vite ook
		// drizzle-orm zelf, raakt een circulaire import daarbinnen verkeerd
		// geordend, en start de Worker niet meer op met
		// "Class extends value undefined" in pg-core/columns/int.common.js.
		// De Cloudflare-plugin bepaalt zelf wat de bundel in moet.
	},

	env: {
		schema: {
			// `access: 'secret'` garandeert dat deze waarde nooit in een
			// browserbundel terechtkomt.
			DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
			// "productie" op de echte winkel, iets anders lokaal en op previews.
			// wrangler.jsonc zet hem; .dev.vars overschrijft hem lokaal. Dit is de
			// opvolger van VERCEL_ENV.
			OMGEVING: envField.string({ context: 'server', access: 'secret', optional: true }),
			// De publieke basis waaronder R2 de foto's serveert, zonder slotslash.
			// Nu de r2.dev-URL van de bucket; bij de livegang een eigen domein.
			R2_PUBLIC_URL: envField.string({ context: 'server', access: 'secret' }),
			// Ondertekent de sessiecookies van het beheerpaneel. Zie .env.example.
			BETTER_AUTH_SECRET: envField.string({ context: 'server', access: 'secret' }),
			// Mail via Resend. Zonder sleutel worden mails gelogd in plaats van
			// verstuurd (zie src/lib/mail/server.ts). Alle drie optioneel.
			RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
			MAIL_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
			MAIL_MODUS: envField.string({ context: 'server', access: 'secret', optional: true }),
			// Mollie. Zonder sleutel buiten productie: de nagebootste betaling
			// (zie src/lib/bestellen/server.ts).
			MOLLIE_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
			MOLLIE_API_TEST_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
			MOLLIE_MODUS: envField.string({ context: 'server', access: 'secret', optional: true }),
			// Waar de eigenaar bericht krijgt van een bestelling; standaard info@hh-shops.nl.
			BESTELLING_MAIL_NAAR: envField.string({
				context: 'server',
				access: 'secret',
				optional: true,
			}),
			// De dagelijkse cron. Cloudflare roept `scheduled()` in src/worker.ts
			// aan, en die heeft geen geheim nodig: die aanroep komt niet van het
			// open internet. Dit geheim beveiligt alleen nog het handmatig
			// aanroepen van /api/cron/bestellingen-opschonen over HTTP. Zonder
			// geheim weigert die route elk verzoek.
			CRON_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
		},
		// `validateSecrets` blijft bewust op de standaard `false`. Geheimen
		// worden dan pas gecontroleerd wanneer ze echt gelezen worden, en niet
		// tijdens de build. Daarom kan CI bouwen zonder databasegegevens.
		// Zet dit niet op `true`.
	},
});
