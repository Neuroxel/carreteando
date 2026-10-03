# Frontend acceptance · 2026-10-02

## Identity and scope

Repository: Neuroxel/carreteando. Frozen production/main base: `9d92d1438f68bdd0518bbee7d574a539c993a695` (local and remote verified). Dedicated branch: `feat/frontend-final-october`. Deployed application commit: `a12d0147444404faad6d39e86e174f27c4c328be`. Later commits contain review evidence only.

Preview: https://carreteando-6yhfvnvx3-neuroxel.vercel.app
Deployment: `dpl_DpsPD6Yxzj8D9dMKFW8amfyejGQs`.

Assessment: **READY FOR CARLOS REVIEW**, not merge/production approval. No scraping, cron, source adapter, schema, evidence-engine or trust-rule changes. Production was not promoted or merged. A seven-day, deployment-scoped Vercel share link was generated for review; the project remains protected. The temporary URL and automation credentials are not committed.

## Visual and functional checks

- Production inspected first; repeated browser review after major design revisions.
- Home at 360×800, 375×812, 390×844, 412×915, 430×932, 768×1024, 1024×900, 1440×1000. No horizontal page overflow. At 390×844, real artwork starts around y=450–465, with brand, location, search and all four date choices visible first.
- Single-column mobile event cards; two columns at tablet size; three on desktop. No carousels added. Official artwork uses `contain` with fixed frames and no badge overlay or zoom crop.
- Mobile: Home, Explore events, Explore places, Map, marker popup, Event and Venue. Desktop: Home, Explore, Event. Screenshots in `screenshots/` and `index.html`.
- Real long title: Tuna Femenina y Tuna de Facultad de Artes de la Universidad de Playa Ancha. Short title and unknown price: Estoy Bien. Search verified at 0, 1 and 26 event results; places at 0, 1 and 93 results. Bar Oui Oui exercises no Instagram/no coordinate layout. Venue map matches selected event results and preserves local state.
- Broken-image test: a local recording proxy returns 404 only for image optimization requests; real event text remains. Honest typographic fallback observed and captured. No fixture or fake event was published.
- Share URL regression fixed: venue shares previously pointed to `/evento/lugar%2F...`; dedicated tests cover the venue route and encoded event identifiers. Sharing simplified to native share with clipboard/manual fallback.
- Keyboard focus styles and native disclosure checked; Lighthouse accessibility 100 on all three pages. Reduced-motion CSS disables movement. No new font download, framework or dependency.
- All 128 tests pass. Final build passes including lint/type validation. See `tests.txt`, `build.txt`.

## Network

See `network.json`. A recording same-origin proxy observes requests after initial page load. Sequence: Valpo → Esta noche → rock → Lugares → Mapa → Lista → clear → En vivo → back → forward. **0 new data API/RSC requests; 0 same-origin requests during that recorded sequence.** Static map assets/tiles are allowed. A separate populated-map check confirmed three selected events / three markers and a working popup.

Supabase is not imported into the client discovery tree; the unchanged public snapshot is embedded once. Existing snapshot refresh on returning to a tab older than ten minutes is preserved and is outside the immediate filter sequence. Opening a detail is a navigation, not a filter operation.

## Lighthouse mobile

One final run per route/environment; lab measurements, not field guarantees. Scores ordered Performance / Accessibility / Best Practices / SEO.

| Page | Local production build | Vercel preview |
|---|---|---|
| Home | 96 / 100 / 96 / 100 | 96 / 100 / 100 / 58 |
| Explore | 98 / 100 / 96 / 100 | 96 / 100 / 100 / 58 |
| Event | 100 / 100 / 96 / 100 | 99 / 100 / 100 / 61 |

**The literal all-scores ≥95 gate is not met on the protected preview's SEO category.** Vercel intentionally adds `X-Robots-Tag: noindex`; the protected robots fetch also fails the audit. We did not make a preview indexable merely to improve its score. SEO passes 100 in the production-mode local build and server-visible canonical/schema checks match current production. Local Best Practices 96 is the pre-existing `/api/medir` 503 from local metrics configuration; it is 100 in the deployed preview. Full HTML/JSON reports in `lighthouse/`; authentication headers have been redacted.

## Performance and SEO preservation

Home/Explore initial JS: **123 kB** (Next build report; reported prior budget ~125 kB). Compiled CSS: **7,689 bytes gzip**. Public snapshot: **11,740 bytes gzip**. No dependency/lockfile changes.

`seo.json` compares live production and local server responses: Home, Explore, Event, Venue, Zone, robots, sitemap, IndexNow key. All return 200; canonical URLs and structured-data types match. Home retains 3 server-visible event links; Explore 26. Event/BreadcrumbList and MusicVenue (LocalBusiness subtype)/BreadcrumbList remain. IndexNow integration code is unchanged; no submission was sent during this frontend QA.

## Consolidation

`app/globals.css`: 70,419 → 38,262 bytes uncompressed (−45.7%). 352 legacy/replaced rules removed during consolidation. One root palette and unified discovery/card definitions. Removed seasonal selectors, generated-poster families, tones/compositions, decorative star experiments and duplicate card/hero overrides. Administrative/form styling retained. Unreferenced server-driven `components/Explore.tsx` removed after checking imports; its obsolete September module no longer exists in the UI implementation. Event data/type definitions were not removed.

Changed UI: ExploreClient, EventCard, EventImage, VenueCard, new VenueMedia, BottomNav, Navbar, Footer, ZoneRail, ShareButton, LiveReport; event/venue detail pages; global CSS. Supporting change: `lib/share.ts`, two sharing tests. See the application commit for exact diff.

## Limits and remaining checks

- No legitimate venue images in current supply. Optional approved image/logo support now exists; typography is the complete no-image presentation.
- All 26 public flyers inspected are square/portrait. There is no real landscape source or event with an unknown time in this snapshot. `object-fit: contain` and the unknown-time label are implemented, but those two real-data visual checks remain unexecuted rather than fabricated.
- Responsive testing used Chromium viewports, not physical iOS/Android devices. Final owner/Carlos review and a physical-phone smoke test remain before merge.
- Some venues lack coordinates or official social links; these omissions stay explicit. The existing data pipeline is outside this pass.
- Share links target production canonical details. Preview access expires after seven days and its toolbar may overlay a small edge of the viewport.
