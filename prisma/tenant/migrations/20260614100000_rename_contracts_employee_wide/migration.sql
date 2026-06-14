-- Generalize teacher-centric contract tables to employee-wide names.
-- Data-preserving renames (indexes, FKs and the auto array types follow automatically).
ALTER TABLE "teacher_contracts" RENAME TO "contracts";
ALTER TABLE "teacher_contract_templates" RENAME TO "contract_templates";
