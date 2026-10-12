import io,json,subprocess,unittest,xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
import cairosvg
from PIL import Image,ImageDraw,ImageFilter
from reconstruct import reconstruct
ROOT=Path(__file__).parent; OUT=ROOT/'results'; OUT.mkdir(exist_ok=True)
PALETTE=['#ffffff','#183728','#c65d63','#e9b84c']
def fixture():
    im=Image.new('RGB',(320,320),'white');d=ImageDraw.Draw(im)
    d.ellipse((65,65,255,255),fill=PALETTE[1]);d.ellipse((83,83,237,237),fill='white')
    for box in [(135,60,185,150),(135,170,185,260),(60,135,150,185),(170,135,260,185)]: d.ellipse(box,fill=PALETTE[2])
    d.ellipse((144,144,176,176),fill=PALETTE[3]);d.ellipse((30,30,54,54),fill=PALETTE[3]);d.ellipse((268,30,282,44),fill=PALETTE[3])
    d.polygon([(30,270),(75,285),(38,300)],fill=PALETTE[1]);return im

def render(svg):return np.asarray(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGB'))
def metrics(svg,truth):
    a=render(svg);b=np.asarray(truth); fg=np.any(b!=255,axis=2);ag=np.any(a<245,axis=2)
    root=ET.fromstring(svg);return {'foreground_iou':float((fg&ag).sum()/(fg|ag).sum()),'rgb_mae':float(np.abs(a.astype(float)-b).mean()),'bytes':len(svg.encode()),'color_groups':len(root.findall('{*}g')),'cubic_commands':svg.count(' C '),'circle_arc_commands':svg.count(' A ')}
class Quality(unittest.TestCase):
    def test_benchmark(self):
        truth=fixture();truth.save(OUT/'truth.png'); rows=[]; previews=[]
        rng=np.random.default_rng(20261012)
        for name,im in [('clean',truth),('noisy',Image.fromarray(np.clip(np.asarray(truth).astype(float)+rng.normal(0,7,(320,320,3)),0,255).astype('uint8')).filter(ImageFilter.GaussianBlur(.4)))]:
            im.save(OUT/f'{name}-input.png')
            svg,stats=reconstruct(im,PALETTE)
            baseline=subprocess.run(['node',str(ROOT/'baseline.cjs')],input=json.dumps({'width':320,'height':320,'data':np.asarray(im.convert('RGBA')).flatten().tolist(),'colors':4}),capture_output=True,text=True,check=True).stdout
            guided=subprocess.run(['node',str(ROOT/'baseline.cjs')],input=json.dumps({'width':320,'height':320,'data':np.asarray(im.convert('RGBA')).flatten().tolist(),'colors':4,'palette':PALETTE}),capture_output=True,text=True,check=True).stdout
            for engine,content in [('imagetracer-batik',baseline),('imagetracer-fixed-palette',guided),('hybrid',svg)]:
                (OUT/f'{name}-{engine}.svg').write_text(content)
                rows.append({'fixture':name,'engine':engine,**metrics(content,truth)})
            self.assertGreaterEqual(stats['circles'],2)
            self.assertGreater(stats['cubics'],0);self.assertEqual(stats['layers'],4)
            self.assertGreater(metrics(svg,truth)['foreground_iou'],.94)
            self.assertEqual(render(svg)[160,160].tolist(),[233,184,76])
            self.assertEqual(render(svg)[110,110].tolist(),[255,255,255])
            strip=Image.new('RGB',(960,350),'white')
            for j,(label,img) in enumerate([('Input',im),('ImageTracer Batik',Image.fromarray(render(baseline))),('Hybrid geometry',Image.fromarray(render(svg)))]):strip.paste(img,(j*320,30));ImageDraw.Draw(strip).text((j*320+10,8),f'{name}: {label}',fill='black')
            previews.append(strip)
        board=Image.new('RGB',(960,700),'white');board.paste(previews[0]);board.paste(previews[1],(0,350));board.save(OUT/'comparison.png')
        (OUT/'metrics.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
    def test_transparency_and_determinism(self):
        im=fixture().convert('RGBA');im.putalpha(0)
        a,s=reconstruct(im,PALETTE);self.assertEqual(s['layers'],0)
        im=fixture();a,_=reconstruct(im,PALETTE);b,_=reconstruct(im,PALETTE);self.assertEqual(a,b)
if __name__=='__main__':unittest.main()
