# StormDesk (beta)

A forecast-models and winter-tracking site: model maps (NOAA, ECMWF, Environment Canada, AI models), ensembles, spaghetti plots, long range, soundings, a Winter Desk with multi-model storm totals, a 20-day local forecast with snow odds, and a politics page.

## Files

```
index.html            the page
css/stormdesk.css     all styles
js/stormdesk.js       all code (sections are numbered in comments)
data/polls.json       polling numbers for the Politics tab (edit this to update polls)
```

You can still open `index.html` straight from your computer. `data/polls.json` is only read when the site is served over http(s); otherwise the built-in numbers in `js/stormdesk.js` are used.

## On jamehinna.net

Served by main.py at /weather/, only for the james login. main.py's /weather/proxy does the job of the proxy (allowlisted hosts, cached), so no Cloudflare Worker is needed.

## Putting it on another domain

1. Upload the whole folder (keep the structure) to your web host, e.g. a `/weather/` folder on your site.
2. Optional but recommended: deploy `server/worker.js` (instructions at the top of that file), then set
   `window.STORMDESK_PROXY = "https://wx-proxy.<you>.workers.dev/?url=";` in `index.html`.
   This fixes any source that blocks direct browser access (ECMWF charts, Canada's map list, NHC storm list, GDELT news) and caches them.
3. In `worker.js`, set `SITE_ORIGIN` to your site's address and put a real contact email in `USER_AGENT`.

## Updating the polls

Edit `data/polls.json` and upload it. No code changes needed. Fields:
`approval`, `rep.list` / `dem.list` (`[name, average, 30-day change]`), `latest` (recent polls), `general` (head-to-heads).

## Data sources and terms (check before going public)

| Source | Used for | Terms |
|---|---|---|
| NOAA / NWS / NCEP (MAG, WPC, CPC, SPC, NHC), NOAA STAR | Model maps, outlooks, satellite, radar, alerts | US government, free to use. NWS asks for a User-Agent with contact info. |
| Open-Meteo | Point forecasts, ensembles, data maps, soundings, storm totals, EC46/SEAS5 | Free for **non-commercial** use (CC BY 4.0, credit Open-Meteo). Ads or paid features require their commercial plan. The data maps make many point requests; keep traffic modest or get an API key. |
| ECMWF OpenCharts | ECMWF map images | Free under CC BY 4.0. Keep the "© ECMWF" credit shown with the maps. |
| Environment Canada (MSC GeoMet) | CMC GDPS/RDPS/HRDPS/GEPS maps | Free under the ECCC open data licence; credit Environment and Climate Change Canada. |
| Windy embed | Interactive ECMWF/ICON maps | Windy's embed terms; keep their branding. |
| GDELT | Live news headlines | Free; links go to the original publishers. |
| Zippopotam.us | ZIP code to location | Free. |
| PollCheck (numbers in `polls.json`) | Polling averages | Cite the source and date shown on the page. |

The page does not copy images or data from Tropical Tidbits or RealClearPolitics.

## Known limits (beta)

- Model "run status" checks NOAA's map folders, which can briefly still hold the previous day's run of the same hour.
- Kuchera snow and the ice estimate are computed from Open-Meteo hourly data, so they are guidance, not official forecasts.
- Snow-day odds are just for fun.
