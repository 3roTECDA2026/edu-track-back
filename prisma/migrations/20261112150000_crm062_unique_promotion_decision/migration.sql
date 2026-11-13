-- Evita decisiones duplicadas del motor por alumno y ciclo (CRM-062).
CREATE UNIQUE INDEX "PromotionDecision_studentId_academicYearId_key" ON "PromotionDecision"("studentId", "academicYearId");
