-- CreateEnum
CREATE TYPE "public"."ChartType" AS ENUM ('area', 'bar', 'line', 'pie', 'big_number');

-- CreateTable
CREATE TABLE "public"."Chart" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ChartType" NOT NULL,
    "workspaceId" TEXT NOT NULL,
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
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DashboardWidget" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":4,"h":3}',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chart_workspaceId_created_at_idx" ON "public"."Chart"("workspaceId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Chart_workspaceId_name_key" ON "public"."Chart"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Dashboard_workspaceId_created_at_idx" ON "public"."Dashboard"("workspaceId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Dashboard_workspaceId_name_key" ON "public"."Dashboard"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "DashboardWidget_dashboardId_order_idx" ON "public"."DashboardWidget"("dashboardId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardWidget_dashboardId_chartId_key" ON "public"."DashboardWidget"("dashboardId", "chartId");

-- AddForeignKey
ALTER TABLE "public"."Chart" ADD CONSTRAINT "Chart_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Chart" ADD CONSTRAINT "Chart_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dashboard" ADD CONSTRAINT "Dashboard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dashboard" ADD CONSTRAINT "Dashboard_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardWidget" ADD CONSTRAINT "DashboardWidget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "public"."Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardWidget" ADD CONSTRAINT "DashboardWidget_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "public"."Chart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
