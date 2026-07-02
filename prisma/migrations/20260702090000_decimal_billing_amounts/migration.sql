ALTER TABLE "Generation"
  ALTER COLUMN "priceCharged" TYPE DOUBLE PRECISION USING "priceCharged"::double precision;

ALTER TABLE "User"
  ALTER COLUMN "balance" TYPE DOUBLE PRECISION USING "balance"::double precision;
