import { describe, expect, it } from "vitest";
import { partitionByThreshold } from "../src/batch.js";

describe("partitionByThreshold", () => {
  it("splits files larger than the threshold from those at or under it", () => {
    const files = [
      { fileName: "a", filePath: "/a", size: 100 },
      { fileName: "b", filePath: "/b", size: 200 },
      { fileName: "c", filePath: "/c", size: 300 },
    ];

    const { toSplit, skipped } = partitionByThreshold(files, 200);

    expect(toSplit.map((f) => f.fileName)).toEqual(["c"]);
    expect(skipped.map((f) => f.fileName)).toEqual(["a", "b"]);
  });
});
