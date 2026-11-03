-- El login de la PWA caja es por tienda (URL /[store]/login): el usuario ya
-- no es único global, sino por sede. Puede haber un "jose" en cada negocio.

-- DropIndex
DROP INDEX "PosUser_username_key";

-- CreateIndex
CREATE UNIQUE INDEX "PosUser_storeId_username_key" ON "PosUser"("storeId", "username");
