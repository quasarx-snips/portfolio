// Fragment/vertex sources for the prologue black hole.
// Uniform contract (do not change without updating CosmicOpening):
//   uRes vec2, uP float, uAspect float, uCharge float, uTime float
// uP is the fall (0 = wide establishing shot, 1 = inside the flash).
//
// The image is a per-pixel null-geodesic integration in Schwarzschild spacetime.
// For every ray we build the plane of its orbit, then integrate the exact photon
// orbit equation in that plane
//
//     u'' = -u + 1.5 * rs * u^2        (u = 1/r, ' = d/dphi)
//
// with RK4. Every time the orbit crosses the equatorial plane we accumulate
// emission from the accretion disk (Novikov-Thorne-ish temperature profile,
// Keplerian shear, orbital hot knots), then sample a procedural starfield along
// the escaping direction. The shadow, the photon ring (b = 3*sqrt(3)/2 * rs),
// the far-side arc above the hole and the thin secondary image below it are all
// consequences of that integration rather than screen-space decoration.
//
// Emission is deliberately *symmetric* left/right: transverse Doppler beaming
// is dropped from the intensity (a real disk would be strongly beamed) and only
// a luminance-preserving colour-temperature offset survives. The radial surface
// brightness falls off steeply (F ~ r^-2.4) so the near-side sheet reads as a
// thin luminous sheet instead of flooding the lower half of the frame.
//
// Budget: <= 132 RK4 steps, <= 3 disk crossings, <= 2 AA samples per pixel,
// extra sky taps only inside the lensed star annulus, early-out on capture,
// escape and opacity saturation.

export const BH_VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const BH_FRAG = `
precision highp float;

uniform vec2 uRes;
uniform float uP;
uniform float uAspect;
uniform float uCharge;
uniform float uTime;

const vec3 HANDOVER = vec3(0.9725, 0.9647, 0.9412);
const float PI = 3.14159265359;

// ---------------------------------------------------------------- geometry
// Units are Schwarzschild radii (rs = 1).
const float RS = 1.0;
const float B_CRIT = 2.59807621;   // 3*sqrt(3)/2, the photon-ring impact parameter
const float R_ISCO = 2.05;         // inner disk edge (Gargantua is near-extremal Kerr)
const float R_OUT = 12.0;          // outer edge
const float R_CAM0 = 15.5;         // establishing camera radius
const float R_CAM1 = 4.6;          // radius at the end of the fall
const float FOCAL0 = 0.85;         // lens, in units of half the frame height

const int MAX_STEPS = 132;
const int MAX_HITS = 3;
const int AA = 2;

// ------------------------------------------------------------------ noise
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 m = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, m.x), mix(c, d, m.x), m.y);
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = p * 2.07 + vec2(11.3, 5.7);
    a *= 0.5;
  }
  return v * 1.14;
}

// -------------------------------------------------------------- starfield
// Stars live in a 3D lattice sampled by direction; the lattice offset along the
// screen-radial axis is stretched while the camera falls, so the sky streaks
// past instead of merely sliding.
vec3 starShell(vec3 d, vec3 axis, float scale, float seed, float gate, float streak, float size) {
  vec3 sd = d * scale + vec3(seed);
  vec3 c = floor(sd);
  float h = hash31(c);
  if (h < gate) return vec3(0.0);
  vec3 sp = c + 0.18 + 0.64 * vec3(hash31(c + 1.7), hash31(c + 9.3), hash31(c + 4.1));
  vec3 off = sd - sp;
  float a = dot(off, axis);
  float perp2 = max(dot(off, off) - a * a, 0.0);
  float dist2 = perp2 + (a * a) / (streak * streak);
  float mag = pow(hash31(c + 21.0), 3.0);
  float core = exp(-dist2 * (2.6 / (size * size)));
  vec3 tint = mix(vec3(0.74, 0.81, 1.0), vec3(1.0, 0.90, 0.76), hash31(c + 31.0));
  float twinkle = 0.86 + 0.14 * sin(uTime * 2.1 + h * 41.0);
  return tint * core * (0.05 + 0.95 * mag) * twinkle;
}

vec3 sky(vec3 d, vec3 axis, float p, float prox) {
  float streak = 1.0 + 7.0 * p * p;
  // Near the critical curve the images are magnified and smeared, so the star
  // cores are drawn wider (and dimmer per pixel) to read as arcs.
  float wide = 1.0 + 4.5 * prox * prox;
  vec3 c = 2.2 * starShell(d, axis, 96.0, 0.0, 0.987, streak, 0.32 * wide);
  c += 1.6 * starShell(d, axis, 168.0, 7.0, 0.982, streak, 0.28 * wide);
  // A faint cold veil so the sky is not pure black between the stars.
  float dust = fbm3(vec2(d.x, d.z) * 2.6 + d.y * 1.7);
  c += vec3(0.005, 0.007, 0.012) * smoothstep(0.35, 0.95, dust);
  return c;
}

// Near the critical curve the lens mapping shears enormously: a single star is
// drawn out into a long arc that hugs the photon ring. A point source has one
// image per extra half-winding, and those images slide along the critical curve
// as the impact parameter changes, i.e. as the escaping direction is rotated
// about the ray's orbital normal. Smearing the sky sample that way turns the
// sparse starfield into Einstein-ring arcs. prox is 1 on the critical curve and
// decays outward.
vec3 skyLensed(vec3 d, vec3 axis, vec3 nrm, float p, float prox) {
  vec3 c = sky(d, axis, p, prox);
  if (prox > 0.05) {
    float span = 0.10 * prox;
    for (int j = 0; j < 4; j++) {
      float tt = (float(j) - 1.5) * 0.667;
      float ang = tt * span;
      float ca = cos(ang);
      float sa = sin(ang);
      vec3 dr = d * ca + cross(nrm, d) * sa + nrm * dot(nrm, d) * (1.0 - ca);
      c = max(c, 0.55 * sky(normalize(dr), axis, p, prox));
    }
  }
  return c * (1.0 + 0.55 * prox);
}

// --------------------------------------------------------------- hot knots
// Localised over-densities embedded in the disk, advected with the local
// Keplerian angular velocity; each one breathes on its own slow time scale.
float hotKnot(float rr, float az, float rk, float ph0, float seed) {
  float om = 1.9 * pow(max(rk, 0.6), -1.5);
  float ph = ph0 + om * uTime;
  float d = az - ph;
  d -= 2.0 * PI * floor(d / (2.0 * PI) + 0.5);
  float arc = d * rk;
  float w = 0.40 + 0.09 * rk;
  float dr = (rr - rk) / (0.36 + 0.07 * rk);
  float q = (arc * arc) / (w * w) + dr * dr;
  float body = exp(-q * 1.35);
  float flick = 0.70 + 0.30 * sin(uTime * 2.3 + seed * 5.1) * sin(uTime * 0.83 + seed * 2.7);
  return body * flick;
}

// ------------------------------------------------------------------- disk
// Accumulates one equatorial crossing. vdir is the direction of travel of the
// traced ray at the crossing (away from the camera), rr the crossing radius.
void diskLight(float rr, vec3 p3, vec3 vdir, float weight, inout vec3 acc, inout float trans) {
  // Co-rotating frame: Keplerian shear is what winds the filaments into spirals.
  float omega = 1.9 * pow(max(rr, 0.6), -1.5);
  float spin = -omega * uTime;
  float cs = cos(spin);
  float sn = sin(spin);
  vec2 rp = vec2(p3.x * cs - p3.z * sn, p3.x * sn + p3.z * cs);
  float lr = log(max(rr, 0.5));
  vec2 ud = rp / max(length(rp), 1.0e-3);

  // Turbulence: clouds in the disk plane plus streaky fields sampled in a
  // radially stretched, cylindrical domain (continuous through the azimuth).
  float clump = fbm3(rp * 0.50 + 3.7);
  float b1 = fbm3(vec2(lr * 26.0, 0.0) + ud * 2.10 + 2.0);
  float b2 = fbm3(vec2(lr * 110.0, 0.0) + ud * 16.0 + 9.0);
  float b3 = fbm3(rp * 6.50 + 17.0);
  float fil = smoothstep(0.32, 0.74, b1) * (0.55 + 0.45 * smoothstep(0.28, 0.72, b2));
  // A filled sheet with filamentary modulation rather than isolated rings.
  float dens = (0.50 + 1.05 * fil) * (0.35 + 1.05 * clump) * (0.72 + 0.48 * b3);

  // Torn outer rim: a ragged, noisy edge instead of a clean ellipse.
  float rOut = R_OUT * (0.86 + 0.30 * fbm3(ud * 2.6 + 6.0));
  float t = (rr - R_ISCO) / (rOut - R_ISCO);
  if (t < 0.0) {
    // Very faint plunging-region glow, kept low so the shadow interior stays
    // black; it only softens the innermost silhouette.
    float k = exp(-(R_ISCO - rr) * 16.0) * weight;
    if (k > 0.002) {
      acc += trans * vec3(1.0, 0.84, 0.58) * (0.045 * k);
      trans *= 1.0 - 0.05 * k;
    }
    return;
  }
  // Steep outer fade: the bright gas is the inner rim and the mid disk. The
  // wings survive as warm amber, but the outer sheet no longer floods the
  // lower half of the frame with a flat brown wash.
  float edge = smoothstep(0.0, 0.05, t) * exp(-max(t - 0.34, 0.0) * 3.4);
  if (edge < 0.003) return;

  // Kerr-ish orbital speed in the local static frame (v = sqrt(M/r), rs = 2M).
  vec3 vphi = normalize(vec3(p3.z, 0.0, -p3.x) + vec3(1e-6, 0.0, 0.0));
  float beta = min(0.72, sqrt(0.5 / max(rr, 0.62)));
  float gam = inversesqrt(max(1.0 - beta * beta, 0.06));
  // Static-frame redshift: purely radial, therefore symmetric left/right.
  float gGrav = sqrt(max(1.0 - RS / rr, 0.02)) / gam;
  // Frequency ratio including the transverse Doppler term; used only for a
  // barely perceptible colour-temperature shift, never for luminance.
  float gFull = gGrav / max(0.22, 1.0 + beta * dot(vphi, vdir));

  // Temperature proxy ~ r^(-3/4).
  float temp = pow(clamp(R_ISCO / rr, 0.0, 1.0), 0.72) * (0.90 + 0.12 * gGrav)
             * (0.97 + 0.06 * b2);
  vec3 col = mix(vec3(0.78, 0.15, 0.02), vec3(1.0, 0.42, 0.07), smoothstep(0.18, 0.42, temp));
  col = mix(col, vec3(1.0, 0.70, 0.24), smoothstep(0.42, 0.64, temp));
  col = mix(col, vec3(1.0, 0.90, 0.60), smoothstep(0.64, 0.86, temp));
  col = mix(col, vec3(1.0, 0.96, 0.87), smoothstep(0.90, 1.08, temp));

  // Luminance-preserving chromatic offset only: the approaching side is a
  // hair cooler, the receding side a hair warmer. Mean luminance is identical,
  // so the two halves of the disk read equally bright.
  float dsh = clamp((gFull - 1.0) * 0.5, -0.6, 0.6);
  col *= mix(vec3(1.0), vec3(0.98, 1.0, 1.03), max(dsh, 0.0));
  col *= mix(vec3(1.0), vec3(1.02, 1.0, 0.97), max(-dsh, 0.0));

  // Symmetric intensity: no transverse-Doppler beaming at all.
  float beam = 1.0;

  // Grazing crossings travel further through the gas; the exponent keeps the
  // sheet from ballooning into a thick haze at the limb.
  float mu = abs(vdir.y);
  float path = clamp(0.28 / max(mu, 0.06), 0.65, 1.85);

  // Surface brightness of a thin, radiative disk: steep radial falloff, with
  // the hottest, whitest gas hugging the inner edge.
  float prof = pow(clamp(R_ISCO / rr, 0.0, 1.0), 1.30);
  float bright = prof * (0.55 + 0.45 * smoothstep(0.0, 0.10, t));
  bright *= 1.0 + 0.70 * exp(-(rr - R_ISCO) * 1.6)
          + 0.45 * exp(-(rr - R_ISCO) * 0.55);

  // Orbiting hot knots: three clumps at different radii and phases. They live
  // in the mid/outer disk, where the gas is not already white, so the clumps
  // read as localised hot spots rather than being swallowed by the rim.
  float az = atan(p3.z, p3.x);
  float kn = hotKnot(rr, az, 4.20, 0.85, 1.0);
  kn = max(kn, 1.00 * hotKnot(rr, az, 6.00, 3.55, 2.0));
  kn = max(kn, 0.85 * hotKnot(rr, az, 8.00, 5.30, 3.0));
  bright *= 1.0 + 4.50 * kn;
  dens *= 1.0 + 1.10 * kn;
  col = mix(col, vec3(1.0, 0.97, 0.90), clamp(kn * 0.75, 0.0, 0.8));
  col = mix(col, vec3(0.96, 0.975, 1.0), clamp(kn * 0.30, 0.0, 0.35));

  float glow = 1.0 + 0.45 * clamp(uCharge, 0.0, 1.0) * (1.0 - smoothstep(0.0, 0.25, t));
  const float EMIT = 2.00;

  // An optically thick disk seen from just above its plane shows its lit face
  // on downward crossings; upward crossings see the shadowed underside.
  float face = mix(0.12, 1.0, smoothstep(-0.035, 0.035, -vdir.y));
  float alpha = clamp(edge * path * (0.42 + 0.36 * dens) * weight * face, 0.0, 0.985);
  acc += trans * col * (bright * beam * pow(dens, 1.60) * edge * glow * EMIT * weight * face);
  trans *= 1.0 - alpha;
}

// ---------------------------------------------------------------- geodesic
// Traces one photon. Returns radiance; escaped says whether the sky was hit.
vec3 trace(vec3 camPos, vec3 dir, float p, vec3 axis, inout float escaped) {
  float r0 = length(camPos);
  vec3 e1 = camPos / r0;
  vec3 cr = cross(e1, dir);
  float sinPsi = length(cr);
  escaped = 0.0;
  if (sinPsi < 1.0e-4) return vec3(0.0);   // radial plunge through the centre

  vec3 nrm = cr / sinPsi;
  vec3 e2 = cross(nrm, e1);

  float b = r0 * sinPsi * inversesqrt(max(1.0 - RS / r0, 1.0e-3));
  float u = 1.0 / r0;
  float w = sqrt(max(1.0 / (b * b) - u * u * (1.0 - RS * u), 0.0));
  float phi = 0.0;

  // Equatorial crossings: the orbit plane meets y = 0 along one line, so hits
  // occur at phi1 + k*PI. Fold the first one into (0, PI).
  vec3 dint = cross(nrm, vec3(0.0, 1.0, 0.0));
  float phi1 = 0.5 * PI;
  float dl = length(dint);
  if (dl > 1.0e-5) {
    dint /= dl;
    phi1 = atan(dot(dint, e2), dot(dint, e1));
    phi1 -= PI * floor(phi1 / PI);
  }

  vec3 acc = vec3(0.0);
  float trans = 1.0;
  float hitPhi = phi1;
  int hits = 0;
  float captured = 0.0;

  for (int i = 0; i < MAX_STEPS; i++) {
    float dphi = clamp(0.45 * u / (abs(w) + 0.05), 0.006, 0.09);

    // u' = w, w' = -u + 1.5*rs*u^2
    float a1 = -u + 1.5 * RS * u * u;
    float u2 = u + 0.5 * dphi * w;
    float w2 = w + 0.5 * dphi * a1;
    float a2 = -u2 + 1.5 * RS * u2 * u2;
    float u3 = u + 0.5 * dphi * w2;
    float w3 = w + 0.5 * dphi * a2;
    float a3 = -u3 + 1.5 * RS * u3 * u3;
    float u4 = u + dphi * w3;
    float w4 = w + dphi * a3;
    float a4 = -u4 + 1.5 * RS * u4 * u4;

    float un = u + (dphi / 6.0) * (w + 2.0 * w2 + 2.0 * w3 + w4);
    float wn = w + (dphi / 6.0) * (a1 + 2.0 * a2 + 2.0 * a3 + a4);
    float phiNext = phi + dphi;

    if (phiNext >= hitPhi && hits < MAX_HITS) {
      // Local Taylor step to the exact crossing angle.
      float dc = hitPhi - phi;
      float uc = u + w * dc + 0.5 * (-u + 1.5 * RS * u * u) * dc * dc;
      if (uc > 1.0e-5) {
        float rr = 1.0 / uc;
        float cph = cos(hitPhi);
        float sph = sin(hitPhi);
        vec3 er = cph * e1 + sph * e2;
        vec3 ep = -sph * e1 + cph * e2;
        vec3 p3 = rr * er;
        // Direction of travel at the crossing (d/dphi of r*(cos,sin)).
        vec3 vd = -w * er + u * ep;
        float vl = length(vd);
        // Higher-order images are demagnified: weight them down.
        float hw = hits == 0 ? 1.0 : (hits == 1 ? 0.42 : 0.18);
        if (vl > 1.0e-6) diskLight(rr, p3, vd / vl, hw, acc, trans);
      }
      hits++;
      hitPhi += PI;
    }

    u = un;
    w = wn;
    phi = phiNext;

    if (u > 1.02) { captured = 1.0; break; }               // horizon
    if (u < 0.011 && w < 0.0) break;                       // escaped
    if (trans < 0.025) break;                              // opaque
  }

  // Distance from the critical curve, in units of B_CRIT.
  float ringEdge = (b - B_CRIT) / B_CRIT;

  // Every ray that is not captured escapes eventually; near-critical ones would
  // need many more windings than the budget allows, so sample the sky from the
  // direction they have reached. That keeps the shadow edge exactly at b_crit.
  if (captured < 0.5) {
    vec3 er = cos(phi) * e1 + sin(phi) * e2;
    vec3 ep = -sin(phi) * e1 + cos(phi) * e2;
    // Einstein-ring arcs: background stars are lensed into radial streaks that
    // pile up against the critical curve. The extra taps are only spent in the
    // thin annulus around the ring so the open sky stays crisp and cheap.
    float re = max(ringEdge, 0.0);
    float prox = (0.90 * exp(-re * 5.0) + 0.10 * exp(-re * 1.2)) * smoothstep(-0.02, 0.004, ringEdge);
    float proxOuter = 0.26 * exp(-max(ringEdge - 0.30, 0.0) * 5.0) * smoothstep(0.0, 0.06, ringEdge);
    float pl = max(prox, proxOuter);
    // Foreground gas hides background stars: the sky only shows where the disk
    // has not already filled the pixel with light.
    float veil = dot(acc, vec3(0.30, 0.59, 0.11));
    acc += trans * skyLensed(normalize(-w * er + u * ep), axis, nrm, p, pl)
         / (1.0 + 6.0 * veil);
    escaped = 1.0;
  }

  // The photon ring itself: a crisp, thin, slightly warm white line at
  // b = 3*sqrt(3)/2 * rs with a soft halo, the accumulated higher-order images
  // of the disk and sky.
  float ringCore = exp(-max(ringEdge, 0.0) * 45.0) * smoothstep(-0.0012, 0.0032, ringEdge);
  float ringHalo = exp(-max(ringEdge, 0.0) * 10.0) * smoothstep(-0.0012, 0.005, ringEdge);
  float ringAmp = 0.80 + 0.25 * clamp(uCharge, 0.0, 1.0);
  acc += trans * (vec3(1.0, 0.955, 0.895) * ringCore * ringAmp
                + vec3(1.0, 0.84, 0.60) * ringHalo * 0.13);

  return acc;
}

// ------------------------------------------------------------- tonemapping
vec3 tonemap(vec3 x) {
  // Exponential shoulder: keeps the shadows black, rolls highlights to white.
  return vec3(1.0) - exp(-max(x, vec3(0.0)));
}

void main() {
  float p = clamp(uP, 0.0, 1.0);
  // Handover frame: the next scene expects exactly this colour, everywhere.
  if (p >= 0.98) {
    gl_FragColor = vec4(HANDOVER, 1.0);
    return;
  }

  float charge = clamp(uCharge, 0.0, 1.0);

  // Camera: the fall pulls it in exponentially, so the shadow grows smoothly.
  float fall = pow(clamp(p / 0.9, 0.0, 1.0), 1.7);
  float rCam = R_CAM0 * pow(R_CAM1 / R_CAM0, fall);
  float elev = 0.056 + 0.060 * fall + 0.004 * sin(uTime * 0.13);
  float azim = 0.62 + 0.40 * fall + 0.015 * uTime;
  vec3 camPos = rCam * vec3(cos(elev) * sin(azim), sin(elev), cos(elev) * cos(azim));
  vec3 fwd = -camPos / rCam;
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);

  // Portrait screens get a slightly longer lens so the hole keeps the framing
  // that the host's CSS hint ring assumes.
  float focal = FOCAL0 * (1.0 + 0.55 * max(0.0, 1.0 - uAspect));
  // Screen radius of the shadow (b_crit at this camera distance), used for the
  // bloom that gathers on the rim as the fall lights up.
  float shAng = asin(clamp(B_CRIT * sqrt(max(1.0 - RS / rCam, 0.0)) / rCam, 0.0, 1.0));
  float shR = focal * tan(shAng);

  vec3 col = vec3(0.0);
  for (int s = 0; s < AA; s++) {
    float fs = float(s);
    vec2 grid = vec2(mod(fs, 2.0), floor(fs * 0.5)) - 0.5;
    vec2 rot = vec2(0.9272 * grid.x - 0.3746 * grid.y, 0.3746 * grid.x + 0.9272 * grid.y);
    vec2 jitter = rot * 0.42 + 0.08 * (vec2(hash21(gl_FragCoord.xy + fs), hash21(gl_FragCoord.yx + fs)) - 0.5);
    vec2 uv = (gl_FragCoord.xy + jitter - 0.5 * uRes) / uRes.y;

    vec3 dir = normalize(fwd * focal + right * uv.x + up * uv.y);
    vec3 axis = normalize(right * uv.x + up * uv.y + fwd * 1.0e-4);
    float esc = 0.0;
    col += trace(camPos, dir, p, axis, esc);
  }
  col /= float(AA);

  vec2 uv0 = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  // Exposure climbs as we fall into the light.
  float expo = 2.40 + 0.90 * smoothstep(0.0, 0.72, p) + 6.0 * smoothstep(0.80, 0.96, p);
  col *= expo;

  // Halation: hot cores desaturate to warm white the way a bloom pass would,
  // then the veiling haze and rim glow gather light around the brightest gas.
  float lum = dot(col, vec3(0.30, 0.59, 0.11));
  col = mix(col, vec3(1.0, 0.95, 0.88) * lum, clamp(smoothstep(1.10, 4.20, lum) * 0.72, 0.0, 0.62));
  // Thin warm haze along the disk plane (halation off the sheet, not a floor).
  float band = exp(-pow(abs(uv0.y) / 0.135, 2.0));
  col += vec3(1.0, 0.62, 0.30) * 0.030 * (0.35 + 0.65 * smoothstep(0.0, 0.5, p)) * band
       * (0.35 + 0.65 * smoothstep(0.02, 0.55, abs(uv0.x) * 0.8 + 0.2));
  // Bloom gathering on the shadow rim: a crisp inner halo plus a wide soft one.
  float rimD = abs(length(uv0) - shR);
  col += vec3(1.0, 0.90, 0.76) * exp(-rimD * 8.0) * (0.016 + 0.22 * smoothstep(0.55, 0.95, p));
  col += vec3(1.0, 0.80, 0.55) * exp(-rimD * 2.4) * (0.020 + 0.10 * smoothstep(0.55, 0.95, p));

  col = tonemap(col);

  // Grade: gentle S-curve, warm highlights, cool shadows, vignette, grain.
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.28);
  col = mix(col, col * vec3(1.03, 1.0, 0.95), 0.5);
  col *= 1.0 - 0.20 * pow(length(uv0 * vec2(0.62, 1.0)) * 1.35, 2.0);
  col = clamp(col, 0.0, 1.0);

  // The flash: light first, then the exact handover white.
  float surge = smoothstep(0.80, 0.955, p);
  col = mix(col, vec3(1.0, 0.985, 0.955), surge * 0.9);
  float white = smoothstep(0.885, 0.985, p);
  col = mix(col, HANDOVER, white);

  float grain = hash21(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5;
  col += grain * 0.018 * (1.0 - white) * (1.0 - 0.6 * dot(col, vec3(0.333)));

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
