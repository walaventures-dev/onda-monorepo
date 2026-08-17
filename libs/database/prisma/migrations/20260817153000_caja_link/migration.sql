CREATE TABLE "CajaLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "CajaLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CajaLink_token_key" ON "CajaLink"("token");
CREATE INDEX "CajaLink_storeId_revokedAt_idx" ON "CajaLink"("storeId", "revokedAt");

ALTER TABLE "CajaLink"
  ADD CONSTRAINT "CajaLink_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
