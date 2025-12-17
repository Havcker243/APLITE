export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
] as const;

export const CA_PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

// Lightweight list (no dependency). Expand later if needed.
export const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Ireland",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Switzerland",
  "Austria",
  "Portugal",
  "Poland",
  "Czech Republic",
  "Greece",
  "Turkey",
  "United Arab Emirates",
  "Saudi Arabia",
  "India",
  "Singapore",
  "Hong Kong",
  "Japan",
  "South Korea",
  "Australia",
  "New Zealand",
  "Brazil",
  "Mexico",
  "Argentina",
  "South Africa",
  "Nigeria",
  "Kenya",
] as const;

export function normalizeCountry(value: string) {
  return (value || "").trim().toLowerCase();
}

export function isUnitedStates(country: string) {
  const c = normalizeCountry(country);
  return c === "united states" || c === "usa" || c === "us";
}

export function isCanada(country: string) {
  const c = normalizeCountry(country);
  return c === "canada" || c === "ca";
}

