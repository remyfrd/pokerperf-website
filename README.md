# pokerperf-website

Site vitrine + pages-outils SEO de PokerPerf — **Jekyll**, hébergé sur **GitHub Pages** (domaine `pokerperf.com`).

## Dév local

```bash
bundle install
bundle exec jekyll serve      # http://localhost:4000
```

GitHub Pages reconstruit automatiquement à chaque push sur `main` (build Jekyll natif, aucune GitHub Action requise).

## Structure

```
_config.yml            Config Jekyll
_layouts/              Gabarits des NOUVELLES pages
  default.html           page générique (head SEO + slot contenu)
  doc.html               page "document" (mentions, guides) — design repris de support.html
_includes/
  head.html              <head> mutualisée : title/description/canonical/hreflang/OG + analytics
  analytics.html         beacon Cloudflare Web Analytics (token public)
_data/
  i18n.yml               chaînes d'interface FR/EN
  site.yml               mentions légales, contact
index.html             Landing (servie verbatim, design propre)
privacy|terms|support  Pages légales FR + variantes .en (servies verbatim)
CNAME                  pokerperf.com
```

## Conventions

- **Pages existantes** (`index.html`, `privacy*.html`, `terms*.html`, `support*.html`) : **sans front matter → copiées verbatim** par Jekyll. Ne pas casser leurs URLs (référencées par les fiches store).
- **Nouvelles pages** : front matter + `layout: default|doc`. Bilingue par **slugs localisés** :
  - FR : `/fr/calculateur-equite/` · EN : `/en/poker-odds-calculator/`
  - `hreflang` géré via le front matter `alternates:` (voir `_includes/head.html`).
- **Outils interactifs** (ex. calculateur d'équité) = widget JS/TS autonome dans `/assets/`, monté dans la page ; libellés injectés par Jekyll via `data-*` → bundle unique FR+EN.

## À venir

Page calculateur d'équité & probabilités — voir le brief `brief-calculateur-equite.md` (dans le dossier projet create-app).
