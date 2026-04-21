# Mobile scripts

## `build-cities.mjs`

Regenerates `src/constants/cities.json` from the public GeoNames `cities5000`
dataset (all populated places with population ≥ 5,000), filtered to Belgium,
Germany, Switzerland, France, and Netherlands.

```bash
node apps/mobile/scripts/build-cities.mjs
```

**When to re-run:** rarely. The dataset is frozen in the repo; regenerate only
when you want to pick up new/renamed cities or widen the country set. Commit
the updated `cities.json` together with any related code change.

**Requirements:** `unzip` on `PATH`. Runs on macOS out of the box; CI images
should include it. Source URL: `https://download.geonames.org/export/dump/cities5000.zip`
(CC BY 4.0).

**Output format:** array of `{ n: string, c: string }` entries (short keys to
shrink bundle size). The UI expands them at import in `CityCombobox.tsx`.
