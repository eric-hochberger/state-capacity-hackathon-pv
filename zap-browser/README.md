# ZAP Browser

Click a community district on the map to browse its open land-use applications from NYC City Planning's [Zoning Application Portal (ZAP)](https://zap.planning.nyc.gov/).

- Districts are shaded by how many open applications they have. Hover to see the count, and click to list them.
- Filter by stage (Filed, Noticed, In Public Review, Review complete, On hold) or search by name, applicant or ULURP number.
- Each project links to its page on ZAP. Individual districts can be linked with a URL hash, e.g. `index.html#M05`.

## Running

Open `index.html` in a browser. No server or build step is needed. The page loads Leaflet and Esri basemap tiles from the internet.

## Refreshing the data

1. Download the latest [ZAP Project Data](https://data.cityofnewyork.us/City-Government/Zoning-Application-Portal-ZAP-Project-Data/hgx4-8ukb) CSV from NYC Open Data into this folder.
2. Run `python3 build.py`, or `python3 build.py path/to/file.csv`.

This rebuilds `data.js`, keeping projects with status `Active` or `On-Hold`. The raw CSV is about 10 MB and isn't committed.

`data/community_districts.geojson` holds the district boundaries, from DCP's [NYC Community Districts](https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Community_Districts/FeatureServer/0) feature service.
