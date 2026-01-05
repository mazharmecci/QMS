const admin = require("firebase-admin");

// Load service account credentials
const serviceAccount = require("/var/www/qms/istos-qms-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://istos-qms.firebaseio.com"
});

const db = admin.firestore();

async function patchAssigneeIds({ dryRun = false } = {}) {
  console.log(`🔍 Starting patch${dryRun ? " (dry run)" : ""}...`);

  const [tasksSnap, usersSnap] = await Promise.all([
    db.collection("employeeTasks").get(),
    db.collection("users").get()
  ]);

  // Build a map of username → UID
  const userMap = {};
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.username && data.uid) {
      userMap[data.username] = data.uid;
    }
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const taskDoc of tasksSnap.docs) {
    const task = taskDoc.data();
    const taskId = taskDoc.id;

    // Skip if no assignee
    if (!task.assignee) {
      skippedCount++;
      continue;
    }

    const correctUid = userMap[task.assignee];
    if (!correctUid) {
      console.warn(`⚠️ No UID found for assignee "${task.assignee}" in task ${taskId}`);
      continue;
    }

    // Patch if assigneeId is missing OR not equal to correct UID
    if (!task.assigneeId || task.assigneeId !== correctUid) {
      if (dryRun) {
        console.log(`📝 Would update task ${taskId}: assigneeId → ${correctUid}`);
      } else {
        try {
          await db.collection("employeeTasks").doc(taskId).update({ assigneeId: correctUid });
          console.log(`✅ Updated task ${taskId}: assigneeId → ${correctUid}`);
          updatedCount++;
        } catch (err) {
          console.error(`❌ Failed to update task ${taskId}:`, err);
        }
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`🎯 Patch complete. ${updatedCount} tasks updated, ${skippedCount} skipped.`);
}

// Run patch
patchAssigneeIds({ dryRun: false })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Patch failed:", err);
    process.exit(1);
  });
