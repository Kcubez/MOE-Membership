BEGIN;
ALTER TABLE "moe_auth_user" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "moe_auth_user" ADD CONSTRAINT "moe_auth_user_role_check" CHECK (role IN ('member','staff','admin'));
ALTER TABLE "moe_auth_session" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "account_audit" (
 "id" TEXT PRIMARY KEY, "actorId" TEXT, "targetId" TEXT NOT NULL, "action" TEXT NOT NULL,
 "reason" TEXT NOT NULL, "before" JSONB, "after" JSONB,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "account_audit_targetId_createdAt_idx" ON "account_audit"("targetId","createdAt");
-- Locking orders session insertion against reset/disable/version changes.
CREATE FUNCTION moe_validate_session_epoch() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE account_enabled BOOLEAN; account_version INTEGER;
BEGIN
 SELECT enabled, "authVersion" INTO account_enabled, account_version FROM "moe_auth_user" WHERE id=NEW."userId" FOR UPDATE;
 IF NOT FOUND OR NOT account_enabled OR account_version <> NEW."authVersion" THEN
   RAISE EXCEPTION 'Session account state changed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER moe_session_epoch BEFORE INSERT ON "moe_auth_session" FOR EACH ROW EXECUTE FUNCTION moe_validate_session_epoch();
COMMIT;
