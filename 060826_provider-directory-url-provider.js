let CONFIG = {
    zipLookupUrl: "https://cdn.prod.website-files.com/68348ae3afc011c49c02e2b1/69715127417a25050cdefa0b_fl_zips.txt",
    googleMapsApiKey: "AIzaSyBKchVbGjHCgv54VaEU_FDj3X6ooGHTMVA",
    jotformBaseUrl: "https://form.jotform.com/260184280896364",
    allowedStates: ["FL"],
    resultsPageSize: 20,
    radiusMiles: 20,
    defaultZoomOnSelect: 15
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
  specialtyNameById = {},
  zipLookup = {},
  zipLookupLoaded = !1,
  floridaCitySet = null,
  floridaCityCentroids = null;

function ensureFloridaCityCentroids() {
  if (!floridaCityCentroids) {
    floridaCityCentroids = new Map;
    var e, t, r, a, o, i, n, l = zipLookup?.z || {},
      d = "number" == typeof zipLookup?.s ? zipLookup.s : 1e4,
      s = new Map;
    for (e of Object.values(l)) !Array.isArray(e) || e.length < 3 || (a = "number" == typeof(a = e[0]) && zipLookup?.c?.[a] || "") && (t = "number" == typeof e[1] ? e[1] / d : null, r = "number" == typeof e[2] ? e[2] / d : null, Number.isFinite(t)) && Number.isFinite(r) && (a = normalizeCity(a), (o = s.get(a) || {
      sumLat: 0,
      sumLng: 0,
      count: 0
    }).sumLat += t, o.sumLng += r, o.count += 1, s.set(a, o));
    for ([i, n] of s.entries()) n.count && floridaCityCentroids.set(i, {
      lat: n.sumLat / n.count,
      lng: n.sumLng / n.count
    })
  }
}

function ensureFloridaCitySet() {
  if (!floridaCitySet) {
    var e;
    floridaCitySet = new Set;
    for (e of Array.isArray(zipLookup?.c) ? zipLookup.c : []) {
      var t = normalizeCity(e);
      t && floridaCitySet.add(t)
    }
  }
}

function isFloridaCityName(e) {
  return ensureFloridaCitySet(), !!floridaCitySet && 0 < floridaCitySet.size && floridaCitySet.has(normalizeCity(e))
}
let typeaheadItems = [],
  selectedTerm = null,
  lastCommittedTermValue = "",
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
  var t = z_sanitizeLoc(els?.locInput?.value || "");
  return {
    term_name: selectedTerm?.name || "",
    term_type: selectedTerm?.type || "",
    term_id: selectedTerm?.id || "",
    loc_input: t,
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

function isZip(e) {
  e = normalizeStr(e);
  return /^[0-9]{5}(-[0-9]{4})?$/.test(e)
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
  try {
    var e = await fetch(CONFIG.zipLookupUrl, {
      cache: "no-store"
    });
    if (!e.ok) throw new Error("ZIP lookup failed");
    var t = await e.text();
    zipLookup = JSON.parse(t), zipLookupLoaded = !!(zipLookup && zipLookup.z && zipLookup.c)
  } catch (e) {
    zipLookup = {}, zipLookupLoaded = !1
  }
  floridaCitySet = null, floridaCityCentroids = null, catalog.procedures = Array.from(document.querySelectorAll(".cms-procedures .w-dyn-item")).map(e => ({
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
    a.className = "suggestion__type", a.textContent = t.label, r.appendChild(e), r.appendChild(a), r.addEventListener("mousedown", e => {
      e.preventDefault(), commitSelection(t), hideSuggestions(), validateSearchButton()
    }), els.termSuggestions.appendChild(r)
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
  }, lastCommittedTermValue = e.name, els.termInput.value = e.name, els.termError.classList.add("hidden"), updateClearButtons()
}

function clearSelectionIfUserEdited() {
  var e = normalizeStr(els.termInput.value);
  selectedTerm && e !== lastCommittedTermValue && (selectedTerm = null)
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

function toTitleCase(e) {
  return String(e || "").trim().toLowerCase().split(/\s+/).filter(Boolean).map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(" ")
}

function resolveFloridaLocation(e) {
  var t, r, a, o, e = normalizeStr(e);
  return isZip(e) ? (t = zipLookup?.z?.[e], Array.isArray(t) && !(t.length < 3) && (r = "number" == typeof zipLookup?.s ? zipLookup.s : 1e4, a = "number" == typeof(a = t[0]) && zipLookup?.c?.[a] || "") ? (o = "number" == typeof t[1] ? t[1] / r : null, t = "number" == typeof t[2] ? t[2] / r : null, {
    mode: "zip",
    recognized: !0,
    input: e,
    city: normalizeCity(a),
    displayCity: toTitleCase(a),
    state: "FL",
    lat: o,
    lng: t
  }) : {
    mode: "zip",
    recognized: !1,
    input: e,
    displayCity: e,
    state: "FL",
    lat: null,
    lng: null
  }) : (r = toTitleCase(e), a = normalizeCity(e), ensureFloridaCityCentroids(), o = floridaCityCentroids ? floridaCityCentroids.get(a) : null, {
    mode: "city",
    recognized: isFloridaCityName(e),
    input: e,
    city: a,
    displayCity: r,
    state: "FL",
    lat: o ? o.lat : null,
    lng: o ? o.lng : null
  })
}

function milesBetween(e, t, r, a) {
  var o = e => e * Math.PI / 180,
    i = o(r - e),
    a = o(a - t),
    t = Math.sin(i / 2) ** 2 + Math.cos(o(e)) * Math.cos(o(r)) * Math.sin(a / 2) ** 2;
  return 7917.6 * Math.asin(Math.sqrt(t))
}

function filterProviders() {
  let a = hasLocationInput() ? resolveFloridaLocation(normalizeStr(els.locInput.value)) : null;
  if (a && !a.recognized) return [];
  let t = new Set((CONFIG.allowedStates || []).map(e => String(e).toUpperCase()));
  var e = catalog.providers.filter(e => !0 === e.Active && t.has(String(e.State || "").toUpperCase())).filter(e => !!selectedTerm && ("procedure" === selectedTerm.type ? Array.isArray(e.procedure_ids) && e.procedure_ids.includes(selectedTerm.id) : "specialty" === selectedTerm.type && Array.isArray(e.specialty_ids) && e.specialty_ids.includes(selectedTerm.id)));
  let r = Number(CONFIG.radiusMiles) || 20,
    o = [];
  return 0 < (o = a && Number.isFinite(a.lat) && Number.isFinite(a.lng) ? e.map(e => {
    var t = Number(e.lat),
      r = Number(e.lng);
    return Number.isFinite(t) && Number.isFinite(r) ? (t = milesBetween(a.lat, a.lng, t, r), {
      ...e,
      _distMiles: t
    }) : null
  }).filter(Boolean).filter(e => e._distMiles <= r) : o).length ? (o.sort((e, t) => {
    var r = e.PreferredProvider ? 1 : 0,
      a = t.PreferredProvider ? 1 : 0;
    return r != a || (a = Number(e._distMiles), r = Number(t._distMiles), Number.isFinite(a) && Number.isFinite(r) && a !== r) ? a - r : (a = normalizeStr(e.DoctorName), r = normalizeStr(t.DoctorName), 0 !== (a = a.localeCompare(r)) ? a : normalizeStr(e.PracticeName).localeCompare(normalizeStr(t.PracticeName)))
  }), o) : ((e = e).sort((e, t) => {
    var r = e.PreferredProvider ? 1 : 0,
      a = t.PreferredProvider ? 1 : 0;
    return r != a ? a - r : (a = normalizeStr(e.DoctorName), r = normalizeStr(t.DoctorName), 0 !== (a = a.localeCompare(r)) ? a : normalizeStr(e.PracticeName).localeCompare(normalizeStr(t.PracticeName)))
  }), e)
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
    window.google && window.google.maps ? e() : (r = document.getElementById("gmaps-script")) ? (r.addEventListener("load", () => e()), r.addEventListener("error", () => t(new Error("Google Maps failed to load")))) : ((r = document.createElement("script")).id = "gmaps-script", r.async = !0, r.defer = !0, r.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(CONFIG.googleMapsApiKey), r.onload = () => e(), r.onerror = () => t(new Error("Google Maps failed to load")), document.head.appendChild(r))
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
  els.searchMeta.textContent = "", els.searchMeta.classList.add("hidden"), clearSelectionIfUserEdited(), showTermErrorIfNeeded(), validateSearchButton();
  let e = ++searchRunId;
  if (activeProviderId = null, pendingFitProviders = null, renderedCount = 0, els.listPane.innerHTML = "", clearMarkers(), selectedTerm) {
    let t = hasLocationInput() ? resolveFloridaLocation(normalizeStr(els.locInput.value)) : null;
    filteredProviders = filterProviders(), z_track("directory_search_submit", {
      ...z_ctx(),
      loc_mode: t?.mode || "",
      loc_recognized: t?.recognized ? 1 : 0
    }), z_track("directory_search_results", {
      ...z_ctx(),
      loc_mode: t?.mode || "",
      loc_recognized: t?.recognized ? 1 : 0,
      results_count: filteredProviders.length
    }), 0 === filteredProviders.length && z_track("directory_search_zero_results", {
      ...z_ctx(),
      loc_mode: t?.mode || "",
      loc_recognized: t?.recognized ? 1 : 0
    }), showResultsSection(), filteredProviders.length ? (setMapVisibility(!0), await initMapIfNeeded(), t && "zip" === t.mode && t.lat && t.lng && (map.setCenter({
      lat: t.lat,
      lng: t.lng
    }), map.setZoom(10)), (a = filteredProviders.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng) && !(0 === e.lat && 0 === e.lng))).length ? renderMapPins(a) : (setMapVisibility(!1), clearMarkers()), setTimeout(() => {
      searchRunId === e && google.maps.event.trigger(map, "resize")
    }, 100)) : (setMapVisibility(!1), clearMarkers()), renderResults(!0), els.searchMeta.classList.remove("hidden");
    var r, a = Array.isArray(CONFIG.allowedStates) && 1 === CONFIG.allowedStates.length && "FL" === String(CONFIG.allowedStates[0]).toUpperCase();
    t ? t.recognized ? (r = "" + t.displayCity, 0 === filteredProviders.length ? els.searchMeta.textContent = `No matches within ${CONFIG.radiusMiles||20} miles of ${r}.` : filteredProviders.some(e => normalizeCity(e.City) === t.city) ? els.searchMeta.textContent = `Searching for: ${selectedTerm.name} within ${CONFIG.radiusMiles||20} miles of ` + r : (a = formatTermForMeta(selectedTerm), els.searchMeta.textContent = `No providers within ${CONFIG.radiusMiles||20} miles of ${r} yet. Showing ${a} in Florida.`)) : "zip" === t.mode ? els.searchMeta.textContent = "ZIP not recognized in Florida yet. Try a Florida city or ZIP." : els.searchMeta.textContent = `Right now this directory is Florida-only. "${t.displayCity}" doesn’t look like a Florida location. Try a Florida city or ZIP.` : els.searchMeta.textContent = 0 === filteredProviders.length ? `No matching ${formatTermForMeta(selectedTerm)} found in Florida yet.` : `Showing ${formatTermForMeta(selectedTerm)} in Florida. Add a city or ZIP to narrow the results.`
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
    validateSearchButton(), updateClearButtons()
  }), els.termClearBtn && els.termClearBtn.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation(), els.termInput.value = "", selectedTerm = null, lastCommittedTermValue = "", els.termError.classList.add("hidden"), hideSuggestions(), validateSearchButton(), updateClearButtons(), els.termInput.focus()
  }), els.locClearBtn && els.locClearBtn.addEventListener("click", e => {
    e.preventDefault(), e.stopPropagation(), els.locInput.value = "", validateSearchButton(), updateClearButtons(), els.locInput.focus()
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
  els.locInput && (els.locInput.placeholder = "City or ZIP (optional)"), await loadData(), wireEvents(), initMobileViewToggle(), validateSearchButton(), updateClearButtons(), await showProviderFromUrl()
}
window.Webflow = window.Webflow || [], window.Webflow.push(() => {
  init().catch(e => {
    console.error(e), alert("Failed to initialize directory. Check console for details.")
  })
});
