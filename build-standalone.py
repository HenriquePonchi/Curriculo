#!/usr/bin/env python3
"""
Gera vitae-standalone.html: um único arquivo com todo o CSS e JS
embutidos, para hospedar em qualquer lugar ou abrir direto do disco.
Rode na raiz do projeto:  python3 build-standalone.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
html = (ROOT / "index.html").read_text(encoding="utf-8")


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


# CSS principal
html = html.replace(
    '<link rel="stylesheet" href="css/style.css">',
    "<style>\n" + read("css/style.css") + "\n</style>",
)

# CSS de impressão (mantém o media="print")
html = html.replace(
    '<link rel="stylesheet" href="css/print.css" media="print">',
    '<style media="print">\n' + read("css/print.css") + "\n</style>",
)

# Scripts locais, na mesma ordem em que aparecem
for name in ("storage", "templates", "pdf-export", "app"):
    html = html.replace(
        f'<script src="js/{name}.js" defer></script>',
        "<script>\n" + read(f"js/{name}.js") + "\n</script>",
    )

out = ROOT / "vitae-standalone.html"
out.write_text(html, encoding="utf-8")

leftovers = re.findall(r'(?:href|src)="(?:css|js)/[^"]+"', html)
print(f"{out.name} gerado — {len(html) / 1024:.0f} KB")
if leftovers:
    print("Atenção, sobraram referências locais:", leftovers)
