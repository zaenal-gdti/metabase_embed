"use strict";

require("dotenv").config();

const METABASE_SITE_URL =
  process.env.METABASE_SITE_URL || "http://localhost:3000";
const METABASE_JWT_SHARED_SECRET =
  process.env.METABASE_JWT_SHARED_SECRET ||
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const METABASE_DASHBOARD_PATH =
  process.env.METABASE_DASHBOARD_PATH || "/dashboard/1";
const EMBED_MODIFIERS = process.env.METABASE_EMBED_PARAMS || "logo=false";
const METABASE_EMBED_MIN_HEIGHT = Number.parseInt(
  process.env.METABASE_EMBED_MIN_HEIGHT || "1400",
  10,
);
const METABASE_EMBED_EXTRA_HEIGHT = Number.parseInt(
  process.env.METABASE_EMBED_EXTRA_HEIGHT || "400",
  10,
);

const express = require("express");
const hash = require("pbkdf2-password")();
const path = require("path");
const session = require("express-session");
const jwt = require("jsonwebtoken");

const app = (module.exports = express());

// config
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// middleware
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET || "shhhh, very secret",
  })
);

// Session-persisted message middleware
app.use(function (req, res, next) {
  const err = req.session.error;
  const msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = "";
  if (err) res.locals.message = `<p class="msg error">${err}</p>`;
  if (msg) res.locals.message = `<p class="msg success">${msg}</p>`;
  next();
});

// dummy database
const users = [
  {
    firstName: "Rene",
    lastName: "Mueller",
    email: "rene@example.com",
    accountId: 28,
    accountName: "Customer-Acme",
  },
  {
    firstName: "Cecilia",
    lastName: "Stark",
    email: "cecilia@example.com",
    accountId: 132,
    accountName: "Customer-Fake",
  },
];

// when you create a user, generate salt/hash for password "foobar"
hash({ password: "foobar" }, function (err, pass, salt, hashed) {
  if (err) throw err;
  users.forEach((user) => {
    user.salt = salt;
    user.hash = hashed;
  });
});

function findUserByEmail(email) {
  return users.find((user) => user.email === email);
}

// Authenticate using in-memory users list
function authenticate(email, pass, fn) {
  if (!module.parent) console.log("authenticating %s:%s", email, pass);
  const user = findUserByEmail(email);
  if (!user) return fn(null, null);
  hash({ password: pass, salt: user.salt }, function (err, pass, salt, hashed) {
    if (err) return fn(err);
    if (hashed === user.hash) return fn(null, user);
    return fn(null, null);
  });
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.returnTo = req.originalUrl;
    req.session.error = "Please sign in to continue.";
    res.redirect("/login");
  }
}

const signUserToken = (user) =>
  jwt.sign(
    {
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      account_id: user.accountId,
      groups: [user.accountName],
      exp: Math.round(Date.now() / 1000) + 60 * 10, // 10 minute expiration
    },
    METABASE_JWT_SHARED_SECRET
  );

app.get("/", function (req, res) {
  res.redirect("/analytics");
});

app.get("/analytics", restrict, function (req, res) {
  const iframeUrl = `/sso/metabase?return_to=${METABASE_DASHBOARD_PATH}`;
  res.render("dashboard", {
    iframeUrl,
    siteUrl: METABASE_SITE_URL,
    dashboardPath: METABASE_DASHBOARD_PATH,
    user: req.session.user,
    minHeight: METABASE_EMBED_MIN_HEIGHT,
    extraHeight: METABASE_EMBED_EXTRA_HEIGHT,
  });
});

app.get("/logout", function (req, res) {
  const mbLogoutUrl = new URL("/auth/logout", METABASE_SITE_URL);
  req.session.destroy(function () {
    res.send(
      `You have been logged out. <a href="/login">Log in</a>` +
        `<iframe src="${mbLogoutUrl}" hidden></iframe>`
    );
  });
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.post("/login", function (req, res, next) {
  authenticate(req.body.email, req.body.password, function (err, user) {
    if (err) return next(err);
    if (user) {
      const returnTo = req.session.returnTo;
      req.session.regenerate(function () {
        req.session.user = user;
        req.session.success = `Welcome back, ${user.firstName}!`;
        res.redirect(returnTo || "/");
        delete req.session.returnTo;
      });
    } else {
      req.session.error =
        'Authentication failed. Use "rene@example.com" or "cecilia@example.com" with password "foobar".';
      res.redirect("/login");
    }
  });
});

app.get("/sso/metabase", restrict, (req, res) => {
  const ssoUrl = new URL("/auth/sso", METABASE_SITE_URL);
  ssoUrl.searchParams.set("jwt", signUserToken(req.session.user));
  ssoUrl.searchParams.set(
    "return_to",
    `${req.query.return_to ?? "/"}?${EMBED_MODIFIERS}`
  );

  res.redirect(ssoUrl);
});

const PORT = process.env.PORT || 9090;
if (!module.parent) {
  app.listen(PORT, () => {
    console.log(`Express started serving on port ${PORT}`);
  });
}
