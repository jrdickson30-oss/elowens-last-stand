"""Read-only audit of active sprite artwork for saturated magenta contamination."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parents[1]
files=[root/'public/elowen.png',root/'public/characters.png']
files+=list((root/'public').glob('elowen-*/*spritesheet.png'))
manifest=json.loads((root/'public/villagers/running/manifest.json').read_text())
files += [root/'public/villagers/running'/c['image'] for c in manifest['clips']]
report=[]
for path in files:
    pixels=np.array(Image.open(path).convert('RGBA'),dtype=np.int16)
    r,g,b,a=pixels.transpose(2,0,1)
    mask=(a>32)&(r>150)&(b>120)&(r>g*1.4)&(b>g*1.4)&(abs(r-b)<100)
    count=int(mask.sum())
    legitimate='children-of-chaos' in path.name
    report.append({'file':str(path.relative_to(root)),'magentaPixels':count,
                   'expectedColours':legitimate,'needsCorrection':count>0 and not legitimate})
print(json.dumps(report,indent=2))
