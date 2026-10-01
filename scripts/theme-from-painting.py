#!/usr/bin/env python3
"""theme-from-painting.py PAINTING [--crop GEOMETRY] [--blur SIGMA]

Turns a picture into the page's look: a heavily blurred copy becomes
public/assets/wallpaper.jpg, and its colours become the --theme-* custom
properties in src/styles/index.css: a dark palette between the theme:begin
and theme:end markers (the default) and a light one, still a draft, between
theme-light:begin and theme-light:end. Needs ImageMagick 7 (`magick`);
nothing else.

  --crop GEOMETRY   ImageMagick geometry taken from the top-left before
                    anything else, e.g. 86%x31%+14%+0 for a sky strip
  --blur SIGMA      Gaussian sigma in pixels of the 1600px-wide wallpaper
                    (default 50: colour fields with cloud shapes)

How the colours are picked: the pixels are k-means clustered in CIELAB,
each cluster goes to OKLCH (lightness L, chroma C, hue h), and every
colour role takes the cluster whose hue is nearest its target. There is
no fallback: a painting with no green gets its least-ungreen cluster as
green, so pick paintings that carry the hues the page needs. Lightness
is then set per role so text and accents read over the dark background;
chroma stays the painting's, floored so accents are not grey.
"""
import argparse
import math
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / "src/styles/index.css"
WALLPAPER = ROOT / "public/assets/wallpaper.jpg"

# OKLCH hue targets for each accent role, and the lightness every accent
# is set to. Brights are the same hue a step lighter. Roles may share a
# cluster: a painting that is all blues gives a blue "pink", and that is fine.
HUES = {"red": 25, "orange": 55, "yellow": 95, "green": 140,
        "cyan": 195, "blue": 255, "pink": 345}
CHROMA_MIN, CHROMA_MAX = 0.07, 0.16
# The feed-source categories (Author/Topic, Following, ...) are the one
# place colours must differ from each other: cat-1..cat-N are N clusters of
# the painting's dominant hue family (the sky), spread evenly in lightness.
CATEGORIES = 6
FAMILY_DEG = 35
# Lightness per role, dark (the default) and light mode. Same clusters,
# same hues; this table is the whole difference between the two modes.
# The light table is a draft: components still use accent colours as text
# over the background, which only reads on a dark one.
MODES = {
    "light": dict(bg=0.96, dim=0.86, mute=0.50, fg=0.22, accent=0.52, bright=0.42,
                  cat=(0.70, 0.90), on_cat="fg", scheme="light"),
    "dark": dict(bg=0.24, dim=0.36, mute=0.72, fg=0.95, accent=0.78, bright=0.87,
                 cat=(0.62, 0.86), on_cat="bg", scheme="dark"),
}


# --- OKLab <-> sRGB (Björn Ottosson's matrices) ------------------------------

def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _unlin(c):
    c = min(1.0, max(0.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def rgb_to_lch(r, g, b):
    r, g, b = _lin(r), _lin(g), _lin(b)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def lch_to_hex(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return "#%02x%02x%02x" % tuple(round(_unlin(c) * 255) for c in (r, g, bb))


def hue_dist(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def dominant_hue(cl):
    """Hue of the cluster that carries the most colour (share x chroma): the
    sky in a landscape. A mean would land between families, e.g. teal for
    a blue sky over a green field."""
    return max(cl, key=lambda c: c["n"] * c["C"])["h"]


def shades(cl, hue, lo, hi, n):
    """n (chroma, hue) pairs from the clusters within FAMILY_DEG of `hue`,
    taken evenly across that family sorted by lightness, each then set to
    an evenly spaced lightness between lo and hi."""
    fam = sorted((c for c in cl if hue_dist(c["h"], hue) <= FAMILY_DEG), key=lambda c: c["L"])
    picks = [fam[round(i * (len(fam) - 1) / (n - 1))] for i in range(n)]
    return [(lo + (hi - lo) * i / (n - 1), min(CHROMA_MAX, max(CHROMA_MIN, c["C"])), c["h"])
            for i, c in enumerate(picks)]


# --- the work ----------------------------------------------------------------

def magick(*args):
    return subprocess.run(["magick", *args], check=True, capture_output=True, text=True).stdout


def clusters(src, k=24):
    out = magick(src, "-resize", "256x256>", "-colorspace", "LAB", "-kmeans", str(k),
                 "-colorspace", "sRGB", "-depth", "8", "-format", "%c", "histogram:info:-")
    rows = []
    for m in re.finditer(r"^\s*(\d+):\s*\(\s*(\d+),\s*(\d+),\s*(\d+)", out, re.M):
        n, r, g, b = map(int, m.groups())
        L, C, h = rgb_to_lch(r, g, b)
        rows.append({"n": n, "L": L, "C": C, "h": h})
    return rows


def palette(cl, mode):
    m = MODES[mode]
    chromatic = [c for c in cl if c["C"] >= 0.03] or cl
    out = {}
    for role, target in HUES.items():
        c = min(chromatic, key=lambda c: hue_dist(c["h"], target))
        C = min(CHROMA_MAX, max(CHROMA_MIN, c["C"]))
        out[role] = lch_to_hex(m["accent"], C, c["h"])
        out[role + "-bright"] = lch_to_hex(m["bright"], C, c["h"])
    hue = dominant_hue(chromatic)
    for i, (L, C, h) in enumerate(shades(chromatic, hue, *m["cat"], CATEGORIES), 1):
        out[f"cat-{i}"] = lch_to_hex(L, C, h)
    out["bg"] = lch_to_hex(m["bg"], 0.03, hue)
    out["dim"] = lch_to_hex(m["dim"], 0.03, hue)
    out["mute"] = lch_to_hex(m["mute"], 0.03, hue)
    out["fg"] = lch_to_hex(m["fg"], 0.02, hue)
    out["on-cat"] = f"var(--theme-{m['on_cat']})"
    return out


def write_css(palettes):
    css = CSS.read_text()
    for mode, pal in palettes.items():
        tag = "theme" if mode == "dark" else f"theme-{mode}"
        begin, end = f"  /* {tag}:begin */", f"  /* {tag}:end */"
        head = f"{begin}\n  /* generated by scripts/theme-from-painting.py, {mode} */\n"
        body = "".join(f"  --theme-{k}: {v};\n" for k, v in pal.items())
        body += f"  color-scheme: {MODES[mode]['scheme']};\n"
        pattern = re.compile(re.escape(begin) + ".*?" + re.escape(end), re.S)
        assert pattern.search(css), f"{tag}:begin/end markers missing in index.css"
        css = pattern.sub(lambda _: head + body + end, css)
    CSS.write_text(css)


def main():
    ap = argparse.ArgumentParser(description="theme-from-painting: wallpaper + palette from a picture")
    ap.add_argument("painting")
    ap.add_argument("--crop", metavar="GEOMETRY")
    ap.add_argument("--blur", type=float, default=50, metavar="SIGMA")
    a = ap.parse_args()

    crop = ["-crop", a.crop, "+repage"] if a.crop else []
    base = [a.painting, "-auto-orient", "-strip", *crop, "-resize", "1600x1600>"]
    # Blur on a 5% thumbnail and scale back up: same result as a huge
    # Gaussian on the full image, in a fraction of the time.
    # The only colour tuning: clouds go white. Blurring averages a cloud
    # with the sky around it into grey; this lifts pixels that are both
    # bright and low in saturation (clouds, not sky or field) back towards
    # white. Global lifting or desaturating would turn the sky grey instead.
    blurred = WALLPAPER.with_name("theme-blurred.png")
    magick(*base, "-resize", "5%", "-blur", f"0x{a.blur / 20:.2f}", "-resize", "2000%", str(blurred))
    # The cloud mask comes from a much lighter blur (a fifth of the main
    # one) so clouds keep their ragged shape instead of the perfect oval the
    # heavy blur leaves; it fades out below mid-height so the field is never
    # touched.
    mask = WALLPAPER.with_name("theme-cloud-mask.png")
    magick(*base, "-resize", "5%", "-blur", f"0x{a.blur / 100:.2f}", "-resize", "2000%",
           "-colorspace", "HSB",
           "(", "-clone", "0", "-channel", "G", "-separate", "+channel", "-negate", ")",
           "(", "-clone", "0", "-channel", "B", "-separate", "+channel", ")",
           "-delete", "0", "-compose", "multiply", "-composite", "-level", "50%,100%",
           "(", "-clone", "0", "-fill", "white", "-colorize", "100",
           "-sparse-color", "barycentric", "0,0 white 0,%h black", "-level", "25%,65%", ")",
           "-compose", "multiply", "-composite", "-evaluate", "multiply", "0.6", str(mask))
    magick(str(blurred), "(", "+clone", "-fill", "white", "-colorize", "100", ")", str(mask),
           "-compose", "over", "-composite", "-quality", "85", str(WALLPAPER))
    blurred.unlink()
    mask.unlink()
    tmp = WALLPAPER.with_name("theme-source.png")
    magick(*base, str(tmp))
    cl = clusters(str(tmp))
    tmp.unlink()
    palettes = {mode: palette(cl, mode) for mode in MODES}

    write_css(palettes)
    for k in palettes["dark"]:
        print(f"{k:14s} {palettes['dark'][k]:22s} {palettes['light'][k]}")
    print(f"\nwallpaper : {WALLPAPER.relative_to(ROOT)}")
    print(f"palette   : {CSS.relative_to(ROOT)} (theme:begin .. theme:end)")


if __name__ == "__main__":
    main()
