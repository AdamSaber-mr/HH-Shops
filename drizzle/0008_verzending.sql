ALTER TABLE "orders" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipment_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_carrier_known" CHECK ("orders"."carrier" IS NULL OR "orders"."carrier" IN ('postnl', 'dhl', 'dpd', 'gls', 'ups', 'anders'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tracking_code_shape" CHECK ("orders"."tracking_code" IS NULL OR "orders"."tracking_code" ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,39}$');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tracking_code_needs_carrier" CHECK ("orders"."tracking_code" IS NULL OR "orders"."carrier" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tracking_url_shape" CHECK ("orders"."tracking_url" IS NULL OR ("orders"."tracking_url" ~ '^https://' AND length("orders"."tracking_url") BETWEEN 12 AND 500));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_own_url_only_for_other_carrier" CHECK (("orders"."carrier" IS NOT DISTINCT FROM 'anders') = ("orders"."tracking_url" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_needs_shipped" CHECK ("orders"."status" = 'shipped' OR ("orders"."carrier" IS NULL AND "orders"."shipment_sent_at" IS NULL));