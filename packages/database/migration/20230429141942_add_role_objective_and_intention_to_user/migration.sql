-- CreateEnum
CREATE TYPE "Role" AS ENUM ('project_manager', 'engineer', 'founder', 'marketing_specialist', 'other');

-- CreateEnum
CREATE TYPE "Objective" AS ENUM ('increase_conversion', 'improve_user_retention', 'increase_user_adoption', 'sharpen_marketing_messaging', 'support_sales', 'other');

-- CreateEnum
CREATE TYPE "Intention" AS ENUM ('survey_user_segments', 'survey_at_specific_point_in_user_journey', 'enrich_customer_profiles', 'collect_all_user_feedback_on_one_platform', 'other');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "intention" "Intention",
ADD COLUMN     "objective" "Objective",
ADD COLUMN     "role" "Role";
