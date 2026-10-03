-- El POS vuelve a estar disponible en el panel del comercio y en la caja.
ALTER TABLE "Store" ALTER COLUMN "posEnabled" SET DEFAULT true;
UPDATE "Store" SET "posEnabled" = true WHERE "posEnabled" = false;
