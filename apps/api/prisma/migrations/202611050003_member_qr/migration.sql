BEGIN;
CREATE TABLE member_qr (
 "userId" TEXT PRIMARY KEY, "credentialId" UUID NOT NULL DEFAULT gen_random_uuid(),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1), "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "member_qr_userId_fkey" FOREIGN KEY("userId") REFERENCES moe_auth_user(id) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "member_qr_credentialId_key" ON member_qr("credentialId");
CREATE FUNCTION moe_provision_member_qr() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO member_qr ("userId") VALUES (NEW.id);
 RETURN NEW;
END;
$$;
CREATE TRIGGER moe_auth_user_qr AFTER INSERT ON moe_auth_user FOR EACH ROW EXECUTE FUNCTION moe_provision_member_qr();
INSERT INTO member_qr ("userId") SELECT id FROM moe_auth_user;
COMMIT;
