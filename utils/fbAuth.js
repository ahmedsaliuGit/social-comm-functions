const { admin, db } = require("./admin");

exports.FBAuth = async (req, res, next) => {
  let idToken;
  const { authorization } = req.headers;

  if (authorization && authorization.startsWith("Bearer ")) {
    idToken = authorization.split("Bearer ")[1];
  } else {
    console.error("Authorization not found");
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;

    const data = db
      .collection("users")
      .where("userId", "==", req.user.uid)
      .limit(1)
      .get();

    const userData = (await data).docs[0].data();

    req.user.handle = userData.handle;
    req.user.userImage = userData.imageUrl;
    return next();
  } catch (err) {
    console.error("Error while verifying token", err);
    if (err.code === "auth/argument-error") {
      return res.status(403).json({ error: "Invalid token" });
    } else if (err.code === "auth/id-token-expired") {
      return res.status(403).json({ error: "Token has expired." });
    }

    return res.status(403).json(err);
  }
};
