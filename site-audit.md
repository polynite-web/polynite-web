# Polynite website and SEO audit — 2026-10-07

Primary identity: Create / View / Share. Procedural 3D scenes, interactive Mint Links, AI control through MCP,
animation and recording. GLB import/inspection/optimization remains a supported
secondary workflow. The app entry still opens the renderer, not a marketing page.

## Corrected

- App title, description, social metadata, structured data, readable fallback and
  web manifest previously described a GLB-first viewer. They now match the product.
- A new versioned 1200x630 social card makes the new positioning visible. The old
  image filename remains an alias; immutable v253 archives are not edited.
- Product/docs/service pages have distinct descriptive metadata, canonical URLs,
  Open Graph/Twitter cards, JSON-LD and service links instead of generic descriptions.
- Explore home, Create, About and MCP pages no longer call deployed MCP a lab-only
  future feature. The imported-model tools keep specialized, conservative copy.
- Removed blanket promises of no uploads, universal compatibility, fixed percentage
  savings, free third-party services and unverified simplification availability.
- Removed contradictory “films coming later” copy and an undated speculative roadmap.
- Added the confirmed YouTube channel in navigation/footer/contextual demos and an
  explicitly labelled subscription link. No automatic subscription or autoplay.
- App sitemap now includes product, docs, support, privacy and terms. Explore sitemap
  lists canonical static pages and Discover. Dev pages receive noindex metadata.
- Public model JSON-LD escapes opening angle brackets so a model name cannot close
  a script block. Dynamic page navigation and fallback artwork match the static site.
- OpenAI Business approval is recorded in the API publication gates/runbook from the
  operator's screenshot. It is not advertised as plugin approval or endorsement.

## Rebuild

The authoritative content and page metadata are in public-site-src/.

    node build_public_site.cjs
    node sync_app_metadata.cjs --source D:/dev/wnex/wk/emp/src/mesh/web/index.html
    node build_explore_site.cjs --output D:/dev/majify-api/worker/polynite-auth/site
    node build_error_pages.cjs --explore D:/dev/majify-api/worker/polynite-auth/site
    node test_public_site.cjs
    node test_seo.cjs --explore D:/dev/majify-api/worker/polynite-auth/site

build_social_card.cjs uses Sharp (the existing adjacent Worker dependency) to
render the code-native SVG and preserve the brand logo. Checked-in PNGs are
already available; normal publication does not require regenerating them.
deploy_dev_to_site.bat re-applies app metadata and public/error pages after copying
an engine build. Source HTML is updated too; no Wake/JIT build is needed for this audit.

## Evidence and remaining work

SEO checks cover 15 public pages, unique titles/descriptions, canonical URLs,
parseable structured data, social-image dimensions, sitemap coverage and unchanged
renderer/loader scripts. Existing tests still verify local references and all 78
immutable v253 asset hashes. Desktop and a 390px iframe layout are inspected;
the iframe has a 375px inner viewport with no horizontal overflow. This is not
a physical mobile-device certification.

Search results and existing link cards may retain cached metadata. Request a
recrawl through the owner's Search Console; no search ranking/indexing guarantee
or external preview-cache purge is claimed. Tool scan, domain verification,
review-account access, real-host capture and recording endurance remain separate
plugin submission work. Jev/BYOK app use, paid credits and local AI are not active
public features; the docs make that distinction explicit.

## Unified identity and navigation
The shared site_chrome.mjs module now renders both static pages and the Worker's
Discover/model pages. Logo, white/cyan branding, navigation and the Majify/Wake
footer are common. The Mint Link guide is /docs/sharing/. Video version labels
are retained in technical evidence only; public captions describe the example.
The new versioned social card is og-create-view-share-v2.png. Narrow iframe
checks cover 390px/320px frames (375px/305px actual inner widths), without
horizontal overflow or overlapping logo/button rectangles.
