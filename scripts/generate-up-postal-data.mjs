import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(repositoryRoot, "data", "up-postal-directory.json");
const mirrorRoot =
  "https://raw.githubusercontent.com/aniket-thapa/india-pincode-api/main";

const districtNames = {
  "GAUTAM BUDDHA NAGAR": "Gautam Buddha Nagar",
  KHERI: "Lakhimpur Kheri",
  "KUSHI NAGAR": "Kushinagar",
  "RAE BARELI": "Rae Bareli",
  "SANT KABEER NAGAR": "Sant Kabir Nagar",
  SHRAVASTI: "Shravasti",
};

function titleCase(value) {
  return value
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_, prefix, letter) =>
      `${prefix}${letter.toUpperCase()}`,
    )
    .replace(/\bGpo\b/g, "GPO")
    .replace(/\bAfs\b/g, "AFS")
    .replace(/\bIim\b/g, "IIM")
    .replace(/\bIit\b/g, "IIT");
}

function displayDistrict(sourceName) {
  return districtNames[sourceName] ?? titleCase(sourceName);
}

function displayArea(sourceName) {
  const withoutOfficeCode = sourceName
    .replace(/\s+(B\.?O\.?|S\.?O\.?|H\.?O\.?|G\.?P\.?O\.?)$/i, "")
    .trim();
  return /[a-z]/.test(withoutOfficeCode)
    ? withoutOfficeCode
    : titleCase(withoutOfficeCode);
}

async function fetchJson(path) {
  const response = await fetch(`${mirrorRoot}/${path}`);
  if (!response.ok) {
    throw new Error(`Could not fetch ${path}: ${response.status}`);
  }
  return response.json();
}

const state = await fetchJson("states/uttar-pradesh.json");
const directoryEntries = await Promise.all(
  state.districts.map(async (district) => {
    const payload = await fetchJson(
      `districts/uttar-pradesh/${district.slug}.json`,
    );
    const seen = new Set();
    const areas = payload.offices
      .map((office) => ({
        name: displayArea(office.officeName),
        pincode: String(office.pincode),
        delivery: office.deliveryStatus === "Delivery",
      }))
      .filter((office) => {
        const key = `${office.name.toLowerCase()}|${office.pincode}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name, "en-IN") ||
          left.pincode.localeCompare(right.pincode),
      );
    return [displayDistrict(district.name), areas];
  }),
);

const directory = Object.fromEntries(
  directoryEntries.sort(([left], [right]) => left.localeCompare(right, "en-IN")),
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({
    country: "India",
    state: "Uttar Pradesh",
    source:
      "Department of Posts, All India Pincode Directory, Open Government Data Platform India",
    sourceUrl:
      "https://www.data.gov.in/catalog/all-india-pincode-directory-through-webservice",
    directory,
  })}\n`,
  "utf8",
);

const areaCount = Object.values(directory).reduce(
  (total, areas) => total + areas.length,
  0,
);
console.log(
  `Generated ${Object.keys(directory).length} districts and ${areaCount} postal areas at ${outputPath}`,
);
