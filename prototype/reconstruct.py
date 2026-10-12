"""Experimental palette-guided geometric reconstruction. Not semantic/manual reconstruction."""
import argparse, json, subprocess
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
ROOT=Path(__file__).parent

def reconstruct(image, palette, tolerance=1., circles=True):
    rgba=np.asarray(image.convert('RGBA')); h,w=rgba.shape[:2]
    if w*h>4_000_000: raise ValueError('Prototype limit: 4 million pixels')
    rgb=np.array([tuple(bytes.fromhex(c.lstrip('#'))) for c in palette],dtype=np.uint8)
    if len(rgb)<2 or len(rgb)>32 or rgb.shape[1]!=3: raise ValueError('Use 2–32 RGB hex colors')
    lab=cv2.cvtColor(rgba[:,:,:3].copy(),cv2.COLOR_RGB2LAB).astype(float)
    plab=cv2.cvtColor(rgb[None,:,:],cv2.COLOR_RGB2LAB)[0].astype(float)
    labels=np.zeros((h,w),np.uint8); best=np.full((h,w),np.inf)
    for k,c in enumerate(plab):
        d=np.sum((lab-c)**2,axis=2); take=d<best; labels[take]=k; best[take]=d[take]
    groups=[]; stats={'circles':0,'cubics':0,'paths':0,'layers':0,'warnings':['Independent color contours may leave subpixel seams. Review small details and touching circles.']}
    for k,color in enumerate(palette):
        mask=((labels==k)&(rgba[:,:,3]>=128)).astype(np.uint8)*255
        contours,hierarchy=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_NONE)
        if hierarchy is None: continue
        parts=[]
        # One compound evenodd path per color preserves holes and nested islands.
        for idx,contour in enumerate(contours):
            p=contour[:,0,:].astype(float)+.5
            if len(p)<4: continue
            cx,cy=p.mean(axis=0); distances=np.linalg.norm(p-[cx,cy],axis=1)
            r=distances.mean(); area=abs(cv2.contourArea(contour)); x,y,bw,bh=cv2.boundingRect(contour)
            leaf=hierarchy[0,idx,2]==-1
            is_circle=(circles and leaf and r>=3 and .94<bw/bh<1.06 and np.std(distances)/r<.035 and .93<area/(np.pi*r*r)<1.05)
            if is_circle:
                parts.append(f'M {cx-r:.3f} {cy:.3f} A {r:.3f} {r:.3f} 0 1 0 {cx+r:.3f} {cy:.3f} A {r:.3f} {r:.3f} 0 1 0 {cx-r:.3f} {cy:.3f} Z')
                stats['circles']+=1
            else:
                # Fixed anchor splits avoid the coincident endpoint degeneracy of open curve fitters.
                curves=[]
                cuts=np.linspace(0,len(p),5,dtype=int)
                chunks=[np.vstack((p[cuts[j]:cuts[j+1]],p[cuts[j+1]%len(p)])) for j in range(4)]
                result=subprocess.run(['node',str(ROOT/'fit.cjs')],input=json.dumps({'contours':[a.tolist() for a in chunks],'tolerance':tolerance}),text=True,capture_output=True,check=True)
                curves=[c for chunk in json.loads(result.stdout) for c in chunk]
                d=f'M {p[0,0]:.3f} {p[0,1]:.3f}'
                for curve in curves:
                    d+=' C '+' '.join(f'{v:.3f}' for point in curve[1:] for v in point)
                parts.append(d+' Z');stats['cubics']+=len(curves)
            stats['paths']+=1
        if parts:
            groups.append(f'<g id="color-{k}" data-color="{color}" fill="{color}"><path fill-rule="evenodd" d="'+ ' '.join(parts)+'"/></g>')
    stats['layers']=len(groups)
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'+''.join(groups)+'</svg>'
    return svg,stats

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('output');p.add_argument('--palette',required=True);p.add_argument('--tolerance',type=float,default=1.)
    a=p.parse_args();svg,stats=reconstruct(Image.open(a.input),a.palette.split(','),a.tolerance);Path(a.output).write_text(svg);print(json.dumps(stats,indent=2))
