const firebase = require("firebase");
const config = require("../utils/config");

firebase.initializeApp(config);

const auth = firebase.auth();

const { db, admin } = require("../utils/admin");

const {
  validateSignupData,
  validateSigninData,
  reduceUserDetails,
} = require("../utils/validators");

exports.addUser = async (req, res) => {
  const { email, password, confirmPassword, handle } = req.body;
  const { valid, errors } = validateSignupData({
    email,
    password,
    confirmPassword,
    handle,
  });
  const userDefaultImage = "user-default-image.png";

  if (!valid) {
    return res.status(400).json(errors);
  }

  try {
    const user = await db.doc(`/users/${handle}`).get();

    if (user.exists) {
      return res.status(400).json({ handle: "This handle is already taken" });
    }
    const userData = await auth.createUserWithEmailAndPassword(email, password);

    if (userData.user.uid) {
      const newUser = {
        email,
        handle,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${userDefaultImage}?alt=media`,
        userId: userData.user.uid,
      };
      await db.doc(`/users/${handle}`).set(newUser);
    }

    const token = await userData.user.getIdToken();

    return res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    if (err.code === "auth/email-already-in-use") {
      return res.status(400).json({ email: err.message });
    }
    return res.status(500).json({ error: "Something went wrong" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const { valid, errors } = validateSigninData({ email, password });

  if (!valid) {
    return res.status(400).json(errors);
  }

  try {
    const authenticatedUser = await auth.signInWithEmailAndPassword(
      email,
      password
    );
    const token = await authenticatedUser.user.getIdToken();

    return res.json({ token });
  } catch (err) {
    console.error(err.message);

    return res
      .status(500)
      .json({ general: "Wrong credentials. please, try again." });
  }
};

// Add user's details
exports.addUserDetails = async (req, res) => {
  const {
    body: { bio, location, website },
    user: { handle },
  } = req;

  const userDetail = reduceUserDetails({ bio, location, website });

  if (!userDetail.valid) {
    return res.status(400).json({ error: "All field can not be empty" });
  }

  delete userDetail.valid;

  try {
    await db.doc(`/users/${handle}`).update(userDetail);

    return res.json({ message: "Details added successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Done", userDetail });
  }
};

// Get own user's details
exports.getAuthenticatedUser = async (req, res) => {
  const { handle } = req.user;
  let userData = {};

  try {
    const doc = await db.doc(`/users/${handle}`).get();

    if (doc.exists) {
      userData.credentials = doc.data();

      userData.likes = [];

      const likesDoc = await db
        .collection("likes")
        .where("userHandle", "==", handle)
        .get();

      likesDoc.forEach((doc) => userData.likes.push(doc.data()));

      userData.notifications = [];
      const notificationDoc = await db
        .collection("notifications")
        .where("recipient", "==", handle)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      notificationDoc.forEach((doc) =>
        userData.notifications.push({ ...doc.data(), notificationId: doc.id })
      );

      return res.json(userData);
    }
    return res.status(404).json({ error: "Unauthorized!" });
  } catch (err) {
    console.log("Error", err);
    return res.status(500).json({ error: err.code });
  }
};

exports.getUserDetails = async (req, res) => {
  const { handle } = req.params;
  const userData = {};

  try {
    const userDoc = await db.doc(`/users/${handle}`).get();

    if (userDoc.exists) {
      userData.user = userDoc.data();

      const screamForUser = await db
        .collection("screams")
        .where("userHandle", "==", handle)
        .orderBy("createdAt", "desc")
        .get();

      userData.screams = [];

      screamForUser.forEach((doc) => userData.screams.push(doc.data()));

      return res.json(userData);
    } else {
      return res.status(404).json({ error: "Not found" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.code });
  }
};

exports.markNotificationRead = async (req, res) => {
  const { body } = req.body;
  try {
    let batch = db.batch();

    body.forEach((notificationId) => {
      const notification = db.doc(`/notifications/${notificationId}`);
      batch.update(notification, { read: true });
    });

    await batch.commit();

    return res.json({ meassage: "Notificationa marked read" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ general: "Something went wrong. Please try again" });
  }
};

exports.imageUpload = async (req, res) => {
  const BusBoy = require("busboy");
  const path = require("path");
  const fs = require("fs");
  const os = require("os");

  const { headers, user, rawBody } = req;

  const busboy = new BusBoy({ headers });
  let imageToBeUploaded;
  let imageFileName;

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    if (
      mimetype !== "image/png" &&
      mimetype !== "image/jpg" &&
      mimetype !== "image/jpeg"
    ) {
      return res.status(400).json({ message: "Wrong file submitted" });
    }

    const fileExtension = filename.split(".")[filename.split(".").length - 1];
    imageFileName = `${Math.round(
      Math.random() * 10000000000
    )}.${fileExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = {
      filepath,
      mimetype,
    };
    file.pipe(fs.createWriteStream(filepath));
  });

  busboy.on("finish", async () => {
    try {
      await admin
        .storage()
        .bucket()
        .upload(imageToBeUploaded.filepath, {
          resumable: false,
          metadata: {
            metadata: {
              contentType: imageToBeUploaded.mimetype,
            },
          },
        });

      const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
      await db.doc(`/users/${user.handle}`).update({ imageUrl });

      return res.json({ message: "Image uploaded successfully" });
    } catch (err) {
      console.error("Image upload error", err.code);
      return res.status(500).json({ message: "Image upload failed" });
    }
  });

  busboy.end(rawBody);
};
