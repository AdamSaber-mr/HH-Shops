CREATE TYPE "public"."legacy_source_kind" AS ENUM('product', 'variation', 'category');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"image_alt" text,
	"parent_id" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_slug_format" CHECK ("categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("categories"."slug") BETWEEN 2 AND 80),
	CONSTRAINT "categories_name_shape" CHECK (btrim("categories"."name") = "categories"."name" AND length("categories"."name") BETWEEN 2 AND 80),
	CONSTRAINT "categories_name_clean" CHECK ("categories"."name" !~ ('&(#[0-9]+|[a-zA-Z]+)' || chr(59))
	    AND position(chr(8211) in "categories"."name") = 0
	    AND position(chr(8212) in "categories"."name") = 0),
	CONSTRAINT "categories_description_not_blank" CHECK ("categories"."description" IS NULL OR btrim("categories"."description") <> ''),
	CONSTRAINT "categories_image_pair" CHECK (("categories"."image_url" IS NULL) = ("categories"."image_alt" IS NULL)),
	CONSTRAINT "categories_image_alt_quality" CHECK ("categories"."image_alt" IS NULL OR (
			      btrim("categories"."image_alt") = "categories"."image_alt"
			      AND length("categories"."image_alt") BETWEEN 5 AND 250)),
	CONSTRAINT "categories_no_self_parent" CHECK ("categories"."parent_id" IS NULL OR "categories"."parent_id" <> "categories"."id"),
	CONSTRAINT "categories_position_nonneg" CHECK ("categories"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "legacy_urls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legacy_urls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"path" text NOT NULL,
	"source_kind" "legacy_source_kind" NOT NULL,
	"source_id" integer NOT NULL,
	"product_id" integer,
	"variant_id" integer,
	"category_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legacy_urls_path_unique" UNIQUE("path"),
	CONSTRAINT "legacy_urls_source_key" UNIQUE("source_kind","source_id"),
	CONSTRAINT "legacy_urls_path_shape" CHECK ("legacy_urls"."path" ~ '^/[a-z0-9/-]+$' AND length("legacy_urls"."path") BETWEEN 2 AND 300),
	CONSTRAINT "legacy_urls_single_target" CHECK ((CASE WHEN "legacy_urls"."product_id" IS NULL THEN 0 ELSE 1 END)
			  + (CASE WHEN "legacy_urls"."category_id" IS NULL THEN 0 ELSE 1 END) = 1),
	CONSTRAINT "legacy_urls_variant_needs_product" CHECK ("legacy_urls"."variant_id" IS NULL OR "legacy_urls"."product_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"product_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_product_id_category_id_pk" PRIMARY KEY("product_id","category_id"),
	CONSTRAINT "product_categories_position_nonneg" CHECK ("product_categories"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_product_url_key" UNIQUE("product_id","url"),
	CONSTRAINT "product_images_url_shape" CHECK ("product_images"."url" ~ '^(https://|/)'
			    AND "product_images"."url" NOT LIKE '%/wp-content/%'
			    AND "product_images"."url" NOT LIKE '%instawp.co%'
			    AND length("product_images"."url") BETWEEN 5 AND 500),
	CONSTRAINT "product_images_alt_trimmed" CHECK ("product_images"."alt" = btrim("product_images"."alt")),
	CONSTRAINT "product_images_alt_length" CHECK (length("product_images"."alt") BETWEEN 5 AND 250),
	CONSTRAINT "product_images_alt_not_filename" CHECK ("product_images"."alt" !~ '^[0-9]+$'
			    AND "product_images"."alt" !~* '^(img|image|afbeelding|foto|photo|dsc|copilot|chatgpt|post-hh-shops|[0-9]+x[0-9]+)[ _.-]*[0-9]*(.(jpe?g|png|webp))?$'),
	CONSTRAINT "product_images_dimensions" CHECK ("product_images"."width" BETWEEN 1 AND 10000 AND "product_images"."height" BETWEEN 1 AND 10000),
	CONSTRAINT "product_images_position_nonneg" CHECK ("product_images"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"sku" text NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_cents" integer NOT NULL,
	"compare_at_price_cents" integer,
	"vat_rate" smallint DEFAULT 21 NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku"),
	CONSTRAINT "product_variants_product_options_key" UNIQUE("product_id","options"),
	CONSTRAINT "product_variants_product_id_id_key" UNIQUE("product_id","id"),
	CONSTRAINT "product_variants_sku_format" CHECK ("product_variants"."sku" ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND length("product_variants"."sku") BETWEEN 3 AND 32),
	CONSTRAINT "product_variants_price_range" CHECK ("product_variants"."price_cents" BETWEEN 0 AND 10000000),
	CONSTRAINT "product_variants_compare_price_higher" CHECK ("product_variants"."compare_at_price_cents" IS NULL OR "product_variants"."compare_at_price_cents" > "product_variants"."price_cents"),
	CONSTRAINT "product_variants_vat_rate" CHECK ("product_variants"."vat_rate" IN (0, 9, 21)),
	CONSTRAINT "product_variants_stock_range" CHECK ("product_variants"."stock_quantity" BETWEEN 0 AND 1000000),
	CONSTRAINT "product_variants_position_nonneg" CHECK ("product_variants"."position" >= 0),
	CONSTRAINT "product_variants_options_is_object" CHECK (jsonb_typeof("product_variants"."options") = 'object'),
	CONSTRAINT "product_variants_options_values" CHECK (NOT jsonb_path_exists("product_variants"."options", '$.* ? (@.type() != "string" || @ == "")'::jsonpath)),
	CONSTRAINT "product_variants_options_no_empty_key" CHECK (NOT jsonb_exists("product_variants"."options", ''))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text NOT NULL,
	"brand" text,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"option_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_slug_format" CHECK ("products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("products"."slug") BETWEEN 2 AND 120),
	CONSTRAINT "products_name_shape" CHECK (btrim("products"."name") = "products"."name" AND length("products"."name") BETWEEN 3 AND 120),
	CONSTRAINT "products_name_clean" CHECK ("products"."name" !~ ('&(#[0-9]+|[a-zA-Z]+)' || chr(59))
	    AND position(chr(8211) in "products"."name") = 0
	    AND position(chr(8212) in "products"."name") = 0),
	CONSTRAINT "products_description_not_blank" CHECK (length(btrim("products"."description")) >= 20),
	CONSTRAINT "products_description_no_script" CHECK ("products"."description" !~* '<script' AND "products"."description" !~* 'javascript:'),
	CONSTRAINT "products_short_description_shape" CHECK ("products"."short_description" IS NULL OR (
			      btrim("products"."short_description") = "products"."short_description"
			      AND length("products"."short_description") BETWEEN 10 AND 600)),
	CONSTRAINT "products_brand_not_blank" CHECK ("products"."brand" IS NULL OR btrim("products"."brand") = "products"."brand" AND "products"."brand" <> ''),
	CONSTRAINT "products_seo_title_length" CHECK ("products"."seo_title" IS NULL OR length(btrim("products"."seo_title")) BETWEEN 1 AND 120),
	CONSTRAINT "products_seo_description_length" CHECK ("products"."seo_description" IS NULL OR length(btrim("products"."seo_description")) BETWEEN 1 AND 320),
	CONSTRAINT "products_option_names_shape" CHECK (cardinality("products"."option_names") <= 3
			    AND array_position("products"."option_names", NULL) IS NULL
			    AND NOT ('' = ANY("products"."option_names")))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_urls" ADD CONSTRAINT "legacy_urls_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_urls" ADD CONSTRAINT "legacy_urls_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_urls" ADD CONSTRAINT "legacy_urls_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_fk" FOREIGN KEY ("product_id","variant_id") REFERENCES "public"."product_variants"("product_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_parent_position_idx" ON "categories" USING btree ("parent_id","position");--> statement-breakpoint
CREATE INDEX "legacy_urls_product_idx" ON "legacy_urls" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "legacy_urls_category_idx" ON "legacy_urls" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_categories_category_idx" ON "product_categories" USING btree ("category_id","position");--> statement-breakpoint
CREATE INDEX "product_images_product_position_idx" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "product_images_variant_idx" ON "product_images" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_position_idx" ON "product_variants" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "product_variants_options_idx" ON "product_variants" USING gin ("options" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops);