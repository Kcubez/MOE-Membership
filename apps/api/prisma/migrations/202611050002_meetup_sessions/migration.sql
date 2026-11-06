BEGIN;
CREATE TABLE meetup_sessions (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120), "planId" TEXT NOT NULL,
 "meetupDate" DATE NOT NULL, open BOOLEAN NOT NULL DEFAULT false, version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "meetup_sessions_planId_fkey" FOREIGN KEY("planId") REFERENCES plans(id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "meetup_sessions_meetupDate_id_idx" ON meetup_sessions("meetupDate",id);
CREATE INDEX "meetup_sessions_planId_idx" ON meetup_sessions("planId");
CREATE TABLE meetup_staff (
 "sessionId" TEXT NOT NULL, "userId" TEXT NOT NULL,
 CONSTRAINT meetup_staff_pkey PRIMARY KEY("sessionId","userId"),
 CONSTRAINT "meetup_staff_sessionId_fkey" FOREIGN KEY("sessionId") REFERENCES meetup_sessions(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "meetup_staff_userId_fkey" FOREIGN KEY("userId") REFERENCES moe_auth_user(id) ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "meetup_staff_userId_sessionId_idx" ON meetup_staff("userId","sessionId");
COMMIT;
