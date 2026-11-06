BEGIN;
CREATE UNIQUE INDEX "memberships_id_userId_planId_key" ON memberships(id,"userId","planId");
CREATE UNIQUE INDEX "meetup_sessions_id_planId_key" ON meetup_sessions(id,"planId");
CREATE TABLE attendance (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "planId" TEXT NOT NULL, "membershipId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
 "occurredAt" TIMESTAMPTZ(6) NOT NULL, "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "recordedById" TEXT NOT NULL,
 method TEXT NOT NULL DEFAULT 'scan' CHECK(method IN ('scan','backfill')),
 "cancelledAt" TIMESTAMPTZ(6), "cancelledById" TEXT, "cancellationReason" TEXT,
 CONSTRAINT attendance_cancel_check CHECK (("cancelledAt" IS NULL AND "cancelledById" IS NULL AND "cancellationReason" IS NULL) OR ("cancelledAt" IS NOT NULL AND "cancelledById" IS NOT NULL AND "cancellationReason" IS NOT NULL AND length(btrim("cancellationReason"))>0)),
 CONSTRAINT "attendance_userId_fkey" FOREIGN KEY("userId") REFERENCES moe_auth_user(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "attendance_recordedById_fkey" FOREIGN KEY("recordedById") REFERENCES moe_auth_user(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "attendance_cancelledById_fkey" FOREIGN KEY("cancelledById") REFERENCES moe_auth_user(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "attendance_membershipId_userId_planId_fkey" FOREIGN KEY("membershipId","userId","planId") REFERENCES memberships(id,"userId","planId") ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "attendance_sessionId_planId_fkey" FOREIGN KEY("sessionId","planId") REFERENCES meetup_sessions(id,"planId") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX attendance_one_effective_check_in ON attendance("membershipId","sessionId") WHERE "cancelledAt" IS NULL;
CREATE INDEX "attendance_userId_occurredAt_idx" ON attendance("userId","occurredAt");
CREATE INDEX "attendance_sessionId_occurredAt_idx" ON attendance("sessionId","occurredAt");
CREATE INDEX "attendance_membershipId_idx" ON attendance("membershipId");
CREATE TABLE check_in_operations (
 "actorId" TEXT NOT NULL, "requestId" UUID NOT NULL, fingerprint TEXT NOT NULL, "attendanceId" TEXT NOT NULL, result JSONB NOT NULL,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT check_in_operations_pkey PRIMARY KEY("actorId","requestId"),
 CONSTRAINT "check_in_operations_actorId_fkey" FOREIGN KEY("actorId") REFERENCES moe_auth_user(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "check_in_operations_attendanceId_fkey" FOREIGN KEY("attendanceId") REFERENCES attendance(id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "check_in_operations_attendanceId_idx" ON check_in_operations("attendanceId");
-- Quota accounting stays atomic even when a transaction rolls back or an attendance is cancelled later.
CREATE FUNCTION moe_attendance_accounting() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE m memberships; meetup_date DATE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Attendance history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW."cancelledAt" IS NOT NULL THEN RAISE EXCEPTION 'New attendance must be effective' USING ERRCODE='23514'; END IF;
  SELECT * INTO m FROM memberships WHERE id=NEW."membershipId" FOR UPDATE;
  SELECT "meetupDate" INTO meetup_date FROM meetup_sessions WHERE id=NEW."sessionId";
  IF m.id IS NULL OR m."cancelledAt" IS NOT NULL OR meetup_date < m."startDate" OR meetup_date > m."endDate" OR (NEW."occurredAt" AT TIME ZONE 'Asia/Yangon')::date <> meetup_date THEN
   RAISE EXCEPTION 'Attendance is outside the eligible period' USING ERRCODE='23514';
  END IF;
  UPDATE memberships SET "usedVisits"="usedVisits"+1, version=version+1,"updatedAt"=clock_timestamp() WHERE id=NEW."membershipId" AND "usedVisits"<"totalVisits";
  IF NOT FOUND THEN RAISE EXCEPTION 'No visits remaining' USING ERRCODE='23514'; END IF;
 ELSE
  IF ROW(NEW.id,NEW."userId",NEW."planId",NEW."membershipId",NEW."sessionId",NEW."occurredAt",NEW."recordedAt",NEW."recordedById",NEW.method) IS DISTINCT FROM ROW(OLD.id,OLD."userId",OLD."planId",OLD."membershipId",OLD."sessionId",OLD."occurredAt",OLD."recordedAt",OLD."recordedById",OLD.method) THEN RAISE EXCEPTION 'Attendance facts are immutable' USING ERRCODE='23514'; END IF;
  IF OLD."cancelledAt" IS NOT NULL AND ROW(NEW."cancelledAt",NEW."cancelledById",NEW."cancellationReason") IS DISTINCT FROM ROW(OLD."cancelledAt",OLD."cancelledById",OLD."cancellationReason") THEN RAISE EXCEPTION 'Cancellation is immutable' USING ERRCODE='23514'; END IF;
  IF OLD."cancelledAt" IS NULL AND NEW."cancelledAt" IS NOT NULL THEN UPDATE memberships SET "usedVisits"="usedVisits"-1,version=version+1,"updatedAt"=clock_timestamp() WHERE id=OLD."membershipId"; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_accounting BEFORE INSERT OR UPDATE OR DELETE ON attendance FOR EACH ROW EXECUTE FUNCTION moe_attendance_accounting();
COMMIT;
