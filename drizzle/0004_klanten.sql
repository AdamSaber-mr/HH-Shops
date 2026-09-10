CREATE TABLE "cart_items" (
	"user_id" text NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_user_id_variant_id_pk" PRIMARY KEY("user_id","variant_id"),
	CONSTRAINT "cart_items_quantity_range" CHECK ("cart_items"."quantity" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_addresses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"street" text NOT NULL,
	"house_number" text NOT NULL,
	"house_number_addition" text,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country" text DEFAULT 'NL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_addresses_user_key" UNIQUE("user_id"),
	CONSTRAINT "customer_addresses_name_shape" CHECK (btrim("customer_addresses"."name") = "customer_addresses"."name" AND length("customer_addresses"."name") BETWEEN 2 AND 100),
	CONSTRAINT "customer_addresses_street_shape" CHECK (btrim("customer_addresses"."street") = "customer_addresses"."street" AND length("customer_addresses"."street") BETWEEN 2 AND 100),
	CONSTRAINT "customer_addresses_house_number_shape" CHECK ("customer_addresses"."house_number" ~ '^[1-9][0-9]{0,5}$'),
	CONSTRAINT "customer_addresses_addition_shape" CHECK ("customer_addresses"."house_number_addition" IS NULL OR (btrim("customer_addresses"."house_number_addition") = "customer_addresses"."house_number_addition" AND length("customer_addresses"."house_number_addition") BETWEEN 1 AND 10)),
	CONSTRAINT "customer_addresses_postal_code_format" CHECK ("customer_addresses"."postal_code" ~ '^[1-9][0-9]{3} [A-Z]{2}$'),
	CONSTRAINT "customer_addresses_city_shape" CHECK (btrim("customer_addresses"."city") = "customer_addresses"."city" AND length("customer_addresses"."city") BETWEEN 2 AND 100),
	CONSTRAINT "customer_addresses_country" CHECK ("customer_addresses"."country" = 'NL')
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorites_user_created_idx" ON "favorites" USING btree ("user_id","created_at" DESC NULLS LAST);