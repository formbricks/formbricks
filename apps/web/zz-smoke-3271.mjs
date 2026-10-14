// Throwaway smoke driver for PR #9620 (delete after use). Drives the live :3271 server over HTTP.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import { generateSync } from "otplib";

const B = "http://localhost:3271";
const OUT = process.argv[2];
writeFileSync(OUT, "");
const log = (...a) =>
  appendFileSync(OUT, a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n");
const psql = (sql) =>
  execFileSync("docker", ["exec", "eng3713-pg", "psql", "-U", "postgres", "-d", "smoke3271", "-tAc", sql])
    .toString()
    .trim();
const cookiesOf = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]);
const merge = (jar, res) => {
  for (const c of cookiesOf(res)) jar.set(c.split("=")[0], c);
  return jar;
};
const header = (jar) => [...jar.values()].join("; ");
const post = async (path, body, jar) => {
  const res = await fetch(B + path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: B, ...(jar ? { cookie: header(jar) } : {}) },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  if (jar) merge(jar, res);
  return { status: res.status, body: text.slice(0, 200), res };
};
const userRow = (email) =>
  psql(`select id, coalesce("lastLoginAt"::text,'NULL') from "User" where email='${email}'`).split("|");
const sessions = (id) => psql(`select count(*) from "Session" where "userId"='${id}'`);
const check = (name, ok, detail = "") => log(ok ? "PASS" : "FAIL", name, detail);

const pw = `Sm0ke!${randomBytes(9).toString("hex")}`;
const mk = async (email) => {
  const r = await post("/api/auth/sign-up/email", { email, password: pw, name: email.split("@")[0] });
  log("sign-up", email, r.status, r.body);
  psql(`update "User" set "emailVerified"=true where email='${email}'`);
  return userRow(email)[0];
};

const tfaEmail = `smoke-2fa-${Date.now()}@example.test`;
const plainEmail = `smoke-plain-${Date.now()}@example.test`;
const tfaId = await mk(tfaEmail);
const plainId = await mk(plainEmail);
log("ids", { tfaId, plainId });

// Enrol TOTP for the 2FA user.
const enrolJar = new Map();
log(
  "enrol sign-in",
  (await post("/api/auth/sign-in/email", { email: tfaEmail, password: pw }, enrolJar)).status
);
const en = await post("/api/auth/two-factor/enable", { password: pw }, enrolJar);
const secret = /secret=([^&"]+)/.exec(en.res ? en.body + "" : "")?.[1];
const enBody = JSON.parse(
  (await (
    await fetch(B + "/api/auth/two-factor/get-totp-uri", {
      method: "POST",
      headers: { "content-type": "application/json", origin: B, cookie: header(enrolJar) },
      body: JSON.stringify({ password: pw }),
    })
  ).text()) || "{}"
);
const totpSecret = secret ?? /secret=([^&]+)/.exec(enBody.totpURI ?? "")?.[1];
log("enable", en.status, "secret?", Boolean(totpSecret));
log(
  "verify enrol",
  (await post("/api/auth/two-factor/verify-totp", { code: generateSync({ secret: totpSecret }) }, enrolJar))
    .status
);
check("2FA enabled", psql(`select "twoFactorEnabled" from "User" where id='${tfaId}'`) === "t");
psql(
  `delete from "Session" where "userId"='${tfaId}'; update "User" set "lastLoginAt"=NULL where id in ('${tfaId}','${plainId}')`
);
log("MARK before-password-step", new Date().toISOString());

// 1) Password alone: a challenge, nothing recorded.
const jar = new Map();
const pwStep = await post("/api/auth/sign-in/email", { email: tfaEmail, password: pw }, jar);
check(
  "password step returns the 2FA challenge",
  pwStep.status === 200 && pwStep.body.includes("twoFactorRedirect"),
  pwStep.body
);
check("password step: no session", sessions(tfaId) === "0");
check("password step: lastLoginAt not set", userRow(tfaEmail)[1] === "NULL", userRow(tfaEmail)[1]);

// 2) A wrong code: still nothing.
const wrong = await post("/api/auth/two-factor/verify-totp", { code: "000000" }, jar);
check("wrong code refused", wrong.status >= 400, String(wrong.status));
check("wrong code: lastLoginAt not set", userRow(tfaEmail)[1] === "NULL");
log("MARK before-totp", new Date().toISOString());

// 3) The right code completes the sign-in.
const ok = await post(
  "/api/auth/two-factor/verify-totp",
  { code: generateSync({ secret: totpSecret }) },
  jar
);
check("TOTP completes the sign-in", ok.status === 200, String(ok.status));
check("TOTP: one session", sessions(tfaId) === "1");
check("TOTP: lastLoginAt set", userRow(tfaEmail)[1] !== "NULL", userRow(tfaEmail)[1]);

// 4) Reading the session is not a sign-in.
const gs = await fetch(B + "/api/auth/get-session", { headers: { cookie: header(jar), origin: B } });
log("get-session", gs.status);
log("MARK after-get-session", new Date().toISOString());

// 5) A user without 2FA: the password completes the sign-in.
const pjar = new Map();
const p = await post("/api/auth/sign-in/email", { email: plainEmail, password: pw }, pjar);
check("plain sign-in", p.status === 200 && !p.body.includes("twoFactorRedirect"), p.body);
check("plain: lastLoginAt set", userRow(plainEmail)[1] !== "NULL");
log("DONE");
