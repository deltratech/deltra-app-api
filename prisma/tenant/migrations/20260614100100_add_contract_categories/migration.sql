-- New document categories: SK Pembina Ekskul (teaching assignment) and a
-- generic SK Koordinator (position assignment, e.g. Cambridge coordinator).
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'sk_pembina_ekskul';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'sk_koordinator';
