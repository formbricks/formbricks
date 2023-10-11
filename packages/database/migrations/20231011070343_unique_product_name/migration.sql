/*
  Warnings:

  - A unique constraint covering the columns `[teamId,name]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Product_teamId_name_key" ON "Product"("teamId", "name");
