# Icon sources

`icon.svg` is the 3×3 mark, `icon-16.svg` the simplified 2×2 used for the 16px favicon entry.

Regenerate the files Next serves:

```sh
node -e "
const sharp = require('sharp'), fs = require('fs');
(async () => {
  await sharp('assets/icon-16.svg', { density: 512 }).resize(16, 16).png().toFile('/tmp/f16.png');
  for (const s of [32, 48, 180])
    await sharp('assets/icon.svg', { density: 512 }).resize(s, s).png().toFile('/tmp/f' + s + '.png');
  fs.copyFileSync('/tmp/f180.png', 'app/apple-icon.png');
  fs.copyFileSync('assets/icon.svg', 'app/icon.svg');
})()"

python3 - <<'PY'
import struct
imgs = [(s, open(f"/tmp/f{s}.png", "rb").read()) for s in (16, 32, 48)]
hdr = struct.pack("<HHH", 0, 1, len(imgs)); off = len(hdr) + 16 * len(imgs)
ent = b""; blob = b""
for s, d in imgs:
    ent += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(d), off); blob += d; off += len(d)
open("app/favicon.ico", "wb").write(hdr + ent + blob)
PY
```
