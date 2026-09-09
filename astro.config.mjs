// @ts-check
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import icon from 'astro-icon';

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
		// Die horen dus hierbinnen. In fase 2 komt hier het Blob-domein bij.
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
			// Productfoto's staan in Vercel Blob. Zonder dit patroon weigert de
			// beeldoptimalisatie ze, want ze komen van een ander domein.
			remotePatterns: [
				{
					protocol: 'https',
					hostname: '**.public.blob.vercel-storage.com',
					pathname: '/producten/**',
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
					'caret-down',
					'star',
					'clock',
					'arrow-right',
					'sparkle',
					'star-half',
					'minus',
					'plus',
					'truck',
					'arrow-counter-clockwise',
					'lock-simple',
					'warning-circle',
				],
			},
		}),
	],

	vite: {
		plugins: [tailwindcss()],
	},

	env: {
		schema: {
			// `access: 'secret'` garandeert dat deze waarde nooit in een
			// browserbundel terechtkomt.
			DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
		},
		// `validateSecrets` blijft bewust op de standaard `false`. Geheimen
		// worden dan pas gecontroleerd wanneer ze echt gelezen worden, en niet
		// tijdens de build. Daarom kan CI bouwen zonder databasegegevens.
		// Zet dit niet op `true`.
	},
});
