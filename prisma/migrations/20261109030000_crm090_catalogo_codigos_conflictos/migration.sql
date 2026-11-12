-- CRM-090: catálogo de conflictos escolares de Notar
-- Códigos internos, no oficiales de la DGCyE.

INSERT INTO "ConflictCode" ("code", "description")
VALUES
('CON-001', 'Violencia física entre estudiantes'),
('CON-002', 'Violencia verbal entre estudiantes'),
('CON-003', 'Hostigamiento escolar reiterado'),
('CON-004', 'Ciberacoso o violencia digital'),
('CON-005', 'Amenazas o intimidación'),
('CON-006', 'Discriminación'),
('CON-007', 'Violencia de género'),
('CON-008', 'Presunta vulneración de derechos'),
('CON-009', 'Presunta violencia o maltrato familiar'),
('CON-010', 'Presunta situación de abuso sexual'),
('CON-011', 'Presencia de armas u objetos peligrosos'),
('CON-012', 'Situación relacionada con sustancias psicoactivas'),
('CON-013', 'Violencia contra personal docente o no docente'),
('CON-014', 'Violencia de personal institucional hacia estudiantes'),
('CON-015', 'Situación de autolesión o riesgo suicida'),
('CON-016', 'Otro conflicto que requiere intervención institucional')
ON CONFLICT ("code")
DO UPDATE SET "description" = EXCLUDED."description";
