const { db } = require("../utils/admin");

exports.getScreams = async (req, res) => {
  const screams = [];

  try {
    const data = await db
      .collection("screams")
      .orderBy("createdAt", "desc")
      .get();

    data.forEach((doc) => screams.push(doc.data()));

    return res.json(screams);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.code });
  }
};

exports.addScream = async (req, res) => {
  const {
    body: { body },
    user: { userImage },
  } = req;

  if (body.trim() === "") {
    return res
      .status(400)
      .json({ body: "cannot be empty, enter some text/scream" });
  }

  try {
    const screamsRef = db.collection("screams").doc();

    const screamObj = {
      screamId: screamsRef.id,
      body,
      userHandle: req.user.handle,
      createdAt: new Date().toISOString(),
      userImage,
      likeCount: 0,
      commentCount: 0,
    };

    await screamsRef.set(screamObj);

    res.json({ message: `Scream created successfully`, data: screamObj });
  } catch (err) {
    res.status(500).json({ general: "Something went wrong" });
  }
};

// Getting scream by Id
exports.getScream = async (req, res) => {
  const { screamId } = req.params;
  let screamData = {};

  try {
    const doc = await db.doc(`/screams/${screamId}`).get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({ error: `Scream with this ${screamId} not found` });
    }

    screamData = doc.data();
    // screamData.screamId = doc.id
    screamData.comments = [];

    const commentsRef = await db
      .collection("comments")
      .where("screamId", "==", screamId)
      .orderBy("createdAt", "desc")
      .get();
    // console.log(commentsRef);
    commentsRef.forEach((doc) => {
      console.log(doc.data());
      screamData.comments.push(doc.data());
    });
    return res.json(screamData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.code });
  }
};

// Post comment for scream
exports.screamComments = async (req, res) => {
  const {
    body: { body },
    params: { screamId },
    user: { handle, userImage },
  } = req;

  if (body.trim() === "") {
    return res.status(400).json({ body: "You can not submit empty comment" });
  }

  const newComment = {
    body,
    screamId,
    userHandle: handle,
    createdAt: new Date().toISOString(),
    userImage,
  };

  try {
    const doc = await db.doc(`/screams/${screamId}`).get();

    if (!doc.exists) {
      return res.status(404).json({ scream: "Not found" });
    }

    await db.collection("comments").add(newComment);
    await doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    return res.json(newComment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// like a scream
exports.likeScream = async (req, res) => {
  const {
    params: { screamId },
    user: { handle },
  } = req;

  try {
    const screamDoc = await db.doc(`/screams/${screamId}`).get();

    const likesDoc = await db
      .collection("likes")
      .where("screamId", "==", screamId)
      .where("userHandle", "==", handle)
      .limit(1)
      .get();

    if (!screamDoc.exists) {
      return res
        .status(400)
        .json({ scream: "You can not like unknown scream" });
    }

    const screamData = screamDoc.data();
    screamData.likeCount++;

    if (likesDoc.empty) {
      await db.collection("likes").add({ screamId, userHandle: handle });

      await db.doc(`/screams/${screamId}`).update({
        likeCount: ++screamDoc.data().likeCount,
      });

      return res.json(screamData);
    } else {
      return res
        .status(400)
        .json({ error: "You have already liked this post" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// unlike a scream
exports.unlikeScream = async (req, res) => {
  const {
    params: { screamId },
    user: { handle },
  } = req;

  try {
    const screamDoc = await db.doc(`/screams/${screamId}`).get();

    const likesDoc = await db
      .collection("likes")
      .where("screamId", "==", screamId)
      .where("userHandle", "==", handle)
      .limit(1)
      .get();

    if (!screamDoc.exists) {
      return res
        .status(400)
        .json({ scream: "You can not unlike unknown scream" });
    }
    const screamData = screamDoc.data();
    screamData.likeCount--;

    if (likesDoc.empty) {
      return res.status(400).json({ error: "You don't have like to unlike" });
    } else {
      await db.doc(`/likes/${likesDoc.docs[0].id}`).delete();

      await db.doc(`/screams/${screamId}`).update({
        likeCount: --screamDoc.data().likeCount,
      });

      screamDoc.data().likeCount -= 1;

      return res.json(screamData);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

exports.deleteScream = async (req, res) => {
  const {
    params: { screamId },
    user: { handle },
  } = req;

  try {
    const screamRef = await db.doc(`/screams/${screamId}`).get();

    if (!screamRef.exists) {
      return res.status(404).json({ scream: "Not found" });
    }

    if (screamRef.data().userHandle !== handle) {
      return res.status(403).json({ error: "Unathorized" });
    }

    screamRef.ref.delete();

    return res.json({ message: "Scream deleted successfully" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again" });
  }
};
