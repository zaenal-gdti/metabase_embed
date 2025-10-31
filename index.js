"use strict";

require("dotenv").config();

const METABASE_SITE_URL =
  process.env.METABASE_SITE_URL || "http://localhost:3000";
const METABASE_JWT_SHARED_SECRET =
  process.env.METABASE_JWT_SHARED_SECRET ||
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const METABASE_DASHBOARD_PATH =
  process.env.METABASE_DASHBOARD_PATH || "/dashboard/1";
const EMBED_MODIFIERS =
  process.env.METABASE_EMBED_PARAMS || "embed=true&logo=false";
const EMBED_QUERY_PARAMS = new URLSearchParams(EMBED_MODIFIERS);
const METABASE_SESSION_TTL_MS = Number.parseInt(
  process.env.METABASE_SESSION_TTL_MS || `${1000 * 60 * 8}`,
  10,
);
const METABASE_EMBED_MIN_HEIGHT = Number.parseInt(
  process.env.METABASE_EMBED_MIN_HEIGHT || "1400",
  10,
);
const METABASE_EMBED_EXTRA_HEIGHT = Number.parseInt(
  process.env.METABASE_EMBED_EXTRA_HEIGHT || "400",
  10,
);
const METABASE_DEFAULT_USER_EMAIL =
  (process.env.METABASE_DEFAULT_USER_EMAIL || "").trim();

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

function getDefaultUser() {
  if (METABASE_DEFAULT_USER_EMAIL) {
    const matched = findUserByEmail(METABASE_DEFAULT_USER_EMAIL);
    if (matched) {
      return matched;
    }
    console.warn(
      `Default embed user "${METABASE_DEFAULT_USER_EMAIL}" not found; using fallback user.`,
    );
  }
  if (users.length === 0) {
    return null;
  }
  return users[0];
}

function normalizeReturnToPath(rawPath) {
  if (!rawPath) {
    return METABASE_DASHBOARD_PATH;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    try {
      const asUrl = new URL(rawPath);
      return `${asUrl.pathname}${asUrl.search}` || METABASE_DASHBOARD_PATH;
    } catch (err) {
      console.warn("Failed to normalize absolute return_to path", err);
      return METABASE_DASHBOARD_PATH;
    }
  }

  if (!rawPath.startsWith("/")) {
    return `/${rawPath}`;
  }

  return rawPath;
}

function applyEmbedModifiers(rawPath) {
  const normalized = normalizeReturnToPath(rawPath);
  const [pathname, search = ""] = normalized.split("?");
  const params = new URLSearchParams(search);

  EMBED_QUERY_PARAMS.forEach((value, key) => {
    if (!params.has(key)) {
      params.append(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
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

function ensureUserSession(req, res, next) {
  if (req.session.user) {
    return next();
  }
  const defaultUser = getDefaultUser();
  if (!defaultUser) {
    req.session.returnTo = req.originalUrl;
    req.session.error =
      "No default user is available. Please sign in to continue.";
    return res.redirect("/login");
  }
  req.session.user = { ...defaultUser };
  req.session.success = `Signed in automatically as ${defaultUser.firstName}.`;
  next();
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

app.get("/analytics", ensureUserSession, function (req, res) {
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

async function refreshMetabaseSession(req, returnToWithModifiers) {
  const ssoUrl = new URL("/auth/sso", METABASE_SITE_URL);
  ssoUrl.searchParams.set("jwt", signUserToken(req.session.user));
  ssoUrl.searchParams.set("return_to", returnToWithModifiers);

  const response = await fetch(ssoUrl.toString(), {
    redirect: "manual",
  });

  if (response.status !== 302) {
    const sample = await response.text();
    throw new Error(
      `Metabase SSO failed (${response.status}). ${sample.slice(0, 200)}`
    );
  }

  const rawCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  if (!rawCookies.length) {
    throw new Error("Metabase SSO did not return Set-Cookie headers.");
  }

  return {
    cookies: rawCookies,
    expiresAt: Date.now() + METABASE_SESSION_TTL_MS,
  };
}

function ensureMetabaseSession(req, returnToWithModifiers) {
  if (
    req.session.metabaseSession &&
    req.session.metabaseSession.expiresAt > Date.now()
  ) {
    return Promise.resolve(req.session.metabaseSession);
  }

  return refreshMetabaseSession(req, returnToWithModifiers).then((session) => {
    req.session.metabaseSession = session;
    return session;
  });
}

function attachMetabaseCookies(res, cookies) {
  cookies.forEach((cookie) => {
    res.append("Set-Cookie", cookie);
  });
}

app.get("/sso/metabase", ensureUserSession, async (req, res, next) => {
  try {
    const rawReturnTo = req.query.return_to || METABASE_DASHBOARD_PATH;
    const returnToWithModifiers = applyEmbedModifiers(rawReturnTo);
    const session = await ensureMetabaseSession(req, returnToWithModifiers);
    attachMetabaseCookies(res, session.cookies);
    const redirectTarget = new URL(
      returnToWithModifiers,
      METABASE_SITE_URL
    ).toString();
    res.redirect(redirectTarget);
  } catch (err) {
    next(err);
  }
});

const PORT = process.env.PORT || 9090;
if (!module.parent) {
  app.listen(PORT, () => {
    console.log(`Express started serving on port ${PORT}`);
  });
}
