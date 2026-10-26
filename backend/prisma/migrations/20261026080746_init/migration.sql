-- CreateTable
CREATE TABLE "token_counters" (
    "day" TEXT NOT NULL,
    "prefix" CHAR(1) NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "token_counters_pkey" PRIMARY KEY ("day","prefix")
);
