// scripts/patchAssigneeIds.js
const admin = require("firebase-admin");

// If running in Firebase Functions, this may be just admin.initializeApp();
// If running locally, pass service account credentials:
admin.initializeApp({
  // credential: admin.credential.cert(require("./serviceAccountKey.json")),
});

const db = admin.firestore();

async function patchAssigneeIds() {
  const tasksSnap = await db.collection("employeeTasks").get();
  const usersSnap = await db.collection("users").get();

  const userMap = {};
  usersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.username) {
      userMap[data.username] = docSnap.id;
    }
  });

  let updatedCount = 0;

  for (const taskDoc of tasksSnap.docs) {
    const task = taskDoc.data();
    const taskId = taskDoc.id;

    // Only fix when assigneeId is same as assignee (old bug)
    if (!task.assignee || task.assigneeId !== task.assignee) continue;

    const correctUid = userMap[task.assignee];
    if (!correctUid) {
      console.warn(
        `No UID found for assignee "${task.assignee}" in task ${taskId}`
      );
      continue;
    }

    try {
      await db.collection("employeeTasks").doc(taskId).update({
        assigneeId: correctUid
      });
      console.log(`✅ Updated task ${taskId}: assigneeId → ${correctUid}`);
      updatedCount++;
    } catch (err) {
      console.error(`❌ Failed to update task ${taskId}:`, err);
    }
  }

  console.log(`🎯 Patch complete. ${updatedCount} tasks updated.`);
}

patchAssigneeIds()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
