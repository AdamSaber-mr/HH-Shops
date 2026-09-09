-- Triggers die updated_at bijhouden, en een extra waarborg op varianten.

CREATE OR REPLACE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER product_variants_set_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER product_images_set_updated_at
  BEFORE UPDATE ON product_images
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint

-- UNIQUE (product_id, options) vangt {"Maat":"M"} tegen {"Maat":"M"}, want jsonb
-- normaliseert sleutelvolgorde. Maar niet tegen {"Maat":"m"}: jsonb normaliseert
-- geen hoofdletters. Zonder deze index is "je kunt niet per ongeluk twee keer
-- maat M aanmaken" alleen waar als degene die schrijft oplet, en dat is precies
-- de aanname die dit datamodel weigert te maken.
--
-- Mag in een index omdat de tekstweergave van jsonb canoniek is en jsonb_out
-- als IMMUTABLE gemarkeerd staat.
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_options_ci_key
  ON product_variants (product_id, lower(options::text));
