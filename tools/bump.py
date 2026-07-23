# Cache-bust: satter ?v=N pa alla lokala imports + index.html-entry.
# Kor: python tools/bump.py <N>   (bumpa OCKSA VERSION i js/game.js manuellt/med sed)
import re, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VER = sys.argv[1] if len(sys.argv) > 1 else "1"

for fn in os.listdir(os.path.join(ROOT, "js")):
    if not fn.endswith(".js"):
        continue
    p = os.path.join(ROOT, "js", fn)
    s = open(p, encoding="utf-8").read()
    new = re.sub(r"(from\s+['\"])(\./[\w-]+)\.js(?:\?v=\d+)?(['\"])", rf"\1\2.js?v={VER}\3", s)
    if new != s:
        open(p, "w", encoding="utf-8").write(new); print("uppdaterade imports i", fn)

hp = os.path.join(ROOT, "index.html")
h = open(hp, encoding="utf-8").read()
h2 = re.sub(r'(src=")(js/[\w-]+)\.js(?:\?v=\d+)?(")', rf'\1\2.js?v={VER}\3', h)
if h2 != h:
    open(hp, "w", encoding="utf-8").write(h2); print("uppdaterade index.html entry")
print("version =", VER, "(kom ihag: bumpa aven VERSION-konstanten i js/game.js)")
