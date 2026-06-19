let CONFIG = {
    googleMapsApiKey: "AIzaSyBKchVbGjHCgv54VaEU_FDj3X6ooGHTMVA",
    jotformBaseUrl: "https://form.jotform.com/260184280896364",
    allowedStates: [],
    resultsPageSize: 20,
    radiusMiles: 20,
    defaultZoomOnSelect: 15,
    locationCacheKey: "providerDirectory.locationCache.v1",
    locationCacheTtlMs: 30 * 24 * 60 * 60 * 1e3
  },
  els = {
    termInput: document.getElementById("termInput"),
    termSuggestions: document.getElementById("termSuggestions"),
    termError: document.getElementById("termError"),
    locInput: document.getElementById("locInput"),
    termClearBtn: document.getElementById("termClearBtn"),
    locClearBtn: document.getElementById("locClearBtn"),
    searchBtn: document.getElementById("searchBtn"),
    searchMeta: document.getElementById("searchMeta"),
    resultsSection: document.getElementById("resultsSection"),
    resultsCount: document.getElementById("resultsCount"),
    listPane: document.getElementById("listPane"),
    mapPane: document.getElementById("mapPane"),
    mapEl: document.getElementById("map"),
    splitView: document.getElementById("splitView"),
    loadMoreBtn: document.getElementById("loadMoreBtn"),
    emptyState: document.getElementById("emptyState"),
    mapSizeToggle: document.getElementById("mapSizeToggle"),
    mobileViewToggle: document.getElementById("mobileViewToggle"),
    modalOverlay: document.getElementById("modalOverlay"),
    modalCloseBtn: document.getElementById("modalCloseBtn"),
    jotformFrame: document.getElementById("jotformFrame")
  },
  catalog = {
    procedures: [],
    specialties: [],
    providers: []
  },
  specialtyNameById = {};
let typeaheadItems = [],
  selectedTerm = null,
  lastCommittedTermValue = "",
  selectedLocation = null,
  lastCommittedLocationValue = "",
  filteredProviders = [],
  renderedCount = 0,
  map = null,
  infoWindow = null,
  markersByProviderId = new Map,
  activeProviderId = null,
  isMobileMapView = !1,
  pendingFitProviders = null,
  searchRunId = 0,
  savedWindowScrollY = 0;

function z_gaEnabled() {
  return "function" == typeof window.gtag
}

function z_sanitizeLoc(e) {
  var e = String(e || "").trim(),
    t = /@/.test(e),
    r = /(\+?\d[\d\s().-]{7,}\d)/.test(e),
    a = /\d{6,}/.test(e);
  return t || r || a ? "" : e.slice(0, 80)
}

function z_ctx(e) {
  var t = z_sanitizeLoc(els?.locInput?.value || ""),
    r = selectedLocation || {};
  return {
    term_name: selectedTerm?.name || "",
    term_type: selectedTerm?.type || "",
    term_id: selectedTerm?.id || "",
    loc_input: t,
    location_input: t,
    location_display_name: r.displayName || "",
    location_city: r.city || "",
    location_state: r.state || "",
    location_postal_code: r.postalCode || "",
    location_country: r.country || "",
    location_source: r.source || "",
    location_place_id: r.placeId || "",
    location_resolved: Number.isFinite(r.lat) && Number.isFinite(r.lng) ? 1 : 0,
    provider_id: e?.ProviderID || "",
    provider_city: e?.City || "",
    provider_state: e?.State || ""
  }
}

function z_track(e, t = {}) {
  if (z_gaEnabled()) {
    var r, a, o = {};
    for ([r, a] of Object.entries(t)) null != a && (o[r] = a);
    window.gtag("event", e, o)
  }
}

function normalizeStr(e) {
  return String(e || "").trim()
}

function normTerm(e) {
  return String(e || "").toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ")
}

function normalizeCity(e) {
  return normalizeStr(e).toLowerCase()
}

function normalizePhoneForTel(e) {
  return String(e || "").replace(/[^\d+]/g, "")
}

function getInitialsFromPracticeName(e) {
  var e = String(e || "").trim();
  return e ? (((e = e.split(/\s+/).filter(Boolean))[0]?.[0] || "") + ((1 < e.length ? e[1]?.[0] : e[0]?.[1]) || "")).toUpperCase() : "??"
}

function textFrom(e) {
  return e ? (e.textContent || "").trim() : ""
}

function hrefFrom(e) {
  return e ? (e.getAttribute("href") || "").trim() : ""
}

function imgSrcFrom(e) {
  return (e = e && ("IMG" === e.tagName ? e : e.querySelector("img"))) ? (e.getAttribute("src") || "").trim() : ""
}

function safeHttpUrl(e) {
  var t = String(e || "").trim();
  if (!t) return "";
  /^[a-z][a-z0-9+.-]*:/i.test(t) || (t = "https://" + t);
  try {
    var r = new URL(t, window.location.origin);
    return "http:" === r.protocol || "https:" === r.protocol ? r.href : ""
  } catch (e) {
    return ""
  }
}

function cssEscape(e) {
  return window.CSS && "function" == typeof window.CSS.escape ? window.CSS.escape(String(e)) : String(e).replace(/["\\]/g, "\\$&")
}

function getCardImageUrl(e) {
  var t = String(e.DoctorPhotoUrl || "").trim();
  return t || String(e.LogoUrl || "").trim() || null
}

function iconPhoneSvg() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.85 21 3 13.15 3 3a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.24 1.01l-2.21 2.2Z"/>
    </svg>
  `
}

function iconPinSvg() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2c3.87 0 7 3.13 7 7 0 5.25-7 13-7 13S5 14.25 5 9c0-3.87 3.13-7 7-7Zm0 9.5A2.5 2.5 0 1 0 12 6.5a2.5 2.5 0 0 0 0 5Z"/>
    </svg>
  `
}

function iconGlobeSvg() {
  return `
    <svg class="icon icon--globe" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm7.93 9h-3.17a15.6 15.6 0 0 0-1.28-5.02A8.02 8.02 0 0 1 19.93 11ZM12 4.07c.84 1.07 1.56 3.03 1.92 6.93H10.08C10.44 7.1 11.16 5.14 12 4.07ZM4.07 13h3.17c.24 1.77.74 3.52 1.28 5.02A8.02 8.02 0 0 1 4.07 13Zm3.17-2H4.07a8.02 8.02 0 0 1 4.45-5.02c-.54 1.5-1.04 3.25-1.28 5.02ZM12 19.93c-.84-1.07-1.56-3.03-1.92-6.93h3.84c-.36 3.9-1.08 5.86-1.92 6.93ZM16.76 13h3.17a8.02 8.02 0 0 1-4.45 5.02c.54-1.5 1.04-3.25 1.28-5.02Z"/>
    </svg>
  `
}

function getUtmParams() {
  var e, t = new URL(window.location.href),
    r = {};
  for (e of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) r[e] = t.searchParams.get(e) || "";
  return r
}

function buildTypeaheadItems(e) {
  let o = [],
    i = new Set;
  return (e.procedures || []).forEach(r => {
    let a = String(r.name || "").trim();
    var e;
    a && (e = `procedure|${r.id}|` + normTerm(a), i.has(e) || (i.add(e), o.push({
      type: "procedure",
      id: r.id,
      name: a,
      label: "(Procedure)",
      mapsTo: null,
      searchText: normTerm(a)
    }))), (Array.isArray(r.aliases) ? r.aliases : []).forEach(e => {
      var t, e = String(e || "").trim();
      e && (t = `procedure|${r.id}|` + normTerm(e), i.has(t) || (i.add(t), o.push({
        type: "procedure",
        id: r.id,
        name: e,
        label: "(Procedure)",
        mapsTo: a || null,
        searchText: normTerm(e)
      })))
    })
  }), (e.specialties || []).forEach(e => {
    var t, r = String(e.name || "").trim();
    r && (t = `specialty|${e.id}|` + normTerm(r), i.has(t) || (i.add(t), o.push({
      type: "specialty",
      id: e.id,
      name: r,
      label: "(Specialty)",
      mapsTo: null,
      searchText: normTerm(r)
    })))
  }), o.sort((e, t) => e.name.localeCompare(t.name)), o
}

function boolFromNodes(e) {
  let t = !1;
  for (var r of Array.from(e || [])) {
    r = (r.textContent || "").trim().toLowerCase();
    if (r) {
      if (t = !0, "true" === r) return !0;
      if ("false" === r) return !1
    }
  }
  return t, null
}
async function loadData() {
  catalog.procedures = Array.from(document.querySelectorAll(".cms-procedures .w-dyn-item")).map(e => ({
    id: textFrom(e.querySelector("._wf-proc-id")),
    name: textFrom(e.querySelector("._wf-proc-name")),
    aliases: textFrom(e.querySelector("._wf-proc-aliases")).split(",").map(e => e.trim()).filter(Boolean)
  })), catalog.specialties = Array.from(document.querySelectorAll(".cms-specialties .w-dyn-item")).map(e => ({
    id: textFrom(e.querySelector("._wf-spec-id")),
    name: textFrom(e.querySelector("._wf-spec-name"))
  })), specialtyNameById = {}, (catalog.specialties || []).forEach(e => {
    var t = String(e.id || "").trim(),
      e = String(e.name || "").trim();
    t && e && (specialtyNameById[t] = e)
  }), catalog.providers = Array.from(document.querySelectorAll(".cms-providers .w-dyn-item")).map(e => {
    var t = parseFloat(textFrom(e.querySelector("._wf-lat"))),
      r = parseFloat(textFrom(e.querySelector("._wf-lng"))),
      a = Array.from(e.querySelectorAll("._wf-prov-proc-id")).map(e => textFrom(e)).filter(Boolean),
      o = Array.from(e.querySelectorAll("._wf-prov-spec-id")).map(e => textFrom(e)).filter(Boolean),
      i = e.querySelectorAll("._wf-active"),
      n = e.querySelectorAll("._wf-preferred"),
      i = boolFromNodes(i),
      n = boolFromNodes(n),
      i = null === i || i,
      n = null !== n && n;
    return {
      ProviderID: textFrom(e.querySelector("._wf-prov-id")),
      Slug: textFrom(e.querySelector("._wf-slug")),
      DoctorName: textFrom(e.querySelector("._wf-doctor")),
      PracticeName: textFrom(e.querySelector("._wf-practice")),
      Phone: textFrom(e.querySelector("._wf-phone")),
      ProviderEmail: textFrom(e.querySelector("._wf-email")),
      Website: safeHttpUrl(hrefFrom(e.querySelector("._wf-website")) || textFrom(e.querySelector("._wf-website"))),
      AddressLine1: textFrom(e.querySelector("._wf-address1")),
      City: textFrom(e.querySelector("._wf-city")),
      State: textFrom(e.querySelector("._wf-state")),
      ZIP: textFrom(e.querySelector("._wf-zip")),
      lat: Number.isFinite(t) ? t : null,
      lng: Number.isFinite(r) ? r : null,
      google_maps_url: safeHttpUrl(hrefFrom(e.querySelector("._wf-maps-url")) || textFrom(e.querySelector("._wf-maps-url"))),
      HighlightText: textFrom(e.querySelector("._wf-highlight")),
      LogoUrl: imgSrcFrom(e.querySelector("._wf-logo")),
      DoctorPhotoUrl: imgSrcFrom(e.querySelector("._wf-photo")),
      PreferredProvider: n,
      Active: i,
      procedure_ids: a,
      specialty_ids: o
    }
  }).filter(e => e.ProviderID && e.ProviderID.trim() || e.DoctorName && e.DoctorName.trim() || e.PracticeName && e.PracticeName.trim());
  let r = (CONFIG.allowedStates || []).map(e => String(e).toUpperCase());
  r.length && (catalog.providers = catalog.providers.filter(e => r.includes(String(e.State || "").toUpperCase()))), typeaheadItems = buildTypeaheadItems(catalog), console.log("CMS loaded:", {
    procedures: catalog.procedures.length,
    specialties: catalog.specialties.length,
    providers: catalog.providers.length
  })
}

function buildSuggestions(e) {
  let t = normTerm(e);
  return t.length < 1 ? [] : typeaheadItems.filter(e => e.searchText.includes(t)).slice(0, 20)
}

function showSuggestions(e, o = -1) {
  els.termSuggestions.innerHTML = "", e.length ? (e.forEach((t, e) => {
    var r = document.createElement("div"),
      e = (r.className = "suggestion", r.setAttribute("role", "option"), r.setAttribute("data-id", t.id), r.setAttribute("data-type", t.type), r.setAttribute("aria-selected", e === o ? "true" : "false"), document.createElement("div")),
      a = (e.className = "suggestion__name", e.textContent = t.name, document.createElement("div"));
    a.className = "suggestion__type", a.textContent = t.label, r.appendChild(e), r.appendChild(a);
    let n = e => {
      e.preventDefault(), commitSelection(t), hideSuggestions()
    };
    r.addEventListener("pointerdown", n), r.addEventListener("mousedown", n), els.termSuggestions.appendChild(r)
  }), els.termSuggestions.classList.remove("hidden")) : els.termSuggestions.classList.add("hidden")
}

function hideSuggestions() {
  els.termSuggestions.classList.add("hidden")
}

function commitSelection(e) {
  selectedTerm = {
    type: e.type,
    id: e.id,
    name: e.name
  }, lastCommittedTermValue = e.name, els.termInput.value = e.name, els.termError.classList.add("hidden"), updateClearButtons(), validateSearchButton()
}

function clearSelectionIfUserEdited() {
  var e = normalizeStr(els.termInput.value);
  selectedTerm && e !== lastCommittedTermValue && (selectedTerm = null)
}

function clearLocationIfUserEdited() {
  var e = normalizeLocationInput(els.locInput.value);
  selectedLocation && e !== normalizeLocationInput(lastCommittedLocationValue) && (selectedLocation = null)
}

function hasLocationInput() {
  return 0 < normalizeStr(els.locInput.value).length
}

function validateSearchButton() {
  els.searchBtn.disabled = !selectedTerm
}

function updateClearButtons() {
  var e;
  els.termClearBtn && (e = 0 < String(els.termInput.value || "").trim().length, els.termClearBtn.classList.toggle("hidden", !e)), els.locClearBtn && (e = 0 < String(els.locInput.value || "").trim().length, els.locClearBtn.classList.toggle("hidden", !e))
}

function showTermErrorIfNeeded() {
  var e, t = String(els.termInput.value || "").trim();
  !t || selectedTerm && selectedTerm.id ? els.termError.classList.add("hidden") : (0 === (e = buildSuggestions(t)).length ? (z_track("directory_term_invalid_no_match", {
    typed: normTerm(t).slice(0, 80),
    typed_len: t.length
  }), els.termError.textContent = "No matching procedures or specialties. Try a different term.") : (z_track("directory_term_invalid_not_selected", {
    typed: normTerm(t).slice(0, 80),
    typed_len: t.length,
    suggestions_count: e.length
  }), els.termError.textContent = "Please select a procedure or specialty from the list."), els.termError.classList.remove("hidden"))
}

function normalizeLocationInput(e) {
  return normalizeStr(e).toLowerCase().replace(/\s+/g, " ")
}

function readLocationCache() {
  try {
    var e = JSON.parse(localStorage.getItem(CONFIG.locationCacheKey) || "{}");
    return e && "object" == typeof e ? e : {}
  } catch (e) {
    return {}
  }
}

function getCachedLocation(e) {
  var t = normalizeLocationInput(e),
    r = readLocationCache()[t];
  return r && Date.now() - Number(r.cachedAt || 0) <= CONFIG.locationCacheTtlMs && Number.isFinite(r.lat) && Number.isFinite(r.lng) ? {
    displayName: r.displayName || e,
    city: r.city || null,
    state: r.state || null,
    postalCode: r.postalCode || null,
    country: "US",
    lat: r.lat,
    lng: r.lng,
    placeId: r.placeId || null,
    source: "manual-cache"
  } : null
}

function setCachedLocation(e, t) {
  try {
    var r = normalizeLocationInput(e);
    if (!r || !t || !Number.isFinite(t.lat) || !Number.isFinite(t.lng)) return;
    var a = readLocationCache();
    a[r] = {
      displayName: t.displayName,
      city: t.city,
      state: t.state,
      postalCode: t.postalCode,
      country: "US",
      lat: t.lat,
      lng: t.lng,
      placeId: t.placeId,
      source: t.source,
      cachedAt: Date.now()
    }, localStorage.setItem(CONFIG.locationCacheKey, JSON.stringify(a))
  } catch (e) {
    console.warn("Provider directory location cache unavailable.", e)
  }
}

function addressComponent(e, t, r = !1) {
  return (e = (e || []).find(e => Array.isArray(e.types) && e.types.includes(t))) ? r ? e.short_name || e.long_name || "" : e.long_name || e.short_name || "" : ""
}

function stateIsAllowed(e) {
  var t = (CONFIG.allowedStates || []).map(e => String(e || "").trim().toUpperCase()).filter(Boolean);
  return !t.length || t.includes(String(e || "").toUpperCase())
}

function locationFromGoogleResult(e, t) {
  var r = e?.address_components || [],
    a = addressComponent(r, "country", !0);
  if ("US" !== a) return null;
  var o = e?.geometry?.location,
    i = "function" == typeof o?.lat ? o.lat() : Number(o?.lat),
    o = "function" == typeof o?.lng ? o.lng() : Number(o?.lng);
  if (!Number.isFinite(i) || !Number.isFinite(o)) return null;
  var n = addressComponent(r, "locality") || addressComponent(r, "postal_town") || addressComponent(r, "sublocality") || addressComponent(r, "administrative_area_level_3"),
    l = addressComponent(r, "administrative_area_level_1", !0),
    r = addressComponent(r, "postal_code");
  return {
    displayName: e.formatted_address || e.name || [n, l, r].filter(Boolean).join(", "),
    city: n || null,
    state: l || null,
    postalCode: r || null,
    country: "US",
    lat: i,
    lng: o,
    placeId: e.place_id || null,
    source: t
  }
}

async function geocodeLocation(e) {
  try {
    await loadGoogleMaps();
    if (!window.google?.maps?.Geocoder) return console.warn("Google Geocoder is unavailable."), null;
    var t = new google.maps.Geocoder;
    return await new Promise(r => {
      t.geocode({
        address: e,
        componentRestrictions: {
          country: "US"
        }
      }, (e, t) => {
        if ("OK" !== t || !Array.isArray(e) || !e.length) return console.warn("Google Geocoding could not resolve location.", t), r(null);
        e = locationFromGoogleResult(e[0], "geocoding"), r(e && stateIsAllowed(e.state) ? e : null)
      })
    })
  } catch (e) {
    return console.warn("Google Geocoding failed.", e), null
  }
}

async function resolveLocation(e) {
  var t = normalizeStr(e);
  if (!t) return null;
  if (selectedLocation && normalizeLocationInput(t) === normalizeLocationInput(lastCommittedLocationValue)) return selectedLocation;
  if (e = getCachedLocation(t)) return e;
  return (e = await geocodeLocation(t)) ? (setCachedLocation(t, e), e) : null
}

function milesBetween(e, t, r, a) {
  var o = e => e * Math.PI / 180,
    i = o(r - e),
    a = o(a - t),
    t = Math.sin(i / 2) ** 2 + Math.cos(o(e)) * Math.cos(o(r)) * Math.sin(a / 2) ** 2;
  return 7917.6 * Math.asin(Math.sqrt(t))
}

function sortProviders(e, t = !1) {
  return e.sort((e, r) => {
    var a = e.PreferredProvider ? 1 : 0,
      o = r.PreferredProvider ? 1 : 0,
      i = Number(e._distMiles),
      n = Number(r._distMiles),
      l = normalizeStr(e.DoctorName),
      d = normalizeStr(r.DoctorName);
    return a != o ? o - a : t && Number.isFinite(i) && Number.isFinite(n) && i !== n ? i - n : 0 !== (l = l.localeCompare(d)) ? l : normalizeStr(e.PracticeName).localeCompare(normalizeStr(r.PracticeName))
  })
}

function filterProviders(e = null) {
  let t = new Set((CONFIG.allowedStates || []).map(e => String(e).toUpperCase()).filter(Boolean));
  var r = catalog.providers.filter(e => !0 === e.Active && (!t.size || t.has(String(e.State || "").toUpperCase()))).filter(e => !!selectedTerm && ("procedure" === selectedTerm.type ? Array.isArray(e.procedure_ids) && e.procedure_ids.includes(selectedTerm.id) : "specialty" === selectedTerm.type && Array.isArray(e.specialty_ids) && e.specialty_ids.includes(selectedTerm.id)));
  let a = Number(CONFIG.radiusMiles) || 20;
  return e && Number.isFinite(e.lat) && Number.isFinite(e.lng) ? sortProviders(r.map(t => {
    var r = Number(t.lat),
      o = Number(t.lng);
    return Number.isFinite(r) && Number.isFinite(o) && !(0 === r && 0 === o) ? (r = milesBetween(e.lat, e.lng, r, o), {
      ...t,
      _distMiles: r
    }) : null
  }).filter(Boolean).filter(e => e._distMiles <= a), !0) : sortProviders(r)
}

function getProviderSpecialtyLabel(e) {
  return selectedTerm && "specialty" === selectedTerm.type ? specialtyNameById[selectedTerm.id] || selectedTerm.name || "" : (e = Array.isArray(e.specialty_ids) ? e.specialty_ids[0] : "") && specialtyNameById[e] || ""
}

function renderResults(e = !0) {
  e && (els.listPane.innerHTML = "", renderedCount = 0, activeProviderId = null);
  var e = filteredProviders.length,
    t = (els.resultsCount.textContent = 1 === e ? "1 result" : e + " results", els.emptyState.classList.toggle("hidden", 0 !== e), filteredProviders.slice(renderedCount, renderedCount + CONFIG.resultsPageSize)),
    t = (t.forEach(e => els.listPane.appendChild(createProviderCard(e))), (renderedCount += t.length) < e);
  els.loadMoreBtn.classList.toggle("hidden", !t)
}

function createProviderCard(t) {
  var e = document.createElement("div"),
    r = (e.className = "card", getProviderKey(t)),
    r = (e.setAttribute("data-provider-id", r || String(t.ProviderID || "")), document.createElement("div"));
  r.className = "card__row card__row--header";
  let a = document.createElement("div");
  a.className = "card__photo";
  var o, i, n = getCardImageUrl(t),
    l = (n ? ((l = document.createElement("img")).className = "card__photoImg", l.src = n, l.alt = `${t.DoctorName||t.PracticeName||"Provider"} photo`, l.loading = "lazy", l.onerror = () => {
      a.innerHTML = "";
      var e = document.createElement("div");
      e.className = "card__photoFallback", e.textContent = getInitialsFromPracticeName(t.PracticeName), a.appendChild(e)
    }, a.appendChild(l)) : ((n = document.createElement("div")).className = "card__photoFallback", n.textContent = getInitialsFromPracticeName(t.PracticeName), a.appendChild(n)), document.createElement("div")),
    n = (l.className = "card__names", document.createElement("div")),
    d = (n.className = "card__doctor card__doctor--primary", n.textContent = t.DoctorName || "", getProviderSpecialtyLabel(t)),
    s = document.createElement("div"),
    c = (s.className = "card__specialty", s.textContent = d, document.createElement("div")),
    n = (c.className = "card__practice card__practice--secondary", c.textContent = t.PracticeName || "", t.DoctorName && l.appendChild(n), d && l.appendChild(s), t.PracticeName && l.appendChild(c), document.createElement("div")),
    s = (n.className = "card__badgeCol", t.PreferredProvider && ((d = document.createElement("div")).className = "badge", d.textContent = "Preferred Provider", n.appendChild(d)), r.appendChild(a), r.appendChild(l), r.appendChild(n), document.createElement("div")),
    c = (s.className = "card__row card__row--details", document.createElement("div")),
    l = (c.className = "card__details", t.Phone && ((d = document.createElement("div")).className = "detail", (l = document.createElement("span")).className = "detail__icon", l.innerHTML = iconPhoneSvg(), (n = document.createElement("a")).className = "detail__value", n.href = "tel:" + normalizePhoneForTel(t.Phone), n.addEventListener("click", e => e.stopPropagation()), n.textContent = t.Phone, d.appendChild(l), d.appendChild(n), c.appendChild(d)), t.AddressLine1 || t.City || t.State || t.ZIP),
    l = (l && ((n = document.createElement("div")).className = "detail detail--address", (d = document.createElement("span")).className = "detail__icon", d.innerHTML = iconPinSvg(), (l = document.createElement("div")).className = "detail__stack", t.AddressLine1 && ((i = document.createElement("div")).className = "addr__line", i.textContent = t.AddressLine1, l.appendChild(i)), (i = document.createElement("div")).className = "addr__line addr__line--muted", i.textContent = [t.City, t.State, t.ZIP].filter(Boolean).join(", "), l.appendChild(i), (i = document.createElement("div")).className = "addr__wrap", (o = document.createElement("div")).className = "addr__viewMap", o.innerHTML = iconGlobeSvg() + '<span class="addr__viewMapText">Map</span>', i.appendChild(l), i.appendChild(o), n.appendChild(d), n.appendChild(i), n.setAttribute("role", "button"), n.tabIndex = 0, n.addEventListener("click", e => {
      window.matchMedia("(max-width: 900px)").matches && (e.stopPropagation(), focusProviderOnMap(t))
    }), n.addEventListener("keydown", e => {
      !window.matchMedia("(max-width: 900px)").matches || "Enter" !== e.key && " " !== e.key || (e.preventDefault(), e.stopPropagation(), focusProviderOnMap(t))
    }), c.appendChild(n), (l = document.createElement("a")).className = "directions", l.href = getDirectionsUrl(t), l.target = "_blank", l.rel = "noreferrer", l.addEventListener("click", e => e.stopPropagation()), l.textContent = "Get directions", c.appendChild(l)), t.Website && ((o = document.createElement("div")).className = "detail", (d = document.createElement("span")).className = "detail__icon", d.innerHTML = iconGlobeSvg(), (i = document.createElement("a")).className = "detail__value", i.href = t.Website, i.target = "_blank", i.rel = "noreferrer", i.addEventListener("click", e => e.stopPropagation()), i.textContent = "Website", o.appendChild(d), o.appendChild(i), c.appendChild(o)), t.HighlightText && ((n = document.createElement("div")).className = "card__highlight", n.textContent = String(t.HighlightText).slice(0, 500), c.appendChild(n)), s.appendChild(c), document.createElement("div")),
    d = (l.className = "card__row card__row--actions", document.createElement("button"));
  return d.className = "button", d.type = "button", d.textContent = "Request appointment", d.addEventListener("click", e => {
    e.stopPropagation(), openJotformModal(t)
  }), l.appendChild(d), e.appendChild(r), e.appendChild(s), e.appendChild(l), e.addEventListener("click", () => {
    window.matchMedia("(max-width: 900px)").matches || focusProviderOnMap(t)
  }), e
}

function setActiveCard(t) {
  activeProviderId = t, els.listPane.querySelectorAll(".card").forEach(e => e.classList.toggle("card--active", e.getAttribute("data-provider-id") === t))
}

function scrollCardIntoView(e) {
  e = els.listPane.querySelector(`.card[data-provider-id="${cssEscape(e)}"]`);
  e && e.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  })
}

function getDirectionsUrl(e) {
  var t = String(e?.google_maps_url || "").trim();
  return t || ((t = [String(e?.AddressLine1 || "").trim(), String(e?.City || "").trim(), String(e?.State || "").trim(), String(e?.ZIP || "").trim()].filter(Boolean)).length ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(t.join(", ")) : "https://www.google.com/maps")
}

function buildMapPopupContent(t) {
  var e = document.createElement("div"),
    r = (e.className = "map-card", document.createElement("div")),
    a = (r.className = "map-card__header", document.createElement("div")),
    o = (a.className = "map-card__avatar", getCardImageUrl(t));
  let i = document.createElement("div");
  i.className = "map-card__avatar-fallback";
  var n = (t.DoctorName || t.PracticeName || "").split(",")[0].trim();
  if (i.textContent = getInitialsFromPracticeName(n || "Provider"), o) {
    let e = document.createElement("img");
    e.className = "map-card__avatar-img", e.src = o, e.alt = t.DoctorName || "Provider", e.loading = "lazy", e.addEventListener("error", () => {
      e.remove(), i.style.display = "flex"
    }), a.appendChild(e), i.style.display = "none"
  }
  a.appendChild(i);
  var n = document.createElement("div"),
    o = (n.className = "map-card__head", document.createElement("div")),
    l = (o.className = "map-card__title", o.textContent = t.DoctorName || t.PracticeName || "", getProviderSpecialtyLabel(t)),
    d = document.createElement("div"),
    s = (d.className = "map-card__specialty", d.textContent = l, document.createElement("div")),
    o = (s.className = "map-card__practice", s.textContent = t.DoctorName && t.PracticeName || "", n.appendChild(o), l && n.appendChild(d), s.textContent && n.appendChild(s), r.appendChild(a), r.appendChild(n), document.createElement("div")),
    l = (o.className = "map-card__meta", [t.City, t.State].filter(Boolean).join(", ")),
    d = document.createElement("div"),
    s = (d.className = "map-card__metaLine", d.textContent = l || "", document.createElement("div")),
    a = (s.className = "map-card__metaLine", s.textContent = t.Phone || "", d.textContent && o.appendChild(d), s.textContent && o.appendChild(s), document.createElement("div")),
    n = (a.className = "map-card__actions", document.createElement("button")),
    l = (n.className = "map-card__btn map-card__btn--primary", n.textContent = "Request appointment", n.addEventListener("click", e => {
      e.stopPropagation(), openJotformModal(t)
    }), document.createElement("div")),
    d = (l.className = "map-card__actionsRow", document.createElement("a"));
  return d.className = "map-card__btn map-card__btn--secondary", d.textContent = "Directions", d.href = getDirectionsUrl(t), d.target = "_blank", d.rel = "noopener", d.addEventListener("click", () => {
    z_track("provider_directions_click", z_ctx(t))
  }), l.appendChild(d), t.Phone && ((s = document.createElement("a")).className = "map-card__btn map-card__btn--secondary", s.textContent = "Call", s.href = "tel:" + normalizePhoneForTel(t.Phone), l.appendChild(s), s.addEventListener("click", () => {
    z_track("provider_call_click", z_ctx(t))
  })), a.appendChild(n), a.appendChild(l), e.appendChild(r), o.childElementCount && e.appendChild(o), e.appendChild(a), e
}

function setMapVisibility(e) {
  e ? els.mapPane.classList.remove("hidden") : els.mapPane.classList.add("hidden")
}

function loadGoogleMaps() {
  return new Promise((e, t) => {
    var r;
    window.google && window.google.maps ? e() : (r = document.getElementById("gmaps-script")) ? (r.addEventListener("load", () => e()), r.addEventListener("error", () => t(new Error("Google Maps failed to load")))) : ((r = document.createElement("script")).id = "gmaps-script", r.async = !0, r.defer = !0, r.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(CONFIG.googleMapsApiKey) + "&libraries=places", r.onload = () => e(), r.onerror = () => t(new Error("Google Maps failed to load")), document.head.appendChild(r))
  })
}
async function initMapIfNeeded() {
  map || (await loadGoogleMaps(), map = new google.maps.Map(els.mapEl, {
    center: {
      lat: 27.95,
      lng: -82.46
    },
    zoom: 6,
    mapTypeControl: !1,
    fullscreenControl: !1,
    streetViewControl: !1
  }), infoWindow = new google.maps.InfoWindow({
    pixelOffset: new google.maps.Size(0, -12),
    maxWidth: 360
  }))
}

async function initLocationAutocomplete() {
  if (els.locInput) try {
    await loadGoogleMaps();
    if (!window.google?.maps?.places?.Autocomplete) return console.warn("Google Places Autocomplete is unavailable.");
    var e = new google.maps.places.Autocomplete(els.locInput, {
      componentRestrictions: {
        country: "us"
      },
      fields: ["address_components", "formatted_address", "geometry", "name", "place_id", "types"],
      types: ["(regions)"]
    });
    e.addListener("place_changed", () => {
      var t = locationFromGoogleResult(e.getPlace(), "places");
      t && stateIsAllowed(t.state) && Number.isFinite(t.lat) && Number.isFinite(t.lng) ? (selectedLocation = t, lastCommittedLocationValue = els.locInput.value || t.displayName, setCachedLocation(lastCommittedLocationValue, t)) : (selectedLocation = null, lastCommittedLocationValue = "", console.warn("Selected Google place could not be used as a US location."))
    })
  } catch (e) {
    console.warn("Google Places Autocomplete failed to initialize.", e)
  }
}

function clearMarkers() {
  for (var [e, t] of markersByProviderId.entries()) t.setMap(null);
  markersByProviderId.clear(), infoWindow && infoWindow.close()
}

function fitMapToProviders(r) {
  if (map && window.google?.maps) {
    r = Array.isArray(r) ? r : [];
    if (0 !== r.length) {
      var a, o = new google.maps.LatLngBounds;
      let e = 0,
        t = null;
      for (a of r) {
        var i = Number(a.lat),
          n = Number(a.lng);
        Number.isFinite(i) && Number.isFinite(n) && (0 === i && 0 === n || (o.extend({
          lat: i,
          lng: n
        }), e++, t = {
          lat: i,
          lng: n
        }))
      }
      0 !== e && (1 === e && t ? (map.setCenter(t), map.setZoom(CONFIG.defaultZoomOnSelect)) : (map.fitBounds(o, 40), google.maps.event.addListenerOnce(map, "idle", () => {
        15 < map.getZoom() && map.setZoom(15)
      })))
    }
  }
}

function getProviderKey(e) {
  var t = e?.ProviderID ?? e?.ProviderId ?? e?.providerId ?? e?.id ?? e?._id ?? e?.slug ?? e?.Slug ?? e?.PracticeSlug ?? e?.practiceSlug ?? null;
  return t ? String(t) : (t = [normalizeStr(e?.DoctorName || ""), normalizeStr(e?.PracticeName || ""), normalizeStr(e?.City || ""), normalizeStr(e?.State || "")].filter(Boolean)).length ? t.join("|") : null
}

function renderMapPins(e) {
  clearMarkers(), e.forEach(t => {
    let r = new google.maps.Marker({
        position: {
          lat: t.lat,
          lng: t.lng
        },
        map: map,
        title: t.PracticeName
      }),
      a = getProviderKey(t);
    a && markersByProviderId.set(a, r), r.addListener("click", () => {
      a && (setActiveCard(a), scrollCardIntoView(a)), z_track("provider_pin_click", z_ctx(t));
      var e = buildMapPopupContent(t);
      infoWindow.setContent(e), infoWindow.open({
        anchor: r,
        map: map
      })
    })
  }), pendingFitProviders = e
}

function focusProviderOnMap(e) {
  var t, r;
  map && e && (r = getProviderKey(e)) && (t = markersByProviderId.get(r)) && (setActiveCard(r), map.panTo({
    lat: e.lat,
    lng: e.lng
  }), map.setZoom(CONFIG.defaultZoomOnSelect), window.matchMedia("(max-width: 768px)").matches && setMobileView("map"), r = buildMapPopupContent(e), infoWindow.setContent(r), infoWindow.open({
    anchor: t,
    map: map
  }))
}

function ensureModalMountedToBody() {
  els.modalOverlay && els.modalOverlay.parentElement !== document.body && document.body.appendChild(els.modalOverlay)
}

function openJotformModal(e) {
  z_track("provider_request_appointment_click", z_ctx(e));
  var t = normalizeStr(els.locInput.value),
    r = getUtmParams(),
    e = new URLSearchParams({
      provider_id: e.ProviderID,
      provider_email: e.ProviderEmail,
      practice_name: e.PracticeName,
      doctor_name: e.DoctorName,
      selected_term: selectedTerm ? selectedTerm.name : "",
      selected_type: selectedTerm ? selectedTerm.type : "",
      location_input: t,
      page_url: window.location.href,
      utm_source: r.utm_source,
      utm_medium: r.utm_medium,
      utm_campaign: r.utm_campaign,
      utm_content: r.utm_content,
      utm_term: r.utm_term,
      embed: "1"
    }),
    t = CONFIG.jotformBaseUrl + "?" + e.toString();
  ensureModalMountedToBody(), els.jotformFrame.src = t, els.modalOverlay.classList.remove("hidden"), els.modalOverlay.setAttribute("aria-hidden", "false"), document.body.style.overflow = "hidden"
}

function closeModal() {
  els.modalOverlay.classList.add("hidden"), els.modalOverlay.setAttribute("aria-hidden", "true"), els.jotformFrame.src = "about:blank", document.body.style.overflow = ""
}

function showResultsSection() {
  els.resultsSection.classList.remove("hidden"), setMapVisibility(!1)
}

function formatTermForMeta(e) {
  var t;
  return e && (t = String(e.name || "").trim()) ? "procedure" === e.type ? "providers offering " + t : "specialty" === e.type ? t + " providers" : "providers" : "providers"
}

function getProviderFromUrlParam() {
  var e = new URLSearchParams(window.location.search),
    t = e.get("provider") || e.get("p") || e.get("slug");
  return t ? String(t).trim() : ""
}
async function showProviderFromUrl() {
  var e = getProviderFromUrlParam();
  if (!e) return !1;
  var t = e.toLowerCase(),
    r = catalog.providers.find(e => String(e.Slug || "").trim().toLowerCase() === t || String(e.ProviderID || "").trim().toLowerCase() === t);
  showResultsSection(), els.searchMeta.classList.remove("hidden"), selectedTerm = null, filteredProviders = r ? [r] : [], renderedCount = 0, activeProviderId = null, els.listPane.innerHTML = "", clearMarkers(), renderResults(!0);
  if (!r) return setMapVisibility(!1), els.searchMeta.textContent = "Provider not found.", !0;
  els.searchMeta.textContent = "Showing provider: " + (r.DoctorName || r.PracticeName || "Provider");
  var a = Number.isFinite(r.lat) && Number.isFinite(r.lng) && !(0 === r.lat && 0 === r.lng);
  return a ? (setMapVisibility(!0), await initMapIfNeeded(), renderMapPins([r]), setTimeout(() => {
    google.maps.event.trigger(map, "resize"), focusProviderOnMap(r)
  }, 100)) : setMapVisibility(!1), !0
}
async function runSearch() {
  els.searchMeta.textContent = "", els.searchMeta.classList.add("hidden"), clearSelectionIfUserEdited(), clearLocationIfUserEdited(), showTermErrorIfNeeded(), validateSearchButton();
  let e = ++searchRunId;
  if (activeProviderId = null, pendingFitProviders = null, renderedCount = 0, els.listPane.innerHTML = "", clearMarkers(), selectedTerm) {
    let t = hasLocationInput() ? await resolveLocation(normalizeStr(els.locInput.value)) : null;
    if (hasLocationInput() && !t) return selectedLocation = null, filteredProviders = [], showResultsSection(), setMapVisibility(!1), renderResults(!0), els.searchMeta.classList.remove("hidden"), els.searchMeta.textContent = "We couldn’t recognize that location. Try a city, state, or ZIP code.", z_track("directory_search_submit", {
      ...z_ctx(),
      location_resolved: 0,
      results_count: 0
    }), z_track("directory_search_zero_results", {
      ...z_ctx(),
      location_resolved: 0,
      results_count: 0
    });
    selectedLocation = t, t && (lastCommittedLocationValue = els.locInput.value || t.displayName), filteredProviders = filterProviders(t), z_track("directory_search_submit", {
      ...z_ctx(),
      results_count: filteredProviders.length
    }), z_track("directory_search_results", {
      ...z_ctx(),
      results_count: filteredProviders.length
    }), 0 === filteredProviders.length && z_track("directory_search_zero_results", {
      ...z_ctx(),
      results_count: 0
    }), showResultsSection(), filteredProviders.length ? (setMapVisibility(!0), await initMapIfNeeded(), t && Number.isFinite(t.lat) && Number.isFinite(t.lng) && (map.setCenter({
      lat: t.lat,
      lng: t.lng
    }), map.setZoom(10)), (a = filteredProviders.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng) && !(0 === e.lat && 0 === e.lng))).length ? renderMapPins(a) : (setMapVisibility(!1), clearMarkers()), setTimeout(() => {
      searchRunId === e && google.maps.event.trigger(map, "resize")
    }, 100)) : (setMapVisibility(!1), clearMarkers()), renderResults(!0), els.searchMeta.classList.remove("hidden");
    var r = t?.displayName || normalizeStr(els.locInput.value);
    els.searchMeta.textContent = t ? 0 === filteredProviders.length ? `No matches within ${CONFIG.radiusMiles||20} miles of ${r}.` : `Searching for: ${selectedTerm.name} within ${CONFIG.radiusMiles||20} miles of ${r}.` : 0 === filteredProviders.length ? `No matching ${formatTermForMeta(selectedTerm)} found yet.` : `Showing ${formatTermForMeta(selectedTerm)}. Add a city or ZIP to narrow the results.`
  }
}

function setMobileView(e) {
  var t = window.matchMedia("(max-width: 768px)").matches,
    r = document.body.classList.contains("mobile-view--map");
  t && "map" === e && !r && (savedWindowScrollY = window.scrollY || 0, document.body.style.position = "fixed", document.body.style.top = `-${savedWindowScrollY}px`, document.body.style.left = "0", document.body.style.right = "0", document.body.style.width = "100%");
  if (t && "list" === e && r) {
    r = document.body.style.top;
    document.body.style.position = "", document.body.style.top = "", document.body.style.left = "", document.body.style.right = "", document.body.style.width = "";
    let e = r ? Math.abs(parseInt(r, 10)) : savedWindowScrollY;
    requestAnimationFrame(() => {
      window.scrollTo(0, e || 0)
    })
  }
  t || (document.body.style.position = "", document.body.style.top = "", document.body.style.left = "", document.body.style.right = "", document.body.style.width = "");
  isMobileMapView = "map" === e, document.body.classList.toggle("mobile-view--list", "list" === e), document.body.classList.toggle("mobile-view--map", "map" === e);
  t = document.getElementById("mobileViewToggle");
  t && (t.textContent = "map" === e ? "List" : "Map"), "map" === e && map && window.google?.maps && setTimeout(() => {
    google.maps.event.trigger(map, "resize"), !activeProviderId && pendingFitProviders && pendingFitProviders.length && (fitMapToProviders(pendingFitProviders), pendingFitProviders = null)
  }, 150)
}

function initMobileViewToggle() {
  var e = document.getElementById("mobileViewToggle"),
    t = window.matchMedia("(max-width: 768px)");
  e && (t.matches && setMobileView("list"), e.addEventListener("click", () => {
    setMobileView(document.body.classList.contains("mobile-view--map") ? "list" : "map")
  }), t.addEventListener("change", e => {
    e.matches ? document.body.classList.contains("mobile-view--map") || setMobileView("list") : setMobileView("list")
  }))
}

function nudgeSearchCardForIOS() {
  var e, t;
  window.matchMedia("(max-width: 768px)").matches && (t = (t = window.visualViewport) ? t.height : window.innerHeight, e = document.querySelector(".search")) && (40 < (e = e.getBoundingClientRect().top - 12) && window.scrollBy({
    top: e,
    left: 0,
    behavior: "smooth"
  }), e = document.getElementById("termSuggestions")) && !e.classList.contains("hidden") && (e = e.getBoundingClientRect()).bottom > (t = t - 24) && window.scrollBy({
    top: e.bottom - t,
    left: 0,
    behavior: "smooth"
  })
}

function wireEvents() {
  let t = -1,
    r = [];
  els.termInput.addEventListener("input", () => {
    clearSelectionIfUserEdited(), validateSearchButton();
    var e = els.termInput.value;
    r = buildSuggestions(e), t = -1, showSuggestions(r, t), nudgeSearchCardForIOS(), updateClearButtons()
  }), els.termInput.addEventListener("focus", () => {
    var e = els.termInput.value;
    showSuggestions(r = buildSuggestions(e), t), setTimeout(nudgeSearchCardForIOS, 50)
  }), els.termInput.addEventListener("blur", () => {
    setTimeout(() => {
      hideSuggestions(), showTermErrorIfNeeded(), validateSearchButton()
    }, 120)
  }), els.termInput.addEventListener("keydown", e => {
    els.termSuggestions.classList.contains("hidden") || ("ArrowDown" === e.key ? (e.preventDefault(), t = Math.min(t + 1, r.length - 1), showSuggestions(r, t)) : "ArrowUp" === e.key ? (e.preventDefault(), t = Math.max(t - 1, 0), showSuggestions(r, t)) : "Enter" === e.key ? (e.preventDefault(), (0 <= t && r[t] ? (commitSelection(r[t]), hideSuggestions(), validateSearchButton) : showTermErrorIfNeeded)()) : "Escape" === e.key && hideSuggestions())
  }), els.locInput.addEventListener("input", () => {
    clearLocationIfUserEdited(), validateSearchButton(), updateClearButtons()
  }), els.termClearBtn && els.termClearBtn.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation(), els.termInput.value = "", selectedTerm = null, lastCommittedTermValue = "", els.termError.classList.add("hidden"), hideSuggestions(), validateSearchButton(), updateClearButtons(), els.termInput.focus()
  }), els.locClearBtn && els.locClearBtn.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation(), els.locInput.value = "", selectedLocation = null, lastCommittedLocationValue = "", validateSearchButton(), updateClearButtons(), els.locInput.focus()
  }), els.searchBtn.addEventListener("click", async () => {
    els.termInput.blur(), els.locInput.blur(), hideSuggestions(), window.matchMedia("(max-width: 768px)").matches && setMobileView("list"), await runSearch()
  }), els.loadMoreBtn.addEventListener("click", () => {
    renderResults(!1)
  }), els.modalCloseBtn.addEventListener("click", closeModal), els.modalOverlay.addEventListener("click", e => {
    e.target === els.modalOverlay && closeModal()
  }), document.addEventListener("keydown", e => {
    "Escape" !== e.key || els.modalOverlay.classList.contains("hidden") || closeModal()
  })
}
async function init() {
  els.locInput && (els.locInput.placeholder = "City, state, or ZIP (optional)"), await loadData(), wireEvents(), initMobileViewToggle(), initLocationAutocomplete(), validateSearchButton(), updateClearButtons(), await showProviderFromUrl()
}
window.Webflow = window.Webflow || [], window.Webflow.push(() => {
  init().catch(e => {
    console.error(e), alert("Failed to initialize directory. Check console for details.")
  })
});
