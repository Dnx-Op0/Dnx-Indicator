import { randomBytes, scryptSync } from "node:crypto";

const input = process.stdin;
const output = process.stdout;

if (!input.isTTY || typeof input.setRawMode !== "function") {
  throw new Error("Run this command in an interactive terminal so the password can be entered privately.");
}

output.write("Developer password (minimum 16 characters): ");
input.setEncoding("utf8");
input.setRawMode(true);
input.resume();

let password = "";
let finished = false;

function finish(cancelled = false) {
  if (finished) return;
  finished = true;
  input.setRawMode(false);
  input.pause();
  output.write("\n");

  if (cancelled) {
    password = "";
    output.write("Password hashing cancelled.\n");
    process.exitCode = 1;
    return;
  }
  if (password.length < 16 || password.length > 1024) {
    password = "";
    output.write("Password must contain between 16 and 1024 characters.\n");
    process.exitCode = 1;
    return;
  }

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const passwordHash = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
  output.write(`${passwordHash.replace(/\$/g, "\\$")}\n`);
  password = "";
}

input.on("data", (chunk) => {
  for (const character of chunk) {
    if (character === "\u0003") {
      finish(true);
      return;
    }
    if (character === "\r" || character === "\n") {
      finish();
      return;
    }
    if (character === "\u007f" || character === "\b") {
      password = password.slice(0, -1);
      continue;
    }
    password += character;
  }
});
