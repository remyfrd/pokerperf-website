#!/usr/bin/env python3
"""IndexNow : prévient Bing / Yandex (et les moteurs qui s'appuient dessus) des URL modifiées.

Usage (depuis la racine du dépôt, APRÈS que GitHub Pages a publié) :
  python3 -I scripts/indexnow.py --since HEAD~1     # URL des pages modifiées depuis ce commit
  python3 -I scripts/indexnow.py --all              # toutes les URL du sitemap en ligne
  python3 -I scripts/indexnow.py URL [URL…]         # URL précises
Ajoute --dry pour afficher sans envoyer.
La clé (publique par conception) est servie à la racine : https://pokerperf.com/<clé>.txt
"""
import glob, json, os, re, subprocess, sys, urllib.request

HOST = "pokerperf.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = next(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(ROOT, "*.txt"))
           if re.fullmatch(r"[0-9a-f]{32}\.txt", os.path.basename(p)))

def permalink(path):
    """URL publique d'un fichier source (front matter `permalink`, sinon chemin)."""
    try:
        head = open(path, encoding="utf-8").read(2000)
    except OSError:
        return None
    m = re.search(r"^permalink:\s*(\S+)", head, re.M)
    if m:
        return f"https://{HOST}{m.group(1)}"
    rel = os.path.relpath(path, ROOT)
    if rel.endswith("index.html"):
        rel = rel[: -len("index.html")]
    return f"https://{HOST}/{rel}"

def changed_since(ref):
    out = subprocess.run(["git", "-C", ROOT, "diff", "--name-only", ref, "HEAD"], capture_output=True, text=True, check=True).stdout.split()
    urls = set()
    for f in out:
        if not f.endswith(".html") or f.startswith(("_", "assets/", ".claude/")):
            continue  # gabarits/includes : pas de page directe
        if os.path.exists(os.path.join(ROOT, f)):
            u = permalink(os.path.join(ROOT, f))
            if u: urls.add(u)
    return sorted(urls)

def all_urls():
    sm = urllib.request.urlopen(f"https://{HOST}/sitemap.xml", timeout=30).read().decode()
    return re.findall(r"<loc>(.*?)</loc>", sm)

def main(argv):
    dry = "--dry" in argv
    args = [a for a in argv if a != "--dry"]
    if args[:1] == ["--all"]:
        urls = all_urls()
    elif args[:1] == ["--since"]:
        urls = changed_since(args[1])
    else:
        urls = [a for a in args if a.startswith("https://")]
    if not urls:
        print("Aucune URL à envoyer."); return 0
    print(f"{len(urls)} URL :"); [print("  ", u) for u in urls]
    if dry:
        return 0
    body = json.dumps({"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls}).encode()
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print("IndexNow :", r.status, "(200/202 = reçu)")
    except urllib.error.HTTPError as e:
        print("IndexNow : erreur", e.code, e.read()[:200].decode(errors="replace")); return 1
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
