const fs=require('node:fs'),fit=require('fit-curve');
const {contours,tolerance}=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(contours.map(points=>fit(points,tolerance*tolerance))));
