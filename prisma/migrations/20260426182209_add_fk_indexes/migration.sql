-- CreateIndex
CREATE INDEX "ImportSession_regattaId_idx" ON "ImportSession"("regattaId");

-- CreateIndex
CREATE INDEX "Result_regattaId_idx" ON "Result"("regattaId");

-- CreateIndex
CREATE INDEX "TeamEntry_helmId_idx" ON "TeamEntry"("helmId");

-- CreateIndex
CREATE INDEX "TeamEntry_crewId_idx" ON "TeamEntry"("crewId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");
