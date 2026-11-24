BEGIN;
-- Preserve all membership quotas and history; change only program templates and console roles.
ALTER TABLE moe_auth_user DROP CONSTRAINT moe_auth_user_role_check;
UPDATE moe_auth_user SET role = CASE role WHEN 'admin' THEN 'super_admin' WHEN 'staff' THEN 'admin' ELSE role END, "authVersion" = "authVersion" + 1 WHERE role IN ('admin','staff');
DELETE FROM moe_auth_session WHERE "userId" IN (SELECT id FROM moe_auth_user WHERE role IN ('super_admin','admin'));
ALTER TABLE moe_auth_user ADD CONSTRAINT moe_auth_user_role_check CHECK (role IN ('member','admin','super_admin'));
ALTER TABLE plans DROP COLUMN "totalVisits";

COMMIT;
