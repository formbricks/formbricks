"""Procedural geometry helpers for the water-gecko build.

The whole creature is made of "sweeps": a smooth centreline (Catmull-Rom through
a handful of stations) with a cross-section whose size and shape are
interpolated along it.  Every sweep keeps the arc-length parameter of each ring,
which is what the rigging pass later uses to derive skin weights: a bone owns an
interval of that same parameter, so weights are exact by construction instead of
being guessed from 3D distance.
"""

import math

from mathutils import Matrix, Vector

# --------------------------------------------------------------------------- #
# scalar helpers
# --------------------------------------------------------------------------- #


def clamp(x, lo=0.0, hi=1.0):
    return lo if x < lo else (hi if x > hi else x)


def smoothstep(e0, e1, x):
    """Classic clamped cubic ease between two edges."""
    if abs(e1 - e0) < 1e-12:
        return 0.0 if x < e0 else 1.0
    t = clamp((x - e0) / (e1 - e0))
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def cr_eval(vals, u):
    """Uniform Catmull-Rom through `vals` (floats or Vectors), u in [0, 1].

    End tangents come from reflecting the neighbour, so the curve leaves the
    first/last station straight instead of flattening out.
    """
    n = len(vals)
    if n == 1:
        return vals[0]
    if n == 2:
        return vals[0] * (1.0 - u) + vals[1] * u
    seg = n - 1
    x = clamp(u) * seg
    j = min(int(math.floor(x)), seg - 1)
    t = x - j

    def g(i):
        if i < 0:
            return vals[0] * 2.0 - vals[1]
        if i > n - 1:
            return vals[n - 1] * 2.0 - vals[n - 2]
        return vals[i]

    p0, p1, p2, p3 = g(j - 1), g(j), g(j + 1), g(j + 2)
    t2 = t * t
    t3 = t2 * t
    return (
        p1 * 2.0 + (p2 - p0) * t + (p0 * 2.0 - p1 * 5.0 + p2 * 4.0 - p3) * t2 + (p1 * 3.0 - p0 - p2 * 3.0 + p3) * t3
    ) * 0.5


# --------------------------------------------------------------------------- #
# cross sections
# --------------------------------------------------------------------------- #

# A station is a dict; these are the defaults for anything it leaves out.
STATION_DEFAULTS = {
    "rx": 0.1,  # half width  (along the frame's side axis)
    "rz": 0.1,  # half height (along the frame's up axis)
    "dz": 0.0,  # centre offset along the up axis
    "dx": 0.0,  # centre offset along the side axis
    "belly": 1.0,  # < 1 squashes the lower half (flat belly)
    "widelow": 1.0,  # > 1 widens the lower half (pear-shaped section)
}
_CHANNELS = tuple(STATION_DEFAULTS)


def ring_points(centre, side, up, p, nsides):
    """One closed cross-section, evaluated counter-clockwise from `side`.

    `belly`/`widelow` are applied as smooth quadratics in sin(theta) so the
    section stays C1 - a naive "scale the bottom half" would leave a crease
    right along the equator.
    """
    a = (1.0 + p["belly"]) * 0.5
    b = (1.0 - p["belly"]) * 0.5
    c = (1.0 + p["widelow"]) * 0.5
    d = (1.0 - p["widelow"]) * 0.5
    o = centre + side * p["dx"] + up * p["dz"]
    pts = []
    for i in range(nsides):
        th = 2.0 * math.pi * i / nsides
        s = math.sin(th)
        u = p["rx"] * math.cos(th) * (c + d * s)
        v = p["rz"] * (a * s + b * s * s)
        pts.append(o + side * u + up * v)
    return pts


# --------------------------------------------------------------------------- #
# Sweep
# --------------------------------------------------------------------------- #


class Sweep:
    """A tube lofted along a Catmull-Rom centreline.

    Rings are placed at even arc length, and each one records both the spline
    parameter `u` and the normalised arc position `s` - `s` is the handle the
    rigging pass uses.
    """

    def __init__(self, stations, n_rings, n_sides, up_hint=(0.0, 0.0, 1.0), dense=400):
        self.stations = [dict(STATION_DEFAULTS, **st) for st in stations]
        self.n_sides = n_sides
        self.pos = [Vector(st["pos"]) for st in self.stations]
        self.up_hint = Vector(up_hint).normalized()

        # --- dense sample, arc-length table, rotation-minimising frames ------
        self._du = [i / (dense - 1) for i in range(dense)]
        self._dp = [cr_eval(self.pos, u) for u in self._du]
        self._darc = [0.0]
        for i in range(1, dense):
            self._darc.append(self._darc[-1] + (self._dp[i] - self._dp[i - 1]).length)
        self.length = self._darc[-1]

        tangents = []
        for i in range(dense):
            i0 = max(0, i - 1)
            i1 = min(dense - 1, i + 1)
            t = self._dp[i1] - self._dp[i0]
            tangents.append(t.normalized() if t.length > 1e-9 else Vector((0, 1, 0)))
        self._dframes = self._transport(tangents)

        # --- place rings at even arc length ---------------------------------
        self.u = []
        self.s = []
        self.centres = []
        self.rings = []
        self.params = []
        for k in range(n_rings):
            s = k / (n_rings - 1)
            u = self._u_at_arc(s * self.length)
            side, up = self.frame_at(u)
            p = self.params_at(u)
            c = cr_eval(self.pos, u)
            self.u.append(u)
            self.s.append(s)
            self.centres.append(c)
            self.params.append(p)
            self.rings.append(ring_points(c, side, up, p, n_sides))

    # -- internals ---------------------------------------------------------- #

    def _transport(self, tangents):
        """Parallel-transport the up vector so the tube does not twist."""
        up = self.up_hint.copy()
        t0 = tangents[0]
        up = (up - t0 * up.dot(t0)).normalized()
        frames = []
        prev_t = t0
        for t in tangents:
            rot = prev_t.rotation_difference(t)
            up = (rot @ up)
            up = (up - t * up.dot(t))
            if up.length < 1e-7:  # degenerate; re-seed from the hint
                up = (self.up_hint - t * up.dot(t))
            up.normalize()
            side = t.cross(up).normalized()
            frames.append((side, up))
            prev_t = t
        return frames

    def _u_at_arc(self, target):
        arc = self._darc
        if target <= 0:
            return 0.0
        if target >= self.length:
            return 1.0
        lo, hi = 0, len(arc) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if arc[mid] <= target:
                lo = mid
            else:
                hi = mid
        span = arc[hi] - arc[lo]
        f = 0.0 if span < 1e-12 else (target - arc[lo]) / span
        return lerp(self._du[lo], self._du[hi], f)

    def _dense_index(self, u):
        return min(len(self._du) - 1, max(0, int(round(clamp(u) * (len(self._du) - 1)))))

    # -- public queries ----------------------------------------------------- #

    def frame_at(self, u):
        return self._dframes[self._dense_index(u)]

    def params_at(self, u):
        return {ch: cr_eval([st[ch] for st in self.stations], u) for ch in _CHANNELS}

    def s_of_u(self, u):
        """Arc fraction for a spline parameter (inverse of the ring placement)."""
        i = self._dense_index(u)
        return self._darc[i] / self.length if self.length > 1e-12 else 0.0

    def point_at_u(self, u):
        return cr_eval(self.pos, u)

    def point_at_s(self, s):
        return cr_eval(self.pos, self._u_at_arc(clamp(s) * self.length))

    def u_at_s(self, s):
        return self._u_at_arc(clamp(s) * self.length)

    def surface_at(self, u, theta, out=0.0):
        """A point on the tube's skin at (spline parameter, angle), pushed out."""
        side, up = self.frame_at(u)
        p = dict(self.params_at(u))
        p["rx"] += out
        p["rz"] += out
        a = (1.0 + p["belly"]) * 0.5
        b = (1.0 - p["belly"]) * 0.5
        c = (1.0 + p["widelow"]) * 0.5
        d = (1.0 - p["widelow"]) * 0.5
        s = math.sin(theta)
        o = self.point_at_u(u) + side * p["dx"] + up * p["dz"]
        return o + side * (p["rx"] * math.cos(theta) * (c + d * s)) + up * (p["rz"] * (a * s + b * s * s))


# --------------------------------------------------------------------------- #
# MeshBuilder
# --------------------------------------------------------------------------- #


class MeshBuilder:
    """Accumulates verts/faces plus the per-vertex bookkeeping the rig needs."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.part = []  # per vertex: which sweep it came from
        self.sval = []  # per vertex: arc position within that sweep
        self.tval = []  # per vertex: angle fraction around the section
        self.face_mat = []
        self.uv1 = []  # per loop, in face order
        self.uv2 = []

    # -- low level ---------------------------------------------------------- #

    def _push_vert(self, co, part, s, t):
        self.verts.append(Vector(co))
        self.part.append(part)
        self.sval.append(s)
        self.tval.append(t)
        return len(self.verts) - 1

    def _push_face(self, idx, mat, uv1, uv2):
        self.faces.append(tuple(idx))
        self.face_mat.append(mat)
        self.uv1.extend(uv1)
        self.uv2.extend(uv2)

    # -- sweeps ------------------------------------------------------------- #

    def add_sweep(
        self,
        sweep,
        part,
        mat=0,
        uv_band=(0.0, 1.0),
        cap_start=True,
        cap_end=True,
        mirror=False,
    ):
        """Loft `sweep` into the buffer.  `mirror` negates X and flips winding."""
        ns = sweep.n_sides
        nr = len(sweep.rings)
        sx = -1.0 if mirror else 1.0
        grid = []
        for ri, ring in enumerate(sweep.rings):
            row = []
            for ti, co in enumerate(ring):
                p = Vector((co.x * sx, co.y, co.z))
                row.append(self._push_vert(p, part, sweep.s[ri], ti / ns))
            grid.append(row)

        v0, v1 = uv_band

        def uv(ri, ti):
            return (sweep.s[ri], v0 + (v1 - v0) * (ti / ns))

        for ri in range(nr - 1):
            for ti in range(ns):
                tn = (ti + 1) % ns
                quad = [grid[ri][ti], grid[ri][tn], grid[ri + 1][tn], grid[ri + 1][ti]]
                uvs = [uv(ri, ti), uv(ri, ti + 1), uv(ri + 1, ti + 1), uv(ri + 1, ti)]
                if mirror:
                    quad.reverse()
                    uvs.reverse()
                self._push_face(quad, mat, uvs, [(0.5, 0.5)] * 4)

        # n-gon caps: Catmull-Clark rounds these off, and they sit at the
        # narrow ends (snout, tail tip, toe pads) where that is what we want.
        if cap_start:
            face = list(reversed(grid[0]))
            uvs = [uv(0, ns - 1 - i) for i in range(ns)]
            if mirror:
                face.reverse()
                uvs.reverse()
            self._push_face(face, mat, uvs, [(0.5, 0.5)] * ns)
        if cap_end:
            face = list(grid[nr - 1])
            uvs = [uv(nr - 1, i) for i in range(ns)]
            if mirror:
                face.reverse()
                uvs.reverse()
            self._push_face(face, mat, uvs, [(0.5, 0.5)] * ns)
        return grid

    # -- dome (eyes) -------------------------------------------------------- #

    def add_dome(self, matrix, part, mat=0, rings=10, sides=24, arc=0.62, mirror=False):
        """A squashed sphere cap in `matrix` space, UV-mapped face-on in uv2.

        Used for the eyes: the flat projection is exactly what a stylised eye
        texture wants, and the base ring stays buried in the head.
        """
        sx = -1.0 if mirror else 1.0
        grid = []
        for ri in range(rings + 1):
            # Bias the first ring off the pole.  A true pole would stack
            # `sides` coincident vertices on one point, which leaves the shell
            # non-manifold and gives Catmull-Clark a fan of slivers to chew on;
            # a tiny n-gon cap instead is both watertight and smoother.
            f = ((ri + 0.55) / (rings + 0.55)) ** 1.25
            a = arc * math.pi * f
            row = []
            for ti in range(sides):
                th = 2.0 * math.pi * ti / sides
                lx = math.sin(a) * math.cos(th)
                ly = math.sin(a) * math.sin(th)
                lz = math.cos(a)
                co = matrix @ Vector((lx, ly, lz))
                row.append(
                    (
                        self._push_vert(Vector((co.x * sx, co.y, co.z)), part, f, ti / sides),
                        (0.5 + 0.5 * lx * (-sx), 0.5 + 0.5 * ly),
                    )
                )
            grid.append(row)

        for ri in range(rings):
            for ti in range(sides):
                tn = (ti + 1) % sides
                quad = [grid[ri][ti], grid[ri][tn], grid[ri + 1][tn], grid[ri + 1][ti]]
                idx = [q[0] for q in quad]
                uvs = [q[1] for q in quad]
                if mirror:
                    idx.reverse()
                    uvs.reverse()
                self._push_face(idx, mat, [(0.5, 0.5)] * 4, uvs)

        # cap the tip and the buried base ring; winding is fixed up later by
        # recalc_face_normals, so only the vertex order within a ring matters
        for ring_i in (0, rings):
            face = [q[0] for q in grid[ring_i]]
            uvs = [q[1] for q in grid[ring_i]]
            if ring_i == 0:
                face.reverse()
                uvs.reverse()
            self._push_face(face, mat, [(0.5, 0.5)] * sides, uvs)
        return grid
