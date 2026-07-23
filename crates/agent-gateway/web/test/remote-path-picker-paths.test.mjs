import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createWebModuleLoader } from "../../test/helpers/load-web-module.mjs";

const loader = createWebModuleLoader({
  rootDir: fileURLToPath(new URL("../", import.meta.url)),
});

const {
  basenameFromPath,
  findBestRootForPath,
  findRouteChild,
  isSameOrDescendantPath,
  joinChildPath,
  normalizePathForCompare,
  stripTrailingPathSeparators,
} = loader.loadModule("src/components/remotePathPickerPaths.ts");

// The picker browses the paired desktop, which may be Windows: every helper
// must handle drive ("C:\\", "C:/") and UNC ("\\\\server\\share") shapes in
// addition to POSIX paths, regardless of the browser platform.

test("stripTrailingPathSeparators keeps roots and trims everything else", () => {
  assert.equal(stripTrailingPathSeparators("/"), "/");
  assert.equal(stripTrailingPathSeparators("C:\\"), "C:\\");
  assert.equal(stripTrailingPathSeparators("C:/"), "C:/");
  assert.equal(stripTrailingPathSeparators("C:"), "C:");
  assert.equal(stripTrailingPathSeparators("/a/b/"), "/a/b");
  assert.equal(stripTrailingPathSeparators("C:\\Users\\Me\\"), "C:\\Users\\Me");
  assert.equal(stripTrailingPathSeparators("  /a/b  "), "/a/b");
});

test("normalizePathForCompare lowercases only Windows drive paths", () => {
  assert.equal(normalizePathForCompare("C:\\Users\\Me"), "c:/users/me");
  assert.equal(normalizePathForCompare("c:/USERS/me/"), "c:/users/me");
  assert.equal(normalizePathForCompare("/Users/Me"), "/Users/Me");
});

test("isSameOrDescendantPath understands drive roots and separators", () => {
  assert.ok(isSameOrDescendantPath("C:\\Users\\Me", "C:\\"));
  assert.ok(isSameOrDescendantPath("C:/Users/Me", "c:\\users"));
  assert.ok(isSameOrDescendantPath("C:\\Users", "C:\\Users"));
  assert.ok(!isSameOrDescendantPath("C:\\UsersOther", "C:\\Users"));
  assert.ok(!isSameOrDescendantPath("D:\\Users", "C:\\"));
  assert.ok(isSameOrDescendantPath("/home/me/repo", "/home/me"));
  assert.ok(!isSameOrDescendantPath("/home/meow", "/home/me"));
});

test("findBestRootForPath prefers the longest matching root", () => {
  const roots = [
    { id: "C:\\", path: "C:\\", kind: "drive", label: "C:" },
    { id: "home", path: "C:\\Users\\Me", kind: "home", label: "~" },
    { id: "D:\\", path: "D:\\", kind: "drive", label: "D:" },
  ];
  assert.equal(findBestRootForPath("C:\\Users\\Me\\repo", roots)?.id, "home");
  assert.equal(findBestRootForPath("C:\\Temp", roots)?.id, "C:\\");
  assert.equal(findBestRootForPath("E:\\Temp", roots), null);
});

test("findRouteChild matches the child leading to the target", () => {
  const entries = [
    { path: "C:\\Users\\Me\\alpha", name: "alpha", kind: "dir" },
    { path: "C:\\Users\\Me\\alpha-beta", name: "alpha-beta", kind: "dir" },
  ];
  assert.equal(findRouteChild("C:/users/me/alpha/repo", entries)?.name, "alpha");
  assert.equal(findRouteChild("C:\\Users\\Me\\alpha-beta", entries)?.name, "alpha-beta");
  assert.equal(findRouteChild("C:\\Users\\Me\\gamma", entries), null);
});

test("basenameFromPath handles both separators and drive roots", () => {
  assert.equal(basenameFromPath("C:\\Users\\Me\\repo"), "repo");
  assert.equal(basenameFromPath("/home/me/repo/"), "repo");
  assert.equal(basenameFromPath("C:\\"), "C:");
});

test("joinChildPath joins drive roots without doubling separators", () => {
  // fs_list returns workdir-relative entries; the file-mode picker joins
  // them back onto the browsed directory.
  assert.equal(joinChildPath("C:\\", "src"), "C:\\src");
  assert.equal(joinChildPath("C:/", "src"), "C:/src");
  assert.equal(joinChildPath("C:", "src"), "C:/src");
  assert.equal(joinChildPath("C:\\Users\\Me", "src/app.ts"), "C:\\Users\\Me\\src/app.ts");
  assert.equal(joinChildPath("/", "home"), "/home");
  assert.equal(joinChildPath("/home/me", "repo"), "/home/me/repo");
  // UNC share roots must not collapse their leading double slash.
  assert.equal(joinChildPath("\\\\server\\share", "repo"), "\\\\server\\share\\repo");
  assert.equal(joinChildPath("//server/share", "repo"), "//server/share/repo");
});
