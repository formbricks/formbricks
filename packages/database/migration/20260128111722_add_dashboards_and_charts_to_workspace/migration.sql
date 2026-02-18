-- CreateEnum
CREATE TYPE "public"."ChartType" AS ENUM ('area', 'bar', 'line', 'pie', 'big_number');

-- CreateTable
CREATE TABLE "public"."Chart" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ChartType" NOT NULL,
    "projectId" TEXT NOT NULL,
    "query" JSONB NOT NULL DEFAULT '{}',
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,

    CONSTRAINT "Chart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dashboard" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DashboardWidget" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "title" TEXT,
    "chartId" TEXT NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":4,"h":3}',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chart_projectId_created_at_idx" ON "public"."Chart"("projectId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Chart_projectId_name_key" ON "public"."Chart"("projectId", "name");

-- CreateIndex
CREATE INDEX "Dashboard_projectId_created_at_idx" ON "public"."Dashboard"("projectId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Dashboard_projectId_name_key" ON "public"."Dashboard"("projectId", "name");

-- CreateIndex
CREATE INDEX "DashboardWidget_dashboardId_order_idx" ON "public"."DashboardWidget"("dashboardId", "order");

-- AddForeignKey
ALTER TABLE "public"."Chart" ADD CONSTRAINT "Chart_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dashboard" ADD CONSTRAINT "Dashboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardWidget" ADD CONSTRAINT "DashboardWidget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "public"."Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardWidget" ADD CONSTRAINT "DashboardWidget_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "public"."Chart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
