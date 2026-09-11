// @ts-check
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import icon from 'astro-icon';

/*
 * De .env ook in process.env, voor `astro dev`. Vite zet niet-geprefixte
 * variabelen alleen in import.meta.env, maar de Blob-SDK leest process.env.
 * Op Vercel staan ze daar al; in CI is er geen .env en gebeurt er niets.
 */
try {
	process.loadEnvFile('.env');
} catch {
	// Geen .env, bijvoorbeeld in CI of op Vercel.
}

// Alleen bij `astro build`: in de dev-server laat Vite CommonJS-pakketten
// beter extern, daar werkt require van ESM gewoon (Node 24).
const isBuild = process.argv.includes('build');

// https://astro.build/config
export default defineConfig({
	// `site` staat er bewust nog niet. Zolang hh-shops.nl naar WordPress wijst,
	// zouden canonieke URL's naar de oude site verwijzen. Dit wordt in fase 6
	// gezet, tegelijk met de domeinomzetting.

	// Vrijwel elke pagina is dynamisch: voorraad, prijzen, winkelwagen.
	// Pagina's die wel statisch mogen, zetten zelf `export const prerender = true`.
	output: 'server',

	adapter: vercel({
		// Vercel doet de afbeeldingsoptimalisatie, niet onze eigen functie.
		imageService: true,

		// LET OP: zodra `imagesConfig` gezet is, negeert de adapter
		// `image.domains` en `image.remotePatterns` uit de Astro-config.
		// Die horen dus hierbinnen.
		imagesConfig: {
			// Elke gevraagde breedte wordt afgerond naar de dichtstbijzijnde
			// waarde in deze lijst. De standaardlijst begint bij 640, waardoor
			// een thumbnail van 240px een bestand van 640px zou krijgen. Op een
			// project waarvan het hoofdprobleem 22 MB aan afbeeldingen is, is dat
			// het verkeerde vertrekpunt.
			sizes: [64, 128, 240, 320, 480, 640, 828, 1080, 1200, 1920],
			formats: ['image/webp'],
			minimumCacheTTL: 60 * 60 * 24 * 30,
			domains: [],
			// Product- en categoriefoto's staan in Vercel Blob. Zonder deze patronen
			// weigert de beeldoptimalisatie ze, want ze komen van een ander domein.
			remotePatterns: [
				{
					protocol: 'https',
					hostname: '**.public.blob.vercel-storage.com',
					pathname: '/producten/**',
				},
				{
					protocol: 'https',
					hostname: '**.public.blob.vercel-storage.com',
					pathname: '/categorieen/**',
				},
			],
		},
	}),

	// LET OP: dit staat er NAAST de `imagesConfig` van de adapter, en dat is
	// geen duplicatie. `imagesConfig` vertelt Vercel wat het mag optimaliseren;
	// dit vertelt Astro zelf welke externe hosts het vertrouwt. Zonder dit blok
	// antwoordt het beeld-endpoint met 403 en laadt er geen enkele productfoto.
	image: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '**.public.blob.vercel-storage.com',
				pathname: '/producten/**',
			},
			{
				protocol: 'https',
				hostname: '**.public.blob.vercel-storage.com',
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
				],
			},
		}),
	],

	// Foto-uploads in het beheerpaneel gaan als een action-body. Standaard is 1 MB;
	// Vercel accepteert 4,5 MB per aanvraag, dus 4 MB laat ruimte voor de rest.
	security: {
		actionBodySizeLimit: 4 * 1024 * 1024,
	},

	vite: {
		plugins: [tailwindcss()],
		ssr: {
			// sanitize-html is CommonJS en laadt htmlparser2, dat alleen nog als ESM
			// bestaat. Node 24 kan dat lokaal (require van ESM), de Node-runtime van
			// Vercel niet: daar gaf het een 500 op elke action. Meebundelen in de
			// serverbundel haalt dat require tijdens het draaien weg.
			// De hele boom, anders blijft er een require van een van de
			// afhankelijkheden over die Vercel niet meeneemt in de functie.
			noExternal: isBuild
				? [
						'dayjs',
						'deepmerge',
						'dom-serializer',
						'domelementtype',
						'domhandler',
						'domutils',
						'entities',
						'escape-string-regexp',
						'htmlparser2',
						'is-plain-object',
						'launder',
						'nanoid',
						'parse-srcset',
						'picocolors',
						'postcss',
						'sanitize-html',
						'source-map-js',
					]
				: [],
		},
	},

	env: {
		schema: {
			// `access: 'secret'` garandeert dat deze waarde nooit in een
			// browserbundel terechtkomt.
			DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
			// Ondertekent de sessiecookies van het beheerpaneel. Zie .env.example.
			BETTER_AUTH_SECRET: envField.string({ context: 'server', access: 'secret' }),
			// Mail via Resend. Zonder sleutel worden mails gelogd in plaats van
			// verstuurd (zie src/lib/mail/server.ts). Alle drie optioneel.
			RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
			MAIL_FROM: envField.string({ context: 'server', access: 'secret', optional: true }),
			MAIL_MODUS: envField.string({ context: 'server', access: 'secret', optional: true }),
		},
		// `validateSecrets` blijft bewust op de standaard `false`. Geheimen
		// worden dan pas gecontroleerd wanneer ze echt gelezen worden, en niet
		// tijdens de build. Daarom kan CI bouwen zonder databasegegevens.
		// Zet dit niet op `true`.
	},
});
