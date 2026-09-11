CREATE TYPE "public"."order_status" AS ENUM('awaiting_payment', 'paid', 'cancelled', 'shipped');--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_events_kind_shape" CHECK ("order_events"."kind" ~ '^[a-z_]{3,40}$')
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"product_id" integer,
	"variant_id" integer,
	"sku" text NOT NULL,
	"product_name" text NOT NULL,
	"product_slug" text,
	"option_text" text,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"vat_rate" smallint NOT NULL,
	"line_total_cents" integer NOT NULL,
	"image_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_items_quantity_range" CHECK ("order_items"."quantity" BETWEEN 1 AND 10),
	CONSTRAINT "order_items_price_nonneg" CHECK ("order_items"."unit_price_cents" >= 0),
	CONSTRAINT "order_items_line_total" CHECK ("order_items"."line_total_cents" = "order_items"."unit_price_cents" * "order_items"."quantity"),
	CONSTRAINT "order_items_vat_rate" CHECK ("order_items"."vat_rate" IN (0, 9, 21)),
	CONSTRAINT "order_items_sku_shape" CHECK (length("order_items"."sku") BETWEEN 3 AND 32),
	CONSTRAINT "order_items_name_shape" CHECK (length("order_items"."product_name") BETWEEN 3 AND 120)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"token" text NOT NULL,
	"status" "order_status" DEFAULT 'awaiting_payment' NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"street" text NOT NULL,
	"house_number" text NOT NULL,
	"house_number_addition" text,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"country" text DEFAULT 'NL' NOT NULL,
	"customer_note" text,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"vat_cents" integer NOT NULL,
	"mollie_payment_id" text,
	"payment_method" text,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"confirmation_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_token_unique" UNIQUE("token"),
	CONSTRAINT "orders_mollie_payment_id_unique" UNIQUE("mollie_payment_id"),
	CONSTRAINT "orders_number_format" CHECK ("orders"."number" ~ '^HH-[0-9]{6,}$'),
	CONSTRAINT "orders_token_shape" CHECK (length("orders"."token") BETWEEN 32 AND 64),
	CONSTRAINT "orders_email_shape" CHECK ("orders"."email" = lower(btrim("orders"."email")) AND length("orders"."email") BETWEEN 5 AND 254 AND position('@' in "orders"."email") > 1),
	CONSTRAINT "orders_name_shape" CHECK (btrim("orders"."name") = "orders"."name" AND length("orders"."name") BETWEEN 2 AND 100),
	CONSTRAINT "orders_street_shape" CHECK (btrim("orders"."street") = "orders"."street" AND length("orders"."street") BETWEEN 2 AND 100),
	CONSTRAINT "orders_house_number_shape" CHECK ("orders"."house_number" ~ '^[1-9][0-9]{0,5}$'),
	CONSTRAINT "orders_postal_code_format" CHECK ("orders"."postal_code" ~ '^[1-9][0-9]{3} [A-Z]{2}$'),
	CONSTRAINT "orders_city_shape" CHECK (btrim("orders"."city") = "orders"."city" AND length("orders"."city") BETWEEN 2 AND 100),
	CONSTRAINT "orders_country" CHECK ("orders"."country" = 'NL'),
	CONSTRAINT "orders_phone_shape" CHECK ("orders"."phone" IS NULL OR length("orders"."phone") BETWEEN 6 AND 20),
	CONSTRAINT "orders_note_length" CHECK ("orders"."customer_note" IS NULL OR length("orders"."customer_note") BETWEEN 1 AND 500),
	CONSTRAINT "orders_amounts_nonneg" CHECK ("orders"."subtotal_cents" >= 0 AND "orders"."shipping_cents" >= 0 AND "orders"."vat_cents" >= 0),
	CONSTRAINT "orders_total_adds_up" CHECK ("orders"."total_cents" = "orders"."subtotal_cents" + "orders"."shipping_cents"),
	CONSTRAINT "orders_vat_within_total" CHECK ("orders"."vat_cents" <= "orders"."total_cents"),
	CONSTRAINT "orders_paid_at_matches" CHECK (("orders"."status" IN ('paid', 'shipped')) = ("orders"."paid_at" IS NOT NULL)),
	CONSTRAINT "orders_cancelled_at_matches" CHECK (("orders"."status" = 'cancelled') = ("orders"."cancelled_at" IS NOT NULL)),
	CONSTRAINT "orders_shipped_at_matches" CHECK (("orders"."status" = 'shipped') = ("orders"."shipped_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id","position");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at" DESC NULLS LAST);