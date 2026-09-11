CREATE TABLE "category_slug_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "category_slug_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"category_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_slug_history_slug_unique" UNIQUE("slug"),
	CONSTRAINT "category_slug_history_slug_format" CHECK ("category_slug_history"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("category_slug_history"."slug") BETWEEN 2 AND 80)
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_width" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_height" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "banner_alt" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "banner_width" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "banner_height" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "banner_title" text;--> statement-breakpoint
ALTER TABLE "category_slug_history" ADD CONSTRAINT "category_slug_history_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_slug_history_category_idx" ON "category_slug_history" USING btree ("category_id");--> statement-breakpoint
-- De foto's die de import heeft gezet (de oude categoriegrafieken van WooCommerce)
-- hebben geen afmetingen en worden door de storefront niet gebruikt. Ze gaan
-- leeg, zodat de controle hieronder kan; scripts/categorieen-overzetten.ts zet
-- daarna de echte kaartfoto's en banners neer, met afmetingen.
UPDATE "categories" SET "image_url" = NULL, "image_alt" = NULL WHERE "image_width" IS NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_dimensions" CHECK ((("categories"."image_url" IS NULL) = ("categories"."image_width" IS NULL))
			    AND (("categories"."image_url" IS NULL) = ("categories"."image_height" IS NULL))
			    AND ("categories"."image_width" IS NULL OR "categories"."image_width" BETWEEN 1 AND 10000)
			    AND ("categories"."image_height" IS NULL OR "categories"."image_height" BETWEEN 1 AND 10000));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_url_shape" CHECK ("categories"."image_url" IS NULL OR ("categories"."image_url" ~ '^https://'
			    AND "categories"."image_url" NOT LIKE '%/wp-content/%'
			    AND length("categories"."image_url") BETWEEN 5 AND 500));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_banner_pair" CHECK (("categories"."banner_url" IS NULL) = ("categories"."banner_alt" IS NULL));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_banner_alt_quality" CHECK ("categories"."banner_alt" IS NULL OR (
			      btrim("categories"."banner_alt") = "categories"."banner_alt"
			      AND length("categories"."banner_alt") BETWEEN 5 AND 250));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_banner_dimensions" CHECK ((("categories"."banner_url" IS NULL) = ("categories"."banner_width" IS NULL))
			    AND (("categories"."banner_url" IS NULL) = ("categories"."banner_height" IS NULL))
			    AND ("categories"."banner_width" IS NULL OR "categories"."banner_width" BETWEEN 1 AND 10000)
			    AND ("categories"."banner_height" IS NULL OR "categories"."banner_height" BETWEEN 1 AND 10000));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_banner_url_shape" CHECK ("categories"."banner_url" IS NULL OR ("categories"."banner_url" ~ '^https://'
			    AND "categories"."banner_url" NOT LIKE '%/wp-content/%'
			    AND length("categories"."banner_url") BETWEEN 5 AND 500));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_banner_title_shape" CHECK ("categories"."banner_title" IS NULL OR (btrim("categories"."banner_title") = "categories"."banner_title"
			    AND length("categories"."banner_title") BETWEEN 3 AND 120));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_banner_title_clean" CHECK ("categories"."banner_title" IS NULL OR ("categories"."banner_title" !~ ('&(#[0-9]+|[a-zA-Z]+)' || chr(59))
	    AND position(chr(8211) in "categories"."banner_title") = 0
	    AND position(chr(8212) in "categories"."banner_title") = 0));