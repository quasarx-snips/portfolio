from pathlib import Path
p = Path('src/styles/cinematic.css')
s = p.read_text()
marker = "/* ------------------------------------------------------------- the narration */"
css = """/* -------------------------------------------------------------- pointer fog */

.pointer-fog {
  position: absolute;
  inset: -14%;
  z-index: 3;
  pointer-events: none;
  opacity: 0;
  transform: translate3d(0, 0, 0);
  will-change: transform, opacity;
  contain: layout paint;
}

.pointer-fog--front {
  inset: -20%;
  z-index: 6;
  mix-blend-mode: screen;
}

.pf {
  position: absolute;
  display: block;
  border-radius: 50%;
  pointer-events: none;
}

.pf-back-a {
  left: -14%;
  top: 22%;
  width: 74%;
  height: 58%;
  background: radial-gradient(
    ellipse at 42% 58%,
    rgba(198, 212, 208, 0.22) 0%,
    rgba(198, 212, 208, 0.08) 44%,
    rgba(198, 212, 208, 0) 72%
  );
}

.pf-back-b {
  left: 16%;
  top: 46%;
  width: 88%;
  height: 48%;
  background: radial-gradient(
    ellipse at 52% 54%,
    rgba(174, 192, 189, 0.18) 0%,
    rgba(174, 192, 189, 0.06) 48%,
    rgba(174, 192, 189, 0) 74%
  );
}

.pf-back-c {
  left: -8%;
  top: 60%;
  width: 76%;
  height: 38%;
  background: radial-gradient(
    ellipse at 46% 50%,
    rgba(214, 224, 218, 0.16) 0%,
    rgba(214, 224, 218, 0.05) 50%,
    rgba(214, 224, 218, 0) 76%
  );
}

.pf-front-a {
  left: -26%;
  top: 52%;
  width: 90%;
  height: 38%;
  background: radial-gradient(
    ellipse at 50% 54%,
    rgba(226, 234, 227, 0.12) 0%,
    rgba(226, 234, 227, 0.035) 50%,
    rgba(226, 234, 227, 0) 76%
  );
}

.pf-front-b {
  left: 24%;
  top: 64%;
  width: 82%;
  height: 30%;
  background: radial-gradient(
    ellipse at 48% 50%,
    rgba(236, 241, 233, 0.1) 0%,
    rgba(236, 241, 233, 0.03) 52%,
    rgba(236, 241, 233, 0) 78%
  );
}

/* A pale lantern travelling through the mist with the cursor. */
.pf-light {
  position: absolute;
  left: calc(50% - 30vmin);
  top: calc(50% - 30vmin);
  width: 60vmin;
  height: 60vmin;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, opacity;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(255, 232, 198, 0.16) 0%,
    rgba(244, 224, 196, 0.06) 34%,
    rgba(228, 222, 206, 0.02) 56%,
    rgba(228, 222, 206, 0) 72%
  );
}

@media (hover: none), (pointer: coarse) {
  .pointer-fog {
    display: none;
  }
}

"""
s = s.replace(marker, css + marker, 1)
p.write_text(s)

p = Path('src/cine/Cinematic.tsx')
s = p.read_text()
s = s.replace("import Narrative from './scenes/Narrative';", "import Narrative from './scenes/Narrative';\nimport PointerFog from './PointerFog';")
s = s.replace("          <Smoke part=\"back\" mobile={narrow} />\n          <Narrative />", "          <Smoke part=\"back\" mobile={narrow} />\n          <PointerFog />\n          <Narrative />")
p.write_text(s)
print('ok')
