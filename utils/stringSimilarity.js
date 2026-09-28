"use strict";

function compareTwoStrings(first, second) {
  const a = String(first).replace(/\s+/g, "");
  const b = String(second).replace(/\s+/g, "");
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const pairs = new Map();
  for (let index = 0; index < a.length - 1; index += 1) {
    const pair = a.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }

  let matches = 0;
  for (let index = 0; index < b.length - 1; index += 1) {
    const pair = b.slice(index, index + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      matches += 1;
    }
  }

  return (2 * matches) / (a.length + b.length - 2);
}

function findBestMatch(mainString, targetStrings) {
  if (!Array.isArray(targetStrings) || targetStrings.length === 0) {
    throw new TypeError("targetStrings must be a non-empty array");
  }
  const ratings = targetStrings.map((target) => ({
    target,
    rating: compareTwoStrings(mainString, target)
  }));
  let bestMatchIndex = 0;
  for (let index = 1; index < ratings.length; index += 1) {
    if (ratings[index].rating > ratings[bestMatchIndex].rating) bestMatchIndex = index;
  }
  return { ratings, bestMatch: ratings[bestMatchIndex], bestMatchIndex };
}

module.exports = { compareTwoStrings, findBestMatch };
