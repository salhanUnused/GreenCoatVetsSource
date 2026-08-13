import type { MarketingLocationPublic } from "./types";

/** Used when `marketing_locations` has no rows yet. */
export const DEFAULT_MARKETING_LOCATIONS: MarketingLocationPublic[] = [
  {
    id: "default-phase-9",
    name: "Phase 9 Clinic",
    addressLines: ["Mohali Phase 9, Sahibzada Ajit Singh Nagar, Punjab 160062"],
    phoneDisplay: "096085-50006",
    telHref: "tel:+919608550006",
    hoursLabel: "Open 24/7 on Call",
    directionsUrl: "https://greencoatvets.com/greencoatvets-phase-9-mohali-pun/",
    latitude: 30.7046,
    longitude: 76.7179,
  },
  {
    id: "default-kharar",
    name: "Kharar Clinic",
    addressLines: [
      "SCO 9, Green Coat Vets, Near Chirag Homes, Jandpur Road,",
      "Mohali Sector 123 — 140301",
    ],
    phoneDisplay: "079426-84366",
    telHref: "tel:+917942684366",
    hoursLabel: "Open 24/7 on Call",
    directionsUrl: null,
    latitude: 30.7446,
    longitude: 76.6478,
  },
  {
    id: "default-ropar",
    name: "Ropar Clinic",
    addressLines: ["XGC9+WRG, road, opposite Gugga marhi, Haveli Kalan,", "Rupnagar, Punjab 140001"],
    phoneDisplay: "+91 7410-940006",
    telHref: "tel:+917410940006",
    hoursLabel: "9:00 am – 8:00 pm",
    directionsUrl: null,
    latitude: 30.966,
    longitude: 76.533,
  },
  {
    id: "default-naraingarh",
    name: "Naraingarh Clinic",
    addressLines: ["Naraingarh, dist. Ambala, opp. Savanna Kitchen", "Haryana"],
    phoneDisplay: "88180-08067",
    telHref: "tel:+918818008067",
    hoursLabel: "9:00 am – 8:00 pm",
    directionsUrl: null,
    latitude: 30.474,
    longitude: 77.128,
  },
  {
    id: "default-barnala",
    name: "Barnala / Mittal Veterinary Clinic",
    addressLines: [
      "Barnala, Punjab — Anaj Mandi Road, Sharvhitkari School Street,",
      "Barnala — 148101",
    ],
    phoneDisplay: "98156-50234",
    telHref: "tel:+919815650234",
    hoursLabel: "9:00 am – 7:00 pm",
    directionsUrl: null,
    latitude: 30.234,
    longitude: 75.546,
  },
  {
    id: "default-muktsar",
    name: "Sri Muktsar Sahib / Malwa Pet Clinic",
    addressLines: ["Near Malwa Furniture, Malout Road,", "New Grain Market — 152026"],
    phoneDisplay: "079471-38108",
    telHref: "tel:+917947138108",
    hoursLabel: "9:00 am – 7:00 pm",
    directionsUrl: null,
    latitude: 30.474,
    longitude: 74.516,
  },
  {
    id: "default-sangria",
    name: "Sangria Clinic",
    addressLines: ["Bhagatpura Road near Sunrise Tailor, Sangria,", "Hanumangarh, Rajasthan"],
    phoneDisplay: "78778-67772",
    telHref: "tel:+917877867772",
    hoursLabel: "9:00 am – 7:00 pm",
    directionsUrl: null,
    latitude: 29.797,
    longitude: 74.466,
  },
];

/**
 * Public website should no longer list the deprecated Mohali TDI location.
 * Keep the check broad enough to hide legacy DB rows until the cleanup migration runs.
 */
export function isSuppressedPublicLocation(loc: Pick<MarketingLocationPublic, "id" | "name" | "addressLines">): boolean {
  const haystack = [loc.id, loc.name, ...(loc.addressLines ?? [])].join(" ").toLowerCase();
  return haystack.includes("mohali tdi") || haystack.includes("tdi ox") || haystack.includes("taj plaza");
}

export function getDirectionsUrl(loc: MarketingLocationPublic): string {
  const direct = typeof loc?.directionsUrl === "string" ? loc.directionsUrl.trim() : "";
  if (direct) return direct;
  const lines = Array.isArray(loc?.addressLines) ? loc.addressLines : [];
  const q = lines.filter((line) => typeof line === "string" && line.trim()).join(" ");
  const fallback = typeof loc?.name === "string" && loc.name.trim() ? loc.name : "veterinary clinic";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || fallback)}`;
}
