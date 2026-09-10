import { eq } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { productVariants } from '../../db/schema.ts';

/*
 * Schrijven aan varianten. Elke functie neemt de database als argument zodat
 * hij ook vanuit scripts en tests te gebruiken is.
 */

export async function snelBijwerken(
	db: Database,
	variantId: number,
	wijziging: { priceCents: number; stockQuantity: number },
): Promise<{ productId: number; sku: string } | null> {
	const [rij] = await db
		.update(productVariants)
		.set({ priceCents: wijziging.priceCents, stockQuantity: wijziging.stockQuantity })
		.where(eq(productVariants.id, variantId))
		.returning({ productId: productVariants.productId, sku: productVariants.sku });
	return rij ?? null;
}
