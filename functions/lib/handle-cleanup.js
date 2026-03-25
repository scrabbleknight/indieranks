const LEGACY_HANDLE_REDIRECTS = {
  dannypostmaa: "dannypostma",
};

function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

function chunk(items = [], size = 350) {
  const groups = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups;
}

function buildLegacySet() {
  return new Set(Object.keys(LEGACY_HANDLE_REDIRECTS).map((handle) => normalizeHandle(handle)).filter(Boolean));
}

function getRedirectTarget(handle) {
  return LEGACY_HANDLE_REDIRECTS[normalizeHandle(handle)] || "";
}

function matchesLegacyHandle(value, legacyHandles) {
  return legacyHandles.has(normalizeHandle(value));
}

function mapDocSnapshot(snapshot) {
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data(),
  }));
}

export async function inspectLegacyHandleDocs(db) {
  const legacyHandles = buildLegacySet();
  const [devSnapshot, metricSnapshot, projectSnapshot, snapshotDocs] = await Promise.all([
    db.collection("devs").get(),
    db.collection("devMetrics").get(),
    db.collection("projects").get(),
    db.collection("rankSnapshots").get(),
  ]);

  const snapshotRowsBySnapshot = await Promise.all(
    snapshotDocs.docs.map(async (snapshotDoc) => {
      const rowsSnapshot = await snapshotDoc.ref.collection("rows").get();
      return {
        snapshotId: snapshotDoc.id,
        rows: mapDocSnapshot(rowsSnapshot),
      };
    })
  );

  const devDocs = mapDocSnapshot(devSnapshot).filter((doc) => {
    return matchesLegacyHandle(doc.id, legacyHandles) || matchesLegacyHandle(doc.data && doc.data.handle, legacyHandles);
  });

  const metricDocs = mapDocSnapshot(metricSnapshot).filter((doc) => {
    return matchesLegacyHandle(doc.id, legacyHandles) || matchesLegacyHandle(doc.data && doc.data.handle, legacyHandles);
  });

  const projectDocs = mapDocSnapshot(projectSnapshot).filter((doc) => {
    return (
      matchesLegacyHandle(doc.data && doc.data.founderXUsername, legacyHandles) ||
      matchesLegacyHandle(doc.data && doc.data.xUsername, legacyHandles)
    );
  });

  const snapshotRows = snapshotRowsBySnapshot.flatMap((entry) => {
    return entry.rows
      .filter((doc) => {
        return matchesLegacyHandle(doc.id, legacyHandles) || matchesLegacyHandle(doc.data && doc.data.handle, legacyHandles);
      })
      .map((doc) => ({
        ...doc,
        snapshotId: entry.snapshotId,
      }));
  });

  return {
    devDocs,
    metricDocs,
    projectDocs,
    snapshotRows,
  };
}

export async function cleanupLegacyHandleDocs(db) {
  const legacyHandles = buildLegacySet();

  if (!legacyHandles.size) {
    return {
      deletedHandles: [],
      deletedDevDocs: [],
      deletedMetricDocs: [],
      deletedProjectDocs: [],
      deletedSnapshotRows: [],
      migratedProjectDocs: [],
      updatedDevDocs: [],
    };
  }

  const inspection = await inspectLegacyHandleDocs(db);
  const operations = [];
  const deletedDevDocs = [];
  const deletedMetricDocs = [];
  const deletedProjectDocs = [];
  const deletedSnapshotRows = [];
  const migratedProjectDocs = [];
  const updatedDevDocs = [];

  inspection.devDocs.forEach((doc) => {
    const legacyHandle = normalizeHandle(doc.data && doc.data.handle ? doc.data.handle : doc.id);
    const redirectTarget = getRedirectTarget(legacyHandle);

    if (normalizeHandle(doc.id) === legacyHandle && redirectTarget && normalizeHandle(doc.id) !== normalizeHandle(redirectTarget)) {
      operations.push({
        type: "delete",
        ref: doc.ref,
      });
      deletedDevDocs.push(doc.id);
      return;
    }

    if (redirectTarget && normalizeHandle(doc.id) === normalizeHandle(redirectTarget)) {
      operations.push({
        type: "set",
        ref: doc.ref,
        data: {
          handle: redirectTarget,
        },
      });
      updatedDevDocs.push(doc.id);
    }
  });

  inspection.metricDocs.forEach((doc) => {
    if (matchesLegacyHandle(doc.id, legacyHandles)) {
      operations.push({
        type: "delete",
        ref: doc.ref,
      });
      deletedMetricDocs.push(doc.id);
    }
  });

  inspection.projectDocs.forEach((doc) => {
    const founderHandle = normalizeHandle(doc.data && (doc.data.founderXUsername || doc.data.xUsername));
    const redirectTarget = getRedirectTarget(founderHandle);

    if (!redirectTarget) {
      return;
    }

    if (String(doc.data && doc.data.importSource || "").trim() === "product_hunt") {
      operations.push({
        type: "delete",
        ref: doc.ref,
      });
      deletedProjectDocs.push(doc.id);
      return;
    }

    operations.push({
      type: "set",
      ref: doc.ref,
      data: {
        founderXUsername: redirectTarget,
        xUsername: redirectTarget,
      },
    });
    migratedProjectDocs.push(doc.id);
  });

  inspection.snapshotRows.forEach((doc) => {
    operations.push({
      type: "delete",
      ref: doc.ref,
    });
    deletedSnapshotRows.push(`${doc.snapshotId}/${doc.id}`);
  });

  for (const group of chunk(operations, 350)) {
    const batch = db.batch();
    group.forEach((operation) => {
      if (operation.type === "delete") {
        batch.delete(operation.ref);
        return;
      }

      batch.set(operation.ref, operation.data, { merge: true });
    });
    await batch.commit();
  }

  return {
    deletedHandles: Array.from(legacyHandles),
    deletedDevDocs,
    deletedMetricDocs,
    deletedProjectDocs,
    deletedSnapshotRows,
    migratedProjectDocs,
    updatedDevDocs,
  };
}

export { LEGACY_HANDLE_REDIRECTS };
