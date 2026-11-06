BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE plans (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, benefits TEXT NOT NULL,
 "totalVisits" INTEGER NOT NULL CHECK ("totalVisits">=1), archived BOOLEAN NOT NULL DEFAULT false,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE memberships (
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "planId" TEXT NOT NULL,
 "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
 "totalVisits" INTEGER NOT NULL CHECK("totalVisits">=1), "usedVisits" INTEGER NOT NULL DEFAULT 0,
 "cancelledAt" TIMESTAMPTZ(6), "cancellationReason" TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1), "renewedFromId" TEXT,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT memberships_dates_check CHECK("endDate">="startDate"),
 CONSTRAINT memberships_visits_check CHECK("usedVisits">=0 AND "usedVisits"<="totalVisits"),
 CONSTRAINT memberships_cancel_check CHECK (("cancelledAt" IS NULL AND "cancellationReason" IS NULL) OR ("cancelledAt" IS NOT NULL AND length(btrim("cancellationReason"))>0 AND "cancellationReason" IS NOT NULL)),
 CONSTRAINT "memberships_userId_fkey" FOREIGN KEY("userId") REFERENCES moe_auth_user(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "memberships_planId_fkey" FOREIGN KEY("planId") REFERENCES plans(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT "memberships_renewedFromId_fkey" FOREIGN KEY("renewedFromId") REFERENCES memberships(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
 CONSTRAINT memberships_no_overlap EXCLUDE USING gist ("userId" WITH =,"planId" WITH =,daterange("startDate","endDate",'[]') WITH &&) WHERE ("cancelledAt" IS NULL)
);
CREATE INDEX "memberships_userId_planId_idx" ON memberships("userId","planId");
CREATE INDEX "memberships_planId_idx" ON memberships("planId");
CREATE INDEX "memberships_renewedFromId_idx" ON memberships("renewedFromId");
CREATE TABLE domain_audit (
 id TEXT PRIMARY KEY, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL,
 action TEXT NOT NULL, reason TEXT NOT NULL CHECK(length(btrim(reason))>0), "before" JSONB, "after" JSONB,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "domain_audit_entityType_entityId_createdAt_idx" ON domain_audit("entityType","entityId","createdAt");
COMMIT;
