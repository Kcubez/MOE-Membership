-- The trigger makes profile creation part of the same transaction as user insertion.
-- Backfill existing users without altering credentials or sessions.
CREATE TABLE "member_profiles" (
  "memberNumber" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  CONSTRAINT "member_profiles_pkey" PRIMARY KEY ("memberNumber"),
  CONSTRAINT "member_profiles_language_check" CHECK ("language" IN ('en', 'my')),
  CONSTRAINT "member_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "moe_auth_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "member_profiles_userId_key" ON "member_profiles"("userId");
CREATE FUNCTION moe_provision_member_profile() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "member_profiles" ("userId") VALUES (NEW."id") ON CONFLICT ("userId") DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER moe_auth_user_profile AFTER INSERT ON "moe_auth_user"
FOR EACH ROW EXECUTE FUNCTION moe_provision_member_profile();
INSERT INTO "member_profiles" ("userId") SELECT "id" FROM "moe_auth_user" ORDER BY "createdAt", "id" ON CONFLICT ("userId") DO NOTHING;
