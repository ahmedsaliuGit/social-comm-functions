const isEmpty = (str) => {
  if (str.trim() === "") {
    return true;
  } else {
    return false;
  }
};

const isEmail = (email) => {
  const regex = new RegExp(
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/
  );
  if (email.match(regex)) {
    return true;
  } else {
    return false;
  }
};

exports.validateSignupData = (data) => {
  const { email, password, confirmPassword, handle } = data;
  let errors = {};

  if (isEmpty(email)) {
    errors.email = "Must not be empty.";
  } else if (!isEmail(email)) {
    errors.email = "Must be a valid email.";
  }

  if (isEmpty(password)) errors.password = "Must not be empty.";
  if (isEmpty(handle)) errors.handle = "Must not be empty";
  if (password !== confirmPassword)
    errors.confirmPassword = "Password must match.";

  return {
    errors,
    valid: Object.keys(errors).length === 0,
  };
};

exports.validateSigninData = ({ email, password }) => {
  let errors = {};

  if (isEmpty(email)) {
    errors.email = "Must not be empty.";
  } else if (!isEmail(email)) {
    errors.email = "Must be a valid email.";
  }

  if (isEmpty(password)) errors.password = "Must not be empty.";

  return {
    errors,
    valid: Object.keys(errors).length === 0,
  };
};

function isAllEmpty() {
  return [...arguments].filter((elem) => elem !== "").length === 0;
}

exports.reduceUserDetails = ({ bio, location, website }) => {
  let userDetails = { valid: true };

  if (isAllEmpty(bio, location, website)) {
    userDetails.valid = false;
    return userDetails;
  }

  if (!isEmpty(bio)) userDetails.bio = bio;
  if (!isEmpty(location)) userDetails.location = location;
  if (!isEmpty(website)) {
    if (website.substring(0, 4) !== "http") {
      userDetails.website = `http://${website}`;
    } else {
      userDetails.website = website;
    }
  }

  return userDetails;
};
