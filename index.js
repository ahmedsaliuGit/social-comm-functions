const functions = require("firebase-functions");
const app = require("express")();
const cors = require("cors");

const { FBAuth } = require("./utils/fbAuth");
const { db, admin } = require("./utils/admin");

const {
  getScreams,
  addScream,
  getScream,
  screamComments,
  likeScream,
  unlikeScream,
  deleteScream,
} = require("./handlers/screamHandler");
const {
  addUser,
  login,
  imageUpload,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationRead,
} = require("./handlers/userHandler");

app.use(cors());

// Screams route
app.get("/screams", getScreams);
app.post("/screams", FBAuth, addScream);
app.get("/scream/:screamId", getScream);
app.post("/scream/:screamId/comment", FBAuth, screamComments);
app.get("/scream/:screamId/like", FBAuth, likeScream);
app.get("/scream/:screamId/unlike", FBAuth, unlikeScream);
app.delete("/scream/:screamId", FBAuth, deleteScream);

// Authentication & Users route
app.post("/signup", addUser);
app.post("/signin", login);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.post("/user/image-upload", FBAuth, imageUpload);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationRead);

exports.api = functions.https.onRequest(app);

exports.createLikeNotification = functions.firestore
  .document("likes/{id}")
  .onCreate(async (snapshot) => {
    try {
      const screamDoc = await db
        .doc(`/screams/${snapshot.data().screamId}`)
        .get();

      if (
        screamDoc.exists &&
        screamDoc.data().userHandle !== snapshot.data().userHandle
      ) {
        await db.doc(`/notifications/${snapshot.id}`).set({
          createdAt: new Date().toISOString(),
          type: "like",
          receipient: screamDoc.data().userHandle,
          read: false,
          screamId: screamDoc.id,
          sender: snapshot.data().userHandle,
        });
      }
      return screamDoc;
    } catch (err) {
      console.log(err);
    }
  });

exports.deleteUnlikeNotification = functions.firestore
  .document("likes/{id}")
  .onDelete(async (snapshot) => {
    try {
      await db.doc(`/notifications/${snapshot.id}`).delete();
    } catch (err) {
      console.log(err);
    }
  });

exports.createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate(async (snapshot) => {
    try {
      const screamDoc = await db
        .doc(`/screams/${snapshot.data().screamId}`)
        .get();

      if (
        screamDoc.exists &&
        screamDoc.data().userHandle !== snapshot.data().userHandle
      ) {
        await db.doc(`/notifications/${snapshot.id}`).set({
          createdAt: new Date().toISOString(),
          type: "comment",
          receipient: screamDoc.data().userHandle,
          read: false,
          screamId: screamDoc.id,
          sender: snapshot.data().userHandle,
        });
      }
    } catch (err) {
      console.log(err);
    }
  });

exports.onUserImageUrlUpdate = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change) => {
    console.info(change.before.data());
    console.info(change.after.data());
    const changeAfterData = change.after.data();

    try {
      if (change.before.data().imageUrl !== changeAfterData.imageUrl) {
        console.info("Changed", changeAfterData);
        const batch = db.batch();
        const screamDoc = await db
          .collection("screams")
          .where("userHandle", "==", changeAfterData.handle)
          .get();
        console.info("DCC::", screamDoc);
        screamDoc.forEach((doc) => {
          const scream = db.doc(`/screams/${doc.id}`);
          batch.update(scream, { userImage: changeAfterData.imageUrl });
        });

        return batch.commit();
      } else {
        return true;
      }
    } catch (err) {
      console.error(err);
    }
  });

exports.onScreamDelete = functions.firestore
  .document("screams/{screamId}")
  .onDelete(async (snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    console.log("SCREAMID::", screamId);
    try {
      const commentDocs = await db
        .collection("comments")
        .where("screamId", "==", screamId)
        .get();
      const likeDocs = await db
        .collection("likes")
        .where("screamId", "==", screamId)
        .get();
      const notificationDocs = await db
        .collection("notifications")
        .where("screamId", "==", screamId)
        .get();

      commentDocs.forEach((doc) => {
        batch.delete(db.doc(`/comments/${doc.id}`));
      });

      likeDocs.forEach((doc) => {
        batch.delete(db.doc(`/likes/${doc.id}`));
      });

      notificationDocs.forEach((doc) => {
        batch.delete(db.doc(`/notifications/${doc.id}`));
      });

      return batch.commit();
    } catch (err) {
      console.error(err);
    }
  });
