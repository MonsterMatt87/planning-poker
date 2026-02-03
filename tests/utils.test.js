import assert from "node:assert/strict";
import test from "node:test";
import { generateRoomId, getInitials } from "../utils.js";

test("generateRoomId returns an uppercase room slug with a hyphen", () => {
  const roomId = generateRoomId();
  assert.match(roomId, /^[A-Z]+-\d{3}$/);
});

test("getInitials returns up to two uppercase initials", () => {
  assert.equal(getInitials("Ada Lovelace"), "AL");
  assert.equal(getInitials("Linus"), "L");
});

test("getInitials falls back to a placeholder for empty names", () => {
  assert.equal(getInitials("   "), "?");
});
