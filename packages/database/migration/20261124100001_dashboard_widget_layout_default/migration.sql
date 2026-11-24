-- The default widget layout follows the finer dashboard grid: 12 units tall, what 3 rows were.
ALTER TABLE "DashboardWidget" ALTER COLUMN "layout" SET DEFAULT '{"x":0,"y":0,"w":4,"h":12}';
