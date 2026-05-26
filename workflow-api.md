/teacher-contracts

1. Upload a DOCX template (`POST /teacher-contracts/templates`)  
Admin uploads `.docx` template. We store:
- template metadata in DB (`teacher_contract_templates`)
- template file in object storage (`templateFileUrl` + file metadata)

2. Preview contract (`POST /teacher-contracts/preview`)  
System:
- loads teacher profile + related user/schedule context
- resolves variables (name, role, period, teaching load, employment status, etc.)
- picks template (by `templateId` or inferred type)
- renders preview text content (`renderedContent`) using placeholders

3. Finalize contract (`POST /teacher-contracts`)  
System:
- repeats variable/template resolution
- reads uploaded template `.docx` from object storage
- merges variables into DOCX with `PizZip + Docxtemplater`
- uploads generated contract DOCX to object storage
- creates `teacher_contracts` row with status `draft`, variables snapshot, rendered content, and generated file URL/metadata

4. Edit metadata (`PATCH /teacher-contracts/:id`)  
Updates contract fields (period, role, notes, status-related metadata), keeps history via `updatedByUserId`.

5. Attach PDF URL (`PATCH /teacher-contracts/:id/pdf`)  
For now, PDF conversion is external; this endpoint stores resulting `pdfUrl` once available.

6. Retrieve/filter contracts (`GET /teacher-contracts`)  
Supports filtering by:
- `teacherProfileId`
- `templateType`
- `status`
- period range (`periodStart`, `periodEnd`)

7. Renewal reminders (`GET /teacher-contracts/renewal-reminders`)  
Returns contracts nearing end date within N days (default 30), based on `contractEndDate` / `renewalReminderAt`.
