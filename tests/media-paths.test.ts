import { test } from "node:test";
import assert from "node:assert/strict";
import { storagePathOf } from "../lib/backend";

test("old public URLs and bare paths both resolve to the object path", () => {
  assert.equal(storagePathOf("https://abc.supabase.co/storage/v1/object/public/pin-media/u1/x.jpg"), "u1/x.jpg");
  assert.equal(storagePathOf("u1/x.jpg"), "u1/x.jpg");
});

test("seed photos and local previews are never treated as storage objects", () => {
  assert.equal(storagePathOf("https://images.unsplash.com/photo?x=1"), null);
  assert.equal(storagePathOf("data:image/jpeg;base64,AAAA"), null);
  assert.equal(storagePathOf("blob:http://localhost/abc"), null);
  assert.equal(storagePathOf(""), null);
});
