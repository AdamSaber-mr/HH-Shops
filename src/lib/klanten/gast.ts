import { leesFavorietenCookie, leesWinkelmandCookie, wisGastCookies } from './cookies.ts';
import { accountFavorieten, bestaandeProducten, schrijfAccountFavorieten } from './favorieten.ts';
import { voegFavorietenSamen, voegWinkelmandenSamen } from './samenvoegen.ts';
import {
	accountWinkelmand,
	bestaandeVarianten,
	type Ctx,
	schrijfWinkelmand,
} from './winkelmand.ts';

/*
 * Na inloggen of registreren: wat de gast in zijn cookies had, gaat het
 * account in. Daarna zijn de cookies weg; vanaf nu is de database de bron.
 */
export async function neemGastMee(ctx: Ctx): Promise<void> {
	const user = ctx.locals.user;
	if (!user) return;

	const gastMand = leesWinkelmandCookie(ctx.cookies);
	const gastFavorieten = leesFavorietenCookie(ctx.cookies);
	if (gastMand.size === 0 && gastFavorieten.length === 0) return;

	if (gastMand.size > 0) {
		const bestaand = await bestaandeVarianten([...gastMand.keys()]);
		const geldig = new Map([...gastMand].filter(([id]) => bestaand.has(id)));
		const samen = voegWinkelmandenSamen(await accountWinkelmand(user.id), geldig);
		await schrijfWinkelmand(ctx, samen);
	}

	if (gastFavorieten.length > 0) {
		const bestaand = await bestaandeProducten(gastFavorieten);
		const geldig = gastFavorieten.filter((id) => bestaand.has(id));
		const account = await accountFavorieten(user.id);
		const samen = voegFavorietenSamen(account, geldig);
		await schrijfAccountFavorieten(
			user.id,
			samen.filter((id) => !account.includes(id)),
		);
	}

	wisGastCookies(ctx.cookies);
}
