CREATE TABLE "product_slug_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_slug_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slug_history_slug_unique" UNIQUE("slug"),
	CONSTRAINT "product_slug_history_slug_format" CHECK ("product_slug_history"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("product_slug_history"."slug") BETWEEN 2 AND 120)
);
--> statement-breakpoint
ALTER TABLE "product_images" DROP CONSTRAINT "product_images_alt_not_filename";--> statement-breakpoint
ALTER TABLE "product_slug_history" ADD CONSTRAINT "product_slug_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_slug_history_product_idx" ON "product_slug_history" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_alt_not_filename" CHECK ("product_images"."alt" !~ '^[0-9]+$'
			    AND "product_images"."alt" !~* '^(img|image|afbeelding|foto|photo|dsc|copilot|chatgpt|post-hh-shops|thumbnail|[0-9]+x[0-9]+)[ _.-]*[0-9 _.-]*(\.(jpe?g|png|webp))?$'
			    AND "product_images"."alt" !~* '\.(jpe?g|png|webp)$'
			    AND position('|' in "product_images"."alt") = 0);