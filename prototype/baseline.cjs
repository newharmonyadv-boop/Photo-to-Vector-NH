let seed=20261012;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
const fs=require('node:fs'),tracer=require('imagetracerjs');
const x=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(tracer.imagedataToSVG({width:x.width,height:x.height,data:x.data},{ltres:.252,qtres:.252,pathomit:1,numberofcolors:x.colors,colorsampling:1,colorquantcycles:8,mincolorratio:0,blurradius:1,blurdelta:20,scale:1,strokewidth:0,linefilter:false,rightangleenhance:false,roundcoords:3,...(x.palette?{pal:x.palette.map(c=>({r:parseInt(c.slice(1,3),16),g:parseInt(c.slice(3,5),16),b:parseInt(c.slice(5,7),16),a:255}))}:{})}));
