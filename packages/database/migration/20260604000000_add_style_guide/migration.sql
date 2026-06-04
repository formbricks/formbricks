-- CreateTable "StyleGuide"
CREATE TABLE "StyleGuide" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logo" JSONB,
    "brandColor" TEXT,
    "accentColor" TEXT,
    "customColors" JSONB DEFAULT '{}',
    "borderRadius" TEXT,
    "fontSize" TEXT,
    "fontFamily" TEXT,
    "version" TEXT,
    "authors" TEXT,
    "externalDocumentation" TEXT,
    "workspaceConfig" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StyleGuide_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StyleGuide" ADD CONSTRAINT "StyleGuide_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "StyleGuide_organizationId_name_key" ON "StyleGuide"("organizationId", "name");

-- CreateIndex
CREATE INDEX "StyleGuide_organizationId_created_at_idx" ON "StyleGuide"("organizationId", "created_at");

-- AlterTable "Workspace"
ALTER TABLE "Workspace" ADD COLUMN "activeStyleGuideId" TEXT;
