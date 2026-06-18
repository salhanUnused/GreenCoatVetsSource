export {
  DEFAULT_PLATFORM_BRANDING,
  fetchPlatformBranding,
  resolveFaviconUrl,
  type PlatformBranding,
} from "./platform-branding";

export { buildPlatformIcons, buildWebsiteIcons, resolvePublicSiteUrl } from "./site-metadata";

export { DEFAULT_FAVICON_SVG, fetchTabIconResponse, isSquareFavicon, validateSquarePngUpload } from "./tab-icon";

export { DATA_SHARING_CONSENT_KEY, DATA_SHARING_CONSENT_VERSION } from "./consent";

export {
  DEFAULT_PET_SPECIES_BOOKING_VALUE,
  formatSpeciesLabel,
  normalizeLegacySpeciesToCanonical,
  PET_SPECIES_BOOKING_OPTIONS,
  SPECIES_OR_FILTER_AVIAN,
  SPECIES_OR_FILTER_CANINE,
  SPECIES_OR_FILTER_EQUINE,
  SPECIES_OR_FILTER_EXOTIC,
  SPECIES_OR_FILTER_FELINE,
  type PetSpeciesBookingOption,
} from "./pet-species-booking";

export {
  assertAppointmentStartsInFuture,
  getMinAppointmentDateTimeLocalValue,
  parseAppointmentDateTimeLocal,
} from "./appointment-datetime";

export {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_MODEL_FALLBACKS,
  extractOpenRouterMessageText,
  modelRequiresMandatoryReasoning,
  requestOpenRouterChatCompletion,
  requestOpenRouterChatWithFallbacks,
  resolveOpenRouterModel,
  type OpenRouterChatMessage,
  type OpenRouterChatRequest,
  type OpenRouterChatResult,
} from "./openrouter";

export {
  parseInstagramPromptPackFromText,
  parseJsonFromLlmOutput,
  type InstagramPromptPackFields,
} from "./parse-llm-json";

export {
  deriveUserAuthCapabilities,
  fetchUserAuthCapabilities,
  WEB_PORTAL_STAFF_ROLES,
  type UserAuthCapabilities,
} from "./user-auth-capabilities";

export {
  resolveAuthDestination,
  type AuthAppUrls,
  type AuthDestinationResult,
  type AuthLoginSurface,
} from "./resolve-auth-destination";
