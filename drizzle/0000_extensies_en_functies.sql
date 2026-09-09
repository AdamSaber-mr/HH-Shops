-- Extensies en hulpfuncties.
--
-- Deze migratie staat bewust voor het schema: de trigram-index op
-- products.name in migratie 0001 kan niet bestaan zonder pg_trgm.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint

-- unaccent() is als STABLE gemarkeerd, niet als IMMUTABLE, en mag daardoor niet
-- in een index-expressie staan. Zonder deze wrapper loopt het zoeken in fase 3
-- vast op "functions in index expression must be marked IMMUTABLE", en dan moet
-- er alsnog een migratie bij. Nu meenemen kost een paar regels.
--
-- Zoeken op "creeren" moet ook "creëren" vinden, en Nederlandse productteksten
-- staan vol met dat soort tekens.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
--> statement-breakpoint

-- Drizzle's $onUpdate werkt alleen als de wijziging via Drizzle loopt.
-- Handmatige SQL en de beheeromgeving in fase 5 omzeilen dat. Een trigger niet.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
