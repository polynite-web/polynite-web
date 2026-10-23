# Writes ship_miro.json: Miro's ship (the native ship_model 3) as a ship_recipe of
# generic operators (vmesh_inf_rig.hh). Defaults reproduce the native ship; the
# inputs open variations (span, sweep, nacelle spread, girth, colours, offsets...).
# Run: python gen_ship_miro.py   (writes next to this file)
import json, os

def E(*a): return list(a)           # an expression: [op, arg, ...]
def mul(a, b): return E("mul", a, b)
def add(a, b): return E("add", a, b)
def sub(a, b): return E("sub", a, b)

inputs = [
    {"name": "lower_offset", "min": 0, "max": 1, "value": 1, "group": "parts", "description": "the lower nacelles (and their wings) set lower and further aft"},
    {"name": "upper_offset", "min": 0, "max": 1, "value": 0, "group": "parts", "description": "the upper nacelles (and their wings) set higher and further aft"},
    {"name": "nose", "min": 0.6, "max": 1.4, "value": 1, "group": "shape", "description": "the length of the cockpit and the snout ahead of it"},
    {"name": "girth", "min": 0.7, "max": 1.5, "value": 1, "group": "shape", "description": "the fuselage's width and height"},
    {"name": "spread", "min": 1.4, "max": 3.0, "value": 1.85, "group": "shape", "description": "the nacelles' distance from the axis (m)"},
    {"name": "span", "min": 0.5, "max": 1.6, "value": 1, "group": "wings", "description": "the wings' span beyond their root"},
    {"name": "sweep", "min": -0.5, "max": 0.8, "value": 0, "group": "wings", "description": "extra sweep of the wings (m back per m of span)"},
    {"name": "chord", "min": 0.5, "max": 1.6, "value": 1, "group": "wings", "description": "the wings' chord"},
    {"name": "hull_r", "min": 0, "max": 1, "value": 0.64, "group": "colour"},
    {"name": "hull_g", "min": 0, "max": 1, "value": 0.66, "group": "colour"},
    {"name": "hull_b", "min": 0, "max": 1, "value": 0.71, "group": "colour"},
    {"name": "accent_r", "min": 0, "max": 1, "value": 0.92, "group": "colour"},
    {"name": "accent_g", "min": 0, "max": 1, "value": 0.30, "group": "colour"},
    {"name": "accent_b", "min": 0, "max": 1, "value": 0.05, "group": "colour"},
    {"name": "panel_r", "min": 0, "max": 1, "value": 0.035, "group": "colour"},
    {"name": "panel_g", "min": 0, "max": 1, "value": 0.055, "group": "colour"},
    {"name": "panel_b", "min": 0, "max": 1, "value": 0.13, "group": "colour"},
    {"name": "jet_r", "min": 0, "max": 2, "value": 0.10, "group": "colour", "description": "the main jets' sheath colour"},
    {"name": "jet_g", "min": 0, "max": 2, "value": 0.22, "group": "colour"},
    {"name": "jet_b", "min": 0, "max": 2, "value": 0.62, "group": "colour"},
    {"name": "thrust", "min": 0, "max": 3, "value": 1, "group": "flames", "description": "the main jets' size"},
    {"name": "seed", "min": 0, "max": 9999, "value": 0, "integer": True, "group": "variety", "description": "which variant (with variety above 0)"},
    {"name": "variety", "min": 0, "max": 1, "value": 0, "group": "variety", "description": "how far each seed strays from the inputs (proportions and colours)"},
]
# THE VARIANTS: every shape and colour input strays by variety x a seeded random amount, clamped to its range
def stray(name, salt, amp, lo, hi):
    return {"name": "v_" + name, "value": E("clamp", add("$" + name, mul("$variety", mul(sub(E("rand", salt), .5), amp))), lo, hi)}
LETS = [stray("girth", 1, .5, .7, 1.5), stray("spread", 2, .8, 1.4, 3.0), stray("span", 3, .7, .5, 1.6), stray("sweep", 4, .6, -.5, .8),
        stray("chord", 5, .6, .5, 1.6), stray("nose", 6, .5, .6, 1.4), stray("thrust", 7, .6, 0, 3)]
for i, c in enumerate(["hull_r", "hull_g", "hull_b"]): LETS.append(stray(c, 10 + i, .45, 0, 1))
for i, c in enumerate(["accent_r", "accent_g", "accent_b"]): LETS.append(stray(c, 20 + i, 1.2, 0, 1))
for i, c in enumerate(["panel_r", "panel_g", "panel_b"]): LETS.append(stray(c, 30 + i, .4, 0, 1))
for i, c in enumerate(["jet_r", "jet_g", "jet_b"]): LETS.append(stray(c, 40 + i, 1.0, 0, 2))
HULL = ["%v_hull_r", "%v_hull_g", "%v_hull_b"]
ACC = ["%v_accent_r", "%v_accent_g", "%v_accent_b"]
NAVY = ["%v_panel_r", "%v_panel_g", "%v_panel_b"]
GREY = [0.48, 0.50, 0.55]
DARK = [0.04, 0.045, 0.055]
PALE = [0.46, 0.48, 0.53]

bz = [-7.4, -6.8, -4.8, -2.6, -.4, 1.6, 3.4, 4.9, 6.0, 6.8]
brx = [1.05, 1.45, 1.60, 1.62, 1.55, 1.38, 1.10, .80, .52, .32]
bry = [.80, 1.05, 1.12, 1.12, 1.06, .95, .78, .58, .40, .27]
byc = [0, 0, 0, 0, .02, 0, -.06, -.14, -.22, -.28]
K = .82
ez = [-7.35, -7.05, -2.95, -2.6, -2.3]; erx = [.66, .82, .84, .80, .62]; ery = [.58, .72, .74, .70, .54]
wx = [1.9, 3.0, 4.6, 6.0, 7.2, 9.0]; wl = [-2.4, -2.6, -3.5, -4.3, -5.0, -6.4]; wt = [-5.9, -6.9, -6.8, -6.7, -6.6, -6.55]; wth = [.30, .26, .22, .18, .15]
cnp_z = [-1.6, -1.15, -.7, -.45, .6, 1.8, 3.0, 4.1, 5.0, 5.8, 6.35]
cnp_a = [.55, .98, 1.22, 1.28, 1.30, 1.24, 1.10, .90, .66, .38, .10]

def r4(v): return round(v, 5)
paint = [   # Miro's sheet: by the facet's height (above) and z ranges
    {"above": .75, "z": [[-.6, 5.2], [-5.0, -3.2]], "color": NAVY},
    {"above": .25, "z": [[2.6, 5.2]], "color": NAVY},
    {"above": -.25},
    {"above": -.75, "z": [[-5.0, 4.4]], "color": NAVY},
    {"above": -2, "z": [[-3.2, -.6], [2.6, 4.4]], "color": NAVY, "else": PALE},
]
# repeat over the four nacelles: @i the side (0 left, 1 right), @j the tier (0 upper, 1 lower)
NLET = [{"name": "sx", "value": sub(mul(2, "@i"), 1)}, {"name": "up", "value": sub(1, mul(2, "@j"))}, {"name": "w", "value": add("@i", mul(2, "@j"))},
        {"name": "cx", "value": mul("%sx", "%v_spread")}, {"name": "cy", "value": mul("%up", .62)}]
R4 = {"count": 2, "rows": 2}
NAC = add(1, "%w")      # parts 1..4: the nacelles
WING = add(5, "%w")     # parts 5..8: their wings
C = ["%cx", "%cy", 0]
def wingx(x): return add(add("%v_spread", .05), mul(x - 1.9, "%v_span"))          # a span station
def wingz(z, x, lead_ref): # chord scaled about the station's mid chord, then swept
    return sub(add(lead_ref, mul(z - lead_ref, "%v_chord")), mul("%v_sweep", mul(x - 1.9, "%v_span")))

nodes = []
nodes.append({"op": "loft", "id": "body", "z": bz, "rx": [mul(v, "%v_girth") for v in brx], "ry": [mul(v, "%v_girth") for v in bry], "yc": byc, "sides": 10, "color": HULL, "paint": paint})
nodes.append({"op": "loft", "id": "block", "z": [-7.6, -7.2, -4.8, -2.8, -1.6], "rx": [1.4, 1.95, 1.95, 1.9, 1.2], "ry": [.70, .92, .92, .90, .66], "sides": 6, "rot": 30, "color": HULL, "paint": paint})
nodes.append({"op": "loft", "z": [6.72, 7.15, 7.5, 7.78], "rx": [.33, .25, .15, .03], "ry": [.28, .21, .13, .03], "yc": [-.28, -.30, -.32, -.33], "sides": 10, "color": ACC})
nodes.append({"op": "loft", "z": [-7.95, -7.6, -6.7, -5.9], "rx": [.64, .74, .70, .52], "sides": 12, "color": DARK})
# the nacelles: hexagonal prisms, orange frames, a hollow intake, a nozzle set in its housing
nodes.append({"op": "loft", "part": NAC, "repeat": R4, "let": NLET, "at": C, "z": ez, "rx": [r4(v * K) for v in erx], "ry": [r4(v * K) for v in ery], "sides": 6, "color": HULL})
nodes.append({"op": "loft", "part": NAC, "repeat": R4, "let": NLET, "at": C, "z": [-2.95, -2.6], "rx": [r4(.88 * K)] * 2, "ry": [r4(.78 * K)] * 2, "sides": 6, "color": ACC})
nodes.append({"op": "loft", "part": NAC, "repeat": R4, "let": NLET, "at": C, "z": [-7.05, -6.8], "rx": [r4(.86 * K)] * 2, "ry": [r4(.76 * K)] * 2, "sides": 6, "color": ACC})
nodes.append({"op": "bore", "part": NAC, "repeat": R4, "let": NLET, "at": C, "mouth": -2.0, "depth": .28, "r_out": .44, "r_in": .34, "back": -2.45, "sides": 14, "dir": 1,
              "outer": HULL, "lip": [.70, .72, .77], "wall": [.08, .08, .10], "floor": [.025, .025, .03]})
nodes.append({"op": "disc", "part": NAC, "repeat": R4, "let": NLET, "at": ["%cx", "%cy", -2.276], "r": .12, "normal": [0, 0, 1], "color": [.30, .31, .34]})
nodes.append({"op": "bore", "part": NAC, "repeat": R4, "let": NLET, "at": C, "mouth": -7.80, "depth": .35, "r_out": .60, "r_in": .47, "back": -7.30, "sides": 14, "dir": -1,
              "outer": GREY, "lip": [.74, .76, .80], "wall": [.10, .10, .12], "floor": [.03, .03, .035]})
for dz, r, col in [(-.004, .36, [.18, .18, .20]), (-.008, .30, [.05, .05, .06]), (-.012, .18, [.32, .11, .03])]:
    nodes.append({"op": "disc", "part": NAC, "repeat": R4, "let": NLET, "at": ["%cx", "%cy", r4(-7.45 + dz)], "r": r, "normal": [0, 0, -1], "color": col})
# the wings: hinged on their nacelle (parts 5..8), five panels to the orange spike
nodes.append({"op": "planform", "part": WING, "repeat": R4, "let": NLET, "side": "%sx", "y": "%cy",
              "x": [wingx(x) for x in wx], "lead": [wingz(l, x, l) for l, x in zip(wl, wx)], "trail": [wingz(t, x, l) for t, l, x in zip(wt, wl, wx)],
              "th": wth, "colors": [HULL, HULL, GREY, HULL, ACC]})
TIPX = mul("%sx", wingx(7.72)); TIPZ = wingz(-6.06, 7.72, -5.404)
HZ = r4(wth[4] * .5 + .012)
RING = [mul(.42, "%v_accent_r"), mul(.42, "%v_accent_g"), mul(.42, "%v_accent_b")]; THROAT = [mul(.72, "%v_accent_r"), mul(.72, "%v_accent_g"), mul(.72, "%v_accent_b")]
for dy, r, col, n in [(HZ, .2, RING, 1), (HZ + .004, .13, THROAT, 1), (-HZ, .2, RING, -1), (-HZ - .004, .13, THROAT, -1)]:
    nodes.append({"op": "disc", "part": WING, "repeat": R4, "let": NLET, "at": [TIPX, add("%cy", r4(dy)), TIPZ], "r": r, "normal": [0, n, 0], "color": col})
# the lift jets' throats on the belly's facets, ringed in the accent
for host, z, x in [("body", 1.2, .86), ("block", -6.82, .70)]:
    big = .30 if host == "body" else .27; small = .22 if host == "body" else .20
    nodes.append({"op": "disc", "repeat": {"count": 2}, "let": [{"name": "sx", "value": sub(mul(2, "@i"), 1)}], "on": {"host": host, "z": z, "x": mul("%sx", x), "face": "below", "lift": .02}, "r": big, "color": ACC})
    nodes.append({"op": "disc", "repeat": {"count": 2}, "let": [{"name": "sx", "value": sub(mul(2, "@i"), 1)}], "on": {"host": host, "z": z, "x": mul("%sx", x), "face": "below", "lift": .03}, "r": small, "color": DARK})
nodes.append({"op": "shade", "from": -.75, "to": .3, "min": .6})
nodes.append({"op": "canopy", "host": "body", "z": cnp_z, "half": cnp_a, "glass": [.04, .08, .18], "frame": [.30, .31, .34], "arches": [2, 5, 7], "rails": [2, 8], "rail_k": .62, "lift": .05, "frame_lift": .075})
# what rides the ship: engines (trails), tips (vortices, nav lights), flames, air, a light, the boost reactor
NOZ = ["%cx", "%cy", -7.50]
nodes.append({"op": "mount", "kind": "engine", "part": NAC, "repeat": R4, "let": NLET, "at": NOZ})
nodes.append({"op": "mount", "kind": "tip", "part": WING, "repeat": R4, "let": NLET, "at": [mul("%sx", wingx(9.0)), "%cy", wingz(-6.5, 9.0, -6.4)]})
nodes.append({"op": "mount", "kind": "flame", "part": NAC, "repeat": R4, "let": NLET, "at": NOZ, "drive": "thrust",
              "r": mul(.36, "%v_thrust"), "len": mul(3.6, "%v_thrust"), "color": ["%v_jet_r", "%v_jet_g", "%v_jet_b"], "core_r": mul(.17, "%v_thrust"), "core_len": mul(1.8, "%v_thrust"), "core_color": [.60, .66, .92], "core_tip": [.03, .03, .07]})
for host, z, x in [("body", 1.2, .86), ("block", -6.82, .70)]:
    nodes.append({"op": "mount", "kind": "flame", "repeat": {"count": 2}, "let": [{"name": "sx", "value": sub(mul(2, "@i"), 1)}], "on": {"host": host, "z": z, "x": mul("%sx", x), "face": "below", "lift": .05},
                  "drive": "hover", "r": .15, "len": 1.35, "color": [.06, .16, .48], "core_r": .07, "core_len": .70, "core_color": [.42, .55, .85], "core_tip": [.02, .03, .06]})
nodes.append({"op": "mount", "kind": "flame", "part": NAC, "repeat": R4, "let": NLET, "at": ["%cx", "%cy", -2.2], "drive": "retro", "axis": "forward",
              "r": .20, "len": 1.7, "color": [.10, .20, .55], "core_r": .09, "core_len": .85, "core_color": [.55, .62, .9], "core_tip": [.02, .03, .06]})
nodes.append({"op": "mount", "kind": "flame", "part": NAC, "repeat": R4, "let": NLET, "at": ["%cx", "%cy", -2.25], "drive": "pulse", "axis": "forward",
              "r": .17, "len": 1.7, "color": [.30, .14, .05], "core_r": .08, "core_len": .85, "core_color": [.55, .35, .15], "core_tip": [.03, .02, .01]})
for dy, ax in [(-.09, "down"), (.09, "up")]:
    nodes.append({"op": "mount", "kind": "flame", "part": WING, "repeat": R4, "let": NLET, "at": [TIPX, add("%cy", dy), TIPZ], "drive": "rcs", "axis": ax,
                  "r": .12, "len": .9, "color": [.25, .40, .80], "core_r": .05, "core_len": .45, "core_color": [.7, .78, .95], "core_tip": [.02, .03, .06]})
for a in [[0, -.33, 7.85], [-.95, .78, 1.6], [.95, .78, 1.6]]:
    nodes.append({"op": "mount", "kind": "air", "at": a})
nodes.append({"op": "mount", "kind": "light", "at": [0, .98, -6.9], "r": .11, "color": [2.6, 2.6, 2.8]})
nodes.append({"op": "mount", "kind": "boost", "at": [0, 0, -7.92]})
# neon: the flanks, the belly, the canopy's rim, the intakes' frames, the wings' leading edges
nodes.append({"op": "neon", "layer": 1, "repeat": {"count": 2}, "let": [{"name": "sx", "value": sub(mul(2, "@i"), 1)}], "along": {"host": "body", "mode": "side", "from": -1.6, "to": 5.2, "count": 6, "scale": 1.004, "lift": .012, "side": "%sx"}})
nodes.append({"op": "neon", "layer": 4, "repeat": {"count": 2}, "let": [{"name": "sx", "value": sub(mul(2, "@i"), 1)}], "along": {"host": "body", "mode": "below", "from": -5.6, "to": 3.4, "count": 6, "x": .42, "lift": -.03, "side": "%sx"}})
nodes.append({"op": "neon", "layer": 16, "repeat": {"count": 2}, "let": [{"name": "sx", "value": sub(mul(2, "@i"), 1)}], "along": {"host": "body", "mode": "canopy", "count": 16, "pad": .035, "lift": .03, "side": "%sx"}})
import math
hexpts = [[add("%cx", r4(math.cos(math.pi / 3 * i) * .55)), add("%cy", r4(math.sin(math.pi / 3 * i) * .48)), -2.24] for i in range(6)]
nodes.append({"op": "neon", "part": NAC, "repeat": R4, "let": NLET, "layer": 2, "closed": 1, "points": hexpts})
nodes.append({"op": "neon", "part": WING, "repeat": R4, "let": NLET, "layer": 8, "points": [[mul("%sx", wingx(wx[i])), "%cy", add(wingz(wl[i], wx[i], wl[i]), .035)] for i in range(1, 5)]})
nodes.append({"op": "stretch", "from": -1, "k": "%v_nose"})

parts = [{"id": "hull"}]
names = ["lu", "ru", "ll", "rl"]
for w, n in enumerate(names):
    up = 1 if w < 2 else -1
    var = "$upper_offset" if up > 0 else "$lower_offset"
    parts.append({"id": "nacelle_" + n, "offset": [0, mul(.30 * up, var), E("neg", var)]})
for w, n in enumerate(names):
    sx = 1 if w & 1 else -1; up = 1 if w < 2 else -1
    parts.append({"id": "wing_" + n, "parent": "nacelle_" + n, "phase": w,
                  "hinge": {"pivot": [mul(sx, "%v_spread"), .62 * up, -4.7], "side": sx, "tier": up}})

recipe = {
    "version": 1, "name": "miro", "description": "Miro's ship after the reference sheet: a cozy faceted body, a canopy laid on its back, four hexagonal nacelles at the corners of an X, each carrying a hinged delta wing; lift jets under the belly, neon.",
    "inputs": inputs, "let": LETS, "parts": parts,
    "poses": [[2, 80, 80, 1, 62], [6, 30, 30, 0, 18], [15, 13, 13, 0, 6], [32, 2, 2, 0, 0], [26, 22, -9, 0, 0]],
    "reverse_pose": [2, 74, 74, .6, 38],
    "nodes": nodes,
}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ship_miro.json")
open(out, "w", encoding="utf-8").write(json.dumps(recipe, indent=1))
print(out, len(json.dumps(recipe)), "bytes,", len(nodes), "nodes")
