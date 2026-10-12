var Qe=Object.defineProperty,Je=Object.defineProperties;var Ze=Object.getOwnPropertyDescriptors;var Z=Object.getOwnPropertySymbols;var je=Object.prototype.hasOwnProperty,Fe=Object.prototype.propertyIsEnumerable;var Ye=(r,e,a)=>e in r?Qe(r,e,{enumerable:!0,configurable:!0,writable:!0,value:a}):r[e]=a,I=(r,e)=>{for(var a in e||(e={}))je.call(e,a)&&Ye(r,a,e[a]);if(Z)for(var a of Z(e))Fe.call(e,a)&&Ye(r,a,e[a]);return r},ee=(r,e)=>Je(r,Ze(e));var Oe=(r,e)=>{var a={};for(var t in r)je.call(r,t)&&e.indexOf(t)<0&&(a[t]=r[t]);if(r!=null&&Z)for(var t of Z(r))e.indexOf(t)<0&&Fe.call(r,t)&&(a[t]=r[t]);return a};import{r as x,c as ea,j as i,L as re,u as V,E as aa,S as Ee,a as Pe,F as ra,b as ta,d as oa}from"./index-DxqpE8aI.js";import{s as ge,R as Le,M as ia,u as Ie,i as te,S as sa,c as na,P as Se,a as ca}from"./cards-DRS4BTgN.js";import{S as Ne,N as la,H as pa,a as ba}from"./Shell-ZPGPqRJz.js";import{B as Ae}from"./nav-BcNfKETX.js";import{u as da,a as fa,b as ga,c as ma,d as ua}from"./motion-CytFIUCo.js";import{C as Re,a as xa}from"./chevron-right-BIEAPUW1.js";import"./preview-CZFNpAjp.js";import"./search-hNRSuhlf.js";const $a=1e4;function ha(r,e=!1){const[a,t]=x.useState(0);return x.useEffect(()=>{t(0)},[r]),x.useEffect(()=>{if(e||r.length<2||ge())return;const o=window.setTimeout(()=>t(s=>(s+1)%r.length),$a);return()=>window.clearTimeout(o)},[a,e,r]),a}/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const za=ea("Pause",[["rect",{x:"14",y:"4",width:"4",height:"16",rx:"1",key:"zuxfzm"}],["rect",{x:"6",y:"4",width:"4",height:"16",rx:"1",key:"1okwgv"}]]),va={sm:{borderRadius:32,borderWidth:1,width:70,height:36},md:{borderRadius:16,borderWidth:1},line:{borderRadius:16,borderWidth:1},"pulse-outside":{borderRadius:16,borderWidth:1},"pulse-inner":{borderRadius:16,borderWidth:1}},ya={sm:{dark:{strokeOpacity:.46,innerOpacity:.24,bloomOpacity:.38,innerShadow:"rgba(255, 255, 255, 0.3)",saturation:1.2},light:{strokeOpacity:.12,innerOpacity:.3,bloomOpacity:.16,innerShadow:"rgba(0, 0, 0, 0.14)",saturation:1.8}},md:{dark:{strokeOpacity:.26,innerOpacity:.42,bloomOpacity:.24,innerShadow:"rgba(255, 255, 255, 0.27)",saturation:1.2},light:{strokeOpacity:.12,innerOpacity:.26,bloomOpacity:.34,innerShadow:"rgba(0, 0, 0, 0.14)",saturation:1.5}},line:{dark:{strokeOpacity:1.14,innerOpacity:.7,bloomOpacity:.8,innerShadow:"rgba(255, 255, 255, 0.1)",saturation:1.2},light:{strokeOpacity:.16,innerOpacity:.32,bloomOpacity:.3,innerShadow:"rgba(0, 0, 0, 0.14)",saturation:1.95}},"pulse-outside":{dark:{strokeOpacity:.94,innerOpacity:.34,bloomOpacity:.3,innerShadow:"transparent",saturation:1.2,brightness:1.9,hairlineOpacity:0},light:{strokeOpacity:1.96,innerOpacity:1.04,bloomOpacity:.42,innerShadow:"transparent",saturation:.6,brightness:1.7,hairlineOpacity:0}},"pulse-inner":{dark:{strokeOpacity:1.54,innerOpacity:.44,bloomOpacity:.66,innerShadow:"transparent",saturation:1.2,brightness:.75},light:{strokeOpacity:.32,innerOpacity:.4,bloomOpacity:.8,innerShadow:"transparent",saturation:.75,brightness:1.3}}},C={colorful:{border:[{color:"rgb(255, 50, 100)",pos:"33% -7.4%",size:"70px 40px"},{color:"rgb(40, 140, 255)",pos:"12% -5%",size:"60px 35px"},{color:"rgb(50, 200, 80)",pos:"2.1% 68.3%",size:"40px 70px"},{color:"rgb(30, 185, 170)",pos:"2.1% 68.3%",size:"20px 35px"},{color:"rgb(100, 70, 255)",pos:"74.4% 100%",size:"180px 32px"},{color:"rgb(40, 140, 255)",pos:"55% 100%",size:"85px 26px"},{color:"rgb(255, 120, 40)",pos:"93.9% 0%",size:"74px 32px"},{color:"rgb(240, 50, 180)",pos:"100% 27.1%",size:"26px 42px"},{color:"rgb(180, 40, 240)",pos:"100% 27.1%",size:"52px 48px"}],spike:{primary:"rgb(255, 60, 80)",secondary:"rgba(40, 190, 180, 0.98)"},spikeLt:{primary:"rgb(200, 30, 60)",secondary:"rgb(20, 150, 140)"}},mono:{border:[{color:"rgb(180, 180, 180)",pos:"33% -7.4%",size:"70px 40px"},{color:"rgb(140, 140, 140)",pos:"12% -5%",size:"60px 35px"},{color:"rgb(160, 160, 160)",pos:"2.1% 68.3%",size:"40px 70px"},{color:"rgb(130, 130, 130)",pos:"2.1% 68.3%",size:"20px 35px"},{color:"rgb(170, 170, 170)",pos:"74.4% 100%",size:"180px 32px"},{color:"rgb(150, 150, 150)",pos:"55% 100%",size:"85px 26px"},{color:"rgb(190, 190, 190)",pos:"93.9% 0%",size:"74px 32px"},{color:"rgb(145, 145, 145)",pos:"100% 27.1%",size:"26px 42px"},{color:"rgb(165, 165, 165)",pos:"100% 27.1%",size:"52px 48px"}],spike:{primary:"rgb(200, 200, 200)",secondary:"rgb(170, 170, 170)"},spikeLt:{primary:"rgb(80, 80, 80)",secondary:"rgb(120, 120, 120)"}},ocean:{border:[{color:"rgb(100, 80, 220)",pos:"33% -7.4%",size:"70px 40px"},{color:"rgb(60, 120, 255)",pos:"12% -5%",size:"60px 35px"},{color:"rgb(80, 100, 200)",pos:"2.1% 68.3%",size:"40px 70px"},{color:"rgb(50, 140, 220)",pos:"2.1% 68.3%",size:"20px 35px"},{color:"rgb(120, 80, 255)",pos:"74.4% 100%",size:"180px 32px"},{color:"rgb(70, 130, 255)",pos:"55% 100%",size:"85px 26px"},{color:"rgb(140, 100, 240)",pos:"93.9% 0%",size:"74px 32px"},{color:"rgb(90, 110, 230)",pos:"100% 27.1%",size:"26px 42px"},{color:"rgb(130, 70, 255)",pos:"100% 27.1%",size:"52px 48px"}],spike:{primary:"rgb(100, 120, 255)",secondary:"rgba(130, 100, 220, 0.98)"},spikeLt:{primary:"rgb(60, 60, 180)",secondary:"rgb(80, 100, 200)"}},sunset:{border:[{color:"rgb(255, 80, 50)",pos:"33% -7.4%",size:"70px 40px"},{color:"rgb(255, 160, 40)",pos:"12% -5%",size:"60px 35px"},{color:"rgb(255, 120, 60)",pos:"2.1% 68.3%",size:"40px 70px"},{color:"rgb(255, 200, 50)",pos:"2.1% 68.3%",size:"20px 35px"},{color:"rgb(255, 100, 80)",pos:"74.4% 100%",size:"180px 32px"},{color:"rgb(255, 180, 60)",pos:"55% 100%",size:"85px 26px"},{color:"rgb(255, 60, 60)",pos:"93.9% 0%",size:"74px 32px"},{color:"rgb(255, 140, 50)",pos:"100% 27.1%",size:"26px 42px"},{color:"rgb(255, 90, 70)",pos:"100% 27.1%",size:"52px 48px"}],spike:{primary:"rgb(255, 140, 80)",secondary:"rgba(255, 100, 60, 0.98)"},spikeLt:{primary:"rgb(200, 80, 40)",secondary:"rgb(220, 120, 30)"}}},Te={colorful:{border:[{color:"rgb(50, 200, 80)",pos:"2% 68%",size:"9px 18px"},{color:"rgb(30, 185, 170)",pos:"2% 68%",size:"4px 8px"},{color:"rgb(255, 120, 40)",pos:"72% -3%",size:"59px 9px"},{color:"rgb(100, 70, 255)",pos:"74% 100%",size:"42px 7px"},{color:"rgb(240, 50, 180)",pos:"100% 27%",size:"10px 17px"},{color:"rgb(180, 40, 240)",pos:"100% 27%",size:"10px 18px"},{color:"rgb(40, 140, 255)",pos:"100% 27%",size:"5px 10px"},{color:"rgb(255, 50, 100)",pos:"100% 27%",size:"11px 12px"}],inner:[{color:"rgba(50, 200, 80, 0.5)",pos:"2% 68%",size:"9px 18px"},{color:"rgba(30, 185, 170, 0.45)",pos:"2% 68%",size:"4px 8px"},{color:"rgba(255, 120, 40, 0.35)",pos:"72% -3%",size:"59px 9px"},{color:"rgba(100, 70, 255, 0.35)",pos:"74% 100%",size:"42px 7px"},{color:"rgba(240, 50, 180, 0.3)",pos:"100% 27%",size:"10px 17px"},{color:"rgba(180, 40, 240, 0.4)",pos:"100% 27%",size:"10px 18px"},{color:"rgba(40, 140, 255, 0.3)",pos:"100% 27%",size:"5px 10px"},{color:"rgba(255, 50, 100, 0.3)",pos:"100% 27%",size:"11px 12px"}]},mono:{border:[{color:"rgb(160, 160, 160)",pos:"2% 68%",size:"9px 18px"},{color:"rgb(140, 140, 140)",pos:"2% 68%",size:"4px 8px"},{color:"rgb(180, 180, 180)",pos:"72% -3%",size:"59px 9px"},{color:"rgb(150, 150, 150)",pos:"74% 100%",size:"42px 7px"},{color:"rgb(170, 170, 170)",pos:"100% 27%",size:"10px 17px"},{color:"rgb(155, 155, 155)",pos:"100% 27%",size:"10px 18px"},{color:"rgb(145, 145, 145)",pos:"100% 27%",size:"5px 10px"},{color:"rgb(165, 165, 165)",pos:"100% 27%",size:"11px 12px"}],inner:[{color:"rgba(160, 160, 160, 0.25)",pos:"2% 68%",size:"9px 18px"},{color:"rgba(140, 140, 140, 0.22)",pos:"2% 68%",size:"4px 8px"},{color:"rgba(180, 180, 180, 0.17)",pos:"72% -3%",size:"59px 9px"},{color:"rgba(150, 150, 150, 0.17)",pos:"74% 100%",size:"42px 7px"},{color:"rgba(170, 170, 170, 0.15)",pos:"100% 27%",size:"10px 17px"},{color:"rgba(155, 155, 155, 0.20)",pos:"100% 27%",size:"10px 18px"},{color:"rgba(145, 145, 145, 0.15)",pos:"100% 27%",size:"5px 10px"},{color:"rgba(165, 165, 165, 0.15)",pos:"100% 27%",size:"11px 12px"}]},ocean:{border:[{color:"rgb(60, 140, 200)",pos:"2% 68%",size:"9px 18px"},{color:"rgb(50, 120, 180)",pos:"2% 68%",size:"4px 8px"},{color:"rgb(100, 80, 220)",pos:"72% -3%",size:"59px 9px"},{color:"rgb(80, 100, 255)",pos:"74% 100%",size:"42px 7px"},{color:"rgb(120, 70, 240)",pos:"100% 27%",size:"10px 17px"},{color:"rgb(90, 80, 220)",pos:"100% 27%",size:"10px 18px"},{color:"rgb(70, 110, 255)",pos:"100% 27%",size:"5px 10px"},{color:"rgb(110, 90, 230)",pos:"100% 27%",size:"11px 12px"}],inner:[{color:"rgba(60, 140, 200, 0.5)",pos:"2% 68%",size:"9px 18px"},{color:"rgba(50, 120, 180, 0.45)",pos:"2% 68%",size:"4px 8px"},{color:"rgba(100, 80, 220, 0.35)",pos:"72% -3%",size:"59px 9px"},{color:"rgba(80, 100, 255, 0.35)",pos:"74% 100%",size:"42px 7px"},{color:"rgba(120, 70, 240, 0.3)",pos:"100% 27%",size:"10px 17px"},{color:"rgba(90, 80, 220, 0.4)",pos:"100% 27%",size:"10px 18px"},{color:"rgba(70, 110, 255, 0.3)",pos:"100% 27%",size:"5px 10px"},{color:"rgba(110, 90, 230, 0.3)",pos:"100% 27%",size:"11px 12px"}]},sunset:{border:[{color:"rgb(255, 180, 50)",pos:"2% 68%",size:"9px 18px"},{color:"rgb(255, 150, 40)",pos:"2% 68%",size:"4px 8px"},{color:"rgb(255, 80, 60)",pos:"72% -3%",size:"59px 9px"},{color:"rgb(255, 100, 80)",pos:"74% 100%",size:"42px 7px"},{color:"rgb(255, 60, 80)",pos:"100% 27%",size:"10px 17px"},{color:"rgb(255, 120, 60)",pos:"100% 27%",size:"10px 18px"},{color:"rgb(255, 200, 50)",pos:"100% 27%",size:"5px 10px"},{color:"rgb(255, 90, 70)",pos:"100% 27%",size:"11px 12px"}],inner:[{color:"rgba(255, 180, 50, 0.5)",pos:"2% 68%",size:"9px 18px"},{color:"rgba(255, 150, 40, 0.45)",pos:"2% 68%",size:"4px 8px"},{color:"rgba(255, 80, 60, 0.35)",pos:"72% -3%",size:"59px 9px"},{color:"rgba(255, 100, 80, 0.35)",pos:"74% 100%",size:"42px 7px"},{color:"rgba(255, 60, 80, 0.3)",pos:"100% 27%",size:"10px 17px"},{color:"rgba(255, 120, 60, 0.4)",pos:"100% 27%",size:"10px 18px"},{color:"rgba(255, 200, 50, 0.3)",pos:"100% 27%",size:"5px 10px"},{color:"rgba(255, 90, 70, 0.3)",pos:"100% 27%",size:"11px 12px"}]}};function ka(r){return Te[r].border.map(e=>`radial-gradient(ellipse ${e.size} at ${e.pos}, ${e.color}, transparent)`).join(`,
    `)}function wa(r){return Te[r].inner.map(e=>`radial-gradient(ellipse ${e.size} at ${e.pos}, ${e.color}, transparent)`).join(`,
    `)}function Wa(r){return C[r].border.map(e=>`radial-gradient(ellipse ${e.size} at ${e.pos}, ${e.color}, transparent)`).join(`,
    `)}function Ha(r){const e=C[r],a=r==="mono"?.225:.45;return e.border.map(t=>{const o=t.color.replace("rgb(","rgba(").replace(")",`, ${a})`);return`radial-gradient(ellipse ${t.size.split(" ").map(s=>{const n=parseInt(s);return`${Math.round(n*.9)}px`}).join(" ")} at ${t.pos}, ${o}, transparent)`}).join(`,
    `)}function Xa(r,e){const a=C[r];return e?a.spike:a.spikeLt}const Ya={colorful:{dark:[{color:"rgb(255, 50, 100)",sizeW:36,sizeH:36,offsetX:0,offsetY:2},{color:"rgb(40, 180, 220)",sizeW:30,sizeH:32,offsetX:39,offsetY:0},{color:"rgb(50, 200, 80)",sizeW:33,sizeH:28,offsetX:-36,offsetY:2},{color:"rgb(180, 40, 240)",sizeW:29,sizeH:34,offsetX:-54,offsetY:0},{color:"rgb(255, 160, 30)",sizeW:27,sizeH:30,offsetX:51,offsetY:-1},{color:"rgb(100, 70, 255)",sizeW:36,sizeH:24,offsetX:21,offsetY:1},{color:"rgb(40, 140, 255)",sizeW:30,sizeH:22,offsetX:-21,offsetY:0},{color:"rgb(240, 50, 180)",sizeW:25,sizeH:28,offsetX:66,offsetY:1},{color:"rgb(30, 185, 170)",sizeW:23,sizeH:30,offsetX:-66,offsetY:-1}],light:[{color:"rgb(255, 50, 100)",sizeW:45,sizeH:36,offsetX:0,offsetY:2},{color:"rgb(40, 140, 255)",sizeW:35,sizeH:32,offsetX:65,offsetY:0},{color:"rgb(50, 200, 80)",sizeW:40,sizeH:28,offsetX:-60,offsetY:2},{color:"rgb(180, 40, 240)",sizeW:35,sizeH:34,offsetX:-90,offsetY:0},{color:"rgb(30, 185, 170)",sizeW:38,sizeH:30,offsetX:85,offsetY:-1},{color:"rgb(100, 70, 255)",sizeW:50,sizeH:24,offsetX:35,offsetY:1},{color:"rgb(40, 140, 255)",sizeW:40,sizeH:22,offsetX:-35,offsetY:0},{color:"rgb(255, 120, 40)",sizeW:35,sizeH:28,offsetX:110,offsetY:1},{color:"rgb(240, 50, 180)",sizeW:30,sizeH:30,offsetX:-110,offsetY:-1}]},mono:{dark:[{color:"rgb(200, 200, 200)",sizeW:36,sizeH:36,offsetX:0,offsetY:2},{color:"rgb(170, 170, 170)",sizeW:30,sizeH:32,offsetX:39,offsetY:0},{color:"rgb(155, 155, 155)",sizeW:33,sizeH:28,offsetX:-36,offsetY:2},{color:"rgb(185, 185, 185)",sizeW:29,sizeH:34,offsetX:-54,offsetY:0},{color:"rgb(165, 165, 165)",sizeW:27,sizeH:30,offsetX:51,offsetY:-1},{color:"rgb(180, 180, 180)",sizeW:36,sizeH:24,offsetX:21,offsetY:1},{color:"rgb(160, 160, 160)",sizeW:30,sizeH:22,offsetX:-21,offsetY:0},{color:"rgb(175, 175, 175)",sizeW:25,sizeH:28,offsetX:66,offsetY:1},{color:"rgb(190, 190, 190)",sizeW:23,sizeH:30,offsetX:-66,offsetY:-1}],light:[{color:"rgb(100, 100, 100)",sizeW:45,sizeH:36,offsetX:0,offsetY:2},{color:"rgb(80, 80, 80)",sizeW:35,sizeH:32,offsetX:65,offsetY:0},{color:"rgb(90, 90, 90)",sizeW:40,sizeH:28,offsetX:-60,offsetY:2},{color:"rgb(70, 70, 70)",sizeW:35,sizeH:34,offsetX:-90,offsetY:0},{color:"rgb(85, 85, 85)",sizeW:38,sizeH:30,offsetX:85,offsetY:-1},{color:"rgb(95, 95, 95)",sizeW:50,sizeH:24,offsetX:35,offsetY:1},{color:"rgb(75, 75, 75)",sizeW:40,sizeH:22,offsetX:-35,offsetY:0},{color:"rgb(105, 105, 105)",sizeW:35,sizeH:28,offsetX:110,offsetY:1},{color:"rgb(65, 65, 65)",sizeW:30,sizeH:30,offsetX:-110,offsetY:-1}]},ocean:{dark:[{color:"rgb(100, 80, 220)",sizeW:36,sizeH:36,offsetX:0,offsetY:2},{color:"rgb(60, 120, 255)",sizeW:30,sizeH:32,offsetX:39,offsetY:0},{color:"rgb(80, 100, 200)",sizeW:33,sizeH:28,offsetX:-36,offsetY:2},{color:"rgb(130, 70, 255)",sizeW:29,sizeH:34,offsetX:-54,offsetY:0},{color:"rgb(70, 130, 255)",sizeW:27,sizeH:30,offsetX:51,offsetY:-1},{color:"rgb(120, 80, 255)",sizeW:36,sizeH:24,offsetX:21,offsetY:1},{color:"rgb(90, 110, 230)",sizeW:30,sizeH:22,offsetX:-21,offsetY:0},{color:"rgb(110, 90, 240)",sizeW:25,sizeH:28,offsetX:66,offsetY:1},{color:"rgb(140, 100, 255)",sizeW:23,sizeH:30,offsetX:-66,offsetY:-1}],light:[{color:"rgb(80, 60, 200)",sizeW:45,sizeH:36,offsetX:0,offsetY:2},{color:"rgb(50, 100, 220)",sizeW:35,sizeH:32,offsetX:65,offsetY:0},{color:"rgb(70, 90, 190)",sizeW:40,sizeH:28,offsetX:-60,offsetY:2},{color:"rgb(110, 60, 220)",sizeW:35,sizeH:34,offsetX:-90,offsetY:0},{color:"rgb(60, 110, 230)",sizeW:38,sizeH:30,offsetX:85,offsetY:-1},{color:"rgb(100, 70, 240)",sizeW:50,sizeH:24,offsetX:35,offsetY:1},{color:"rgb(80, 100, 210)",sizeW:40,sizeH:22,offsetX:-35,offsetY:0},{color:"rgb(90, 80, 225)",sizeW:35,sizeH:28,offsetX:110,offsetY:1},{color:"rgb(120, 90, 245)",sizeW:30,sizeH:30,offsetX:-110,offsetY:-1}]},sunset:{dark:[{color:"rgb(255, 100, 60)",sizeW:36,sizeH:36,offsetX:0,offsetY:2},{color:"rgb(255, 180, 50)",sizeW:30,sizeH:32,offsetX:39,offsetY:0},{color:"rgb(255, 140, 70)",sizeW:33,sizeH:28,offsetX:-36,offsetY:2},{color:"rgb(255, 80, 80)",sizeW:29,sizeH:34,offsetX:-54,offsetY:0},{color:"rgb(255, 200, 60)",sizeW:27,sizeH:30,offsetX:51,offsetY:-1},{color:"rgb(255, 120, 50)",sizeW:36,sizeH:24,offsetX:21,offsetY:1},{color:"rgb(255, 160, 80)",sizeW:30,sizeH:22,offsetX:-21,offsetY:0},{color:"rgb(255, 90, 60)",sizeW:25,sizeH:28,offsetX:66,offsetY:1},{color:"rgb(255, 70, 70)",sizeW:23,sizeH:30,offsetX:-66,offsetY:-1}],light:[{color:"rgb(220, 80, 40)",sizeW:45,sizeH:36,offsetX:0,offsetY:2},{color:"rgb(230, 150, 30)",sizeW:35,sizeH:32,offsetX:65,offsetY:0},{color:"rgb(210, 110, 50)",sizeW:40,sizeH:28,offsetX:-60,offsetY:2},{color:"rgb(200, 60, 60)",sizeW:35,sizeH:34,offsetX:-90,offsetY:0},{color:"rgb(220, 170, 40)",sizeW:38,sizeH:30,offsetX:85,offsetY:-1},{color:"rgb(210, 100, 30)",sizeW:50,sizeH:24,offsetX:35,offsetY:1},{color:"rgb(230, 130, 60)",sizeW:40,sizeH:22,offsetX:-35,offsetY:0},{color:"rgb(190, 70, 50)",sizeW:35,sizeH:28,offsetX:110,offsetY:1},{color:"rgb(180, 50, 50)",sizeW:30,sizeH:30,offsetX:-110,offsetY:-1}]}};function ja(r,e,a){return Ya[r][e?"dark":"light"].map(t=>{const o=t.offsetX===0?"":t.offsetX>0?` + ${t.offsetX}px`:` - ${Math.abs(t.offsetX)}px`,s=t.offsetY===0?"":t.offsetY>0?` + ${t.offsetY}px`:` - ${Math.abs(t.offsetY)}px`;return`radial-gradient(ellipse calc(${t.sizeW}px * var(--beam-w-${a})) calc(${t.sizeH}px * var(--beam-h-${a})) at calc(var(--beam-x-${a}) * 100%${o}) calc(100%${s}), ${t.color}, transparent)`}).join(`,
       `)}const Fa={colorful:[{color:"rgba(255, 50, 100, 0.48)",sizeW:33,sizeH:30,offsetX:0,offsetY:0},{color:"rgba(40, 180, 220, 0.42)",sizeW:24,sizeH:26,offsetX:39,offsetY:-3},{color:"rgba(50, 200, 80, 0.48)",sizeW:27,sizeH:24,offsetX:-36,offsetY:0},{color:"rgba(180, 40, 240, 0.42)",sizeW:23,sizeH:28,offsetX:-54,offsetY:-2},{color:"rgba(255, 160, 30, 0.50)",sizeW:24,sizeH:24,offsetX:51,offsetY:-1},{color:"rgba(100, 70, 255, 0.45)",sizeW:30,sizeH:20,offsetX:21,offsetY:0},{color:"rgba(40, 140, 255, 0.40)",sizeW:25,sizeH:18,offsetX:-21,offsetY:-2},{color:"rgba(240, 50, 180, 0.45)",sizeW:21,sizeH:24,offsetX:66,offsetY:0},{color:"rgba(30, 185, 170, 0.52)",sizeW:18,sizeH:26,offsetX:-66,offsetY:-1}],mono:[{color:"rgba(200, 200, 200, 0.48)",sizeW:33,sizeH:30,offsetX:0,offsetY:0},{color:"rgba(170, 170, 170, 0.42)",sizeW:24,sizeH:26,offsetX:39,offsetY:-3},{color:"rgba(155, 155, 155, 0.48)",sizeW:27,sizeH:24,offsetX:-36,offsetY:0},{color:"rgba(185, 185, 185, 0.42)",sizeW:23,sizeH:28,offsetX:-54,offsetY:-2},{color:"rgba(165, 165, 165, 0.50)",sizeW:24,sizeH:24,offsetX:51,offsetY:-1},{color:"rgba(180, 180, 180, 0.45)",sizeW:30,sizeH:20,offsetX:21,offsetY:0},{color:"rgba(160, 160, 160, 0.40)",sizeW:25,sizeH:18,offsetX:-21,offsetY:-2},{color:"rgba(175, 175, 175, 0.45)",sizeW:21,sizeH:24,offsetX:66,offsetY:0},{color:"rgba(190, 190, 190, 0.52)",sizeW:18,sizeH:26,offsetX:-66,offsetY:-1}],ocean:[{color:"rgba(100, 80, 220, 0.48)",sizeW:33,sizeH:30,offsetX:0,offsetY:0},{color:"rgba(60, 120, 255, 0.42)",sizeW:24,sizeH:26,offsetX:39,offsetY:-3},{color:"rgba(80, 100, 200, 0.48)",sizeW:27,sizeH:24,offsetX:-36,offsetY:0},{color:"rgba(130, 70, 255, 0.42)",sizeW:23,sizeH:28,offsetX:-54,offsetY:-2},{color:"rgba(70, 130, 255, 0.50)",sizeW:24,sizeH:24,offsetX:51,offsetY:-1},{color:"rgba(120, 80, 255, 0.45)",sizeW:30,sizeH:20,offsetX:21,offsetY:0},{color:"rgba(90, 110, 230, 0.40)",sizeW:25,sizeH:18,offsetX:-21,offsetY:-2},{color:"rgba(110, 90, 240, 0.45)",sizeW:21,sizeH:24,offsetX:66,offsetY:0},{color:"rgba(140, 100, 255, 0.52)",sizeW:18,sizeH:26,offsetX:-66,offsetY:-1}],sunset:[{color:"rgba(255, 100, 60, 0.48)",sizeW:33,sizeH:30,offsetX:0,offsetY:0},{color:"rgba(255, 180, 50, 0.42)",sizeW:24,sizeH:26,offsetX:39,offsetY:-3},{color:"rgba(255, 140, 70, 0.48)",sizeW:27,sizeH:24,offsetX:-36,offsetY:0},{color:"rgba(255, 80, 80, 0.42)",sizeW:23,sizeH:28,offsetX:-54,offsetY:-2},{color:"rgba(255, 200, 60, 0.50)",sizeW:24,sizeH:24,offsetX:51,offsetY:-1},{color:"rgba(255, 120, 50, 0.45)",sizeW:30,sizeH:20,offsetX:21,offsetY:0},{color:"rgba(255, 160, 80, 0.40)",sizeW:25,sizeH:18,offsetX:-21,offsetY:-2},{color:"rgba(255, 90, 60, 0.45)",sizeW:21,sizeH:24,offsetX:66,offsetY:0},{color:"rgba(255, 70, 70, 0.52)",sizeW:18,sizeH:26,offsetX:-66,offsetY:-1}]};function Oa(r,e){return Fa[r].map(a=>{const t=a.offsetX===0?"":a.offsetX>0?` + ${a.offsetX}px`:` - ${Math.abs(a.offsetX)}px`,o=a.offsetY===0?"":` - ${Math.abs(a.offsetY)}px`;return`radial-gradient(ellipse calc(${a.sizeW}px * var(--beam-w-${e})) calc(${a.sizeH}px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%${t}) calc(100%${o}), ${a.color}, transparent)`}).join(`,
    `)}const Sa={colorful:{dark:{spikes:[{color1:"rgb(100, 70, 255)",color2:"rgba(100, 70, 255, 1)"},{color1:"rgba(255, 170, 40, 0.59)",color2:"rgba(255, 170, 40, 0.29)"},{color1:"rgb(50, 200, 100)",color2:"rgba(50, 200, 100, 1)"},{color1:"rgba(200, 50, 240, 0.91)",color2:"rgba(200, 50, 240, 0.45)"},{color1:"rgb(40, 140, 255)",color2:"rgba(40, 140, 255, 1)"}]},light:{spikes:[{color1:"rgb(80, 50, 200)",color2:"rgba(80, 50, 200, 0.8)"},{color1:"rgba(210, 130, 0, 0.7)",color2:"rgba(210, 130, 0, 0.46)"},{color1:"rgb(30, 160, 70)",color2:"rgba(30, 160, 70, 0.82)"},{color1:"rgb(160, 30, 190)",color2:"rgba(160, 30, 190, 0.7)"},{color1:"rgb(30, 100, 200)",color2:"rgba(30, 100, 200, 0.78)"}]}},mono:{dark:{spikes:[{color1:"rgb(200, 200, 200)",color2:"rgba(200, 200, 200, 1)"},{color1:"rgba(180, 180, 180, 0.59)",color2:"rgba(180, 180, 180, 0.29)"},{color1:"rgb(190, 190, 190)",color2:"rgba(190, 190, 190, 1)"},{color1:"rgba(170, 170, 170, 0.91)",color2:"rgba(170, 170, 170, 0.45)"},{color1:"rgb(185, 185, 185)",color2:"rgba(185, 185, 185, 1)"}]},light:{spikes:[{color1:"rgb(80, 80, 80)",color2:"rgba(80, 80, 80, 0.8)"},{color1:"rgba(100, 100, 100, 0.7)",color2:"rgba(100, 100, 100, 0.46)"},{color1:"rgb(70, 70, 70)",color2:"rgba(70, 70, 70, 0.82)"},{color1:"rgb(90, 90, 90)",color2:"rgba(90, 90, 90, 0.7)"},{color1:"rgb(85, 85, 85)",color2:"rgba(85, 85, 85, 0.78)"}]}},ocean:{dark:{spikes:[{color1:"rgb(100, 80, 255)",color2:"rgb(100, 80, 255)"},{color1:"rgba(80, 130, 220, 0.59)",color2:"rgba(80, 130, 220, 0.29)"},{color1:"rgb(60, 100, 255)",color2:"rgb(60, 100, 255)"},{color1:"rgba(90, 120, 200, 0.91)",color2:"rgba(90, 120, 200, 0.45)"},{color1:"rgb(120, 90, 255)",color2:"rgb(120, 90, 255)"}]},light:{spikes:[{color1:"rgb(50, 40, 180)",color2:"rgba(50, 40, 180, 0.8)"},{color1:"rgba(40, 80, 200, 0.7)",color2:"rgba(40, 80, 200, 0.46)"},{color1:"rgb(30, 50, 190)",color2:"rgba(30, 50, 190, 0.82)"},{color1:"rgb(60, 90, 180)",color2:"rgba(60, 90, 180, 0.7)"},{color1:"rgb(70, 60, 200)",color2:"rgba(70, 60, 200, 0.78)"}]}},sunset:{dark:{spikes:[{color1:"rgb(255, 100, 80)",color2:"rgb(255, 100, 80)"},{color1:"rgba(255, 150, 80, 0.59)",color2:"rgba(255, 150, 80, 0.29)"},{color1:"rgb(255, 80, 60)",color2:"rgb(255, 80, 60)"},{color1:"rgba(255, 120, 50, 0.91)",color2:"rgba(255, 120, 50, 0.45)"},{color1:"rgb(255, 140, 70)",color2:"rgb(255, 140, 70)"}]},light:{spikes:[{color1:"rgb(200, 60, 30)",color2:"rgba(200, 60, 30, 0.8)"},{color1:"rgba(220, 100, 20, 0.7)",color2:"rgba(220, 100, 20, 0.46)"},{color1:"rgb(180, 40, 20)",color2:"rgba(180, 40, 20, 0.82)"},{color1:"rgb(210, 80, 10)",color2:"rgba(210, 80, 10, 0.7)"},{color1:"rgb(190, 70, 30)",color2:"rgba(190, 70, 30, 0.78)"}]}}};function ae(r,e){const a=r.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*[\d.]+\s*\)$/);if(a)return`rgba(${a[1]}, ${a[2]}, ${a[3]}, ${e})`;const t=r.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);return t?`rgba(${t[1]}, ${t[2]}, ${t[3]}, ${e})`:r}function M(r,e){const a=r.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);if(a)return`rgba(${a[1]}, ${a[2]}, ${a[3]}, ${(parseFloat(a[4])*e).toFixed(2)})`;const t=r.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);return t?`rgba(${t[1]}, ${t[2]}, ${t[3]}, ${e.toFixed(2)})`:r}function Na(r,e,a){const t=Xa(r,e),o=Sa[r][e?"dark":"light"],s=r==="mono",n=s?.14:1,l=s?M(t.primary,.14):t.primary,p=s?M(t.primary,.09):t.primary,g=s?M(t.secondary,.12):t.secondary,z=s?ae(t.secondary,.06):ae(t.secondary,.49),b=o.spikes.map(j=>s?{color1:M(j.color1,n),color2:M(j.color2,n*.7)}:j),m=s?"12px":"0.8px",f=s?"14px":"2px",h=s?"12px":"1.2px",$=s?"10px":"0.6px",v=s?"42px":"92px",X=s?"38px":"72px",w=s?"40px":"85px",F=s?"32px":"60px",c=s?"12px":"1px",d=s?"rgba(255, 255, 255, 0.5)":"rgba(255, 255, 255, 1)",u=s?"rgba(255, 255, 255, 0.45)":"rgba(255, 255, 255, 0.9)",y=s?"rgba(255, 255, 255, 0.25)":"rgba(255, 255, 255, 0.5)",k=s?"rgba(255, 255, 255, 0.15)":"rgba(255, 255, 255, 0.3)",W=s?"rgba(255, 255, 255, 0.06)":"rgba(255, 255, 255, 0.12)",H=s?"rgba(255, 255, 255, 0.015)":"rgba(255, 255, 255, 0.03)";if(e)return`radial-gradient(ellipse calc(${m} * var(--beam-spike-${a})) calc(${v} * var(--beam-h-${a})) at 8% calc(100% - 2px), ${l}, ${p} 30%, transparent 88%),
       radial-gradient(ellipse calc(10px * var(--beam-spike2-${a})) calc(35px * var(--beam-h-${a})) at 22% calc(100% - 4px), ${g}, ${z} 50%, transparent 95%),
       radial-gradient(ellipse calc(${f} * (2 - var(--beam-spike-${a}))) calc(${X} * var(--beam-h-${a})) at 36% calc(100% - 3px), ${b[0].color1}, ${b[0].color2} 40%, transparent 90%),
       radial-gradient(ellipse calc(14px * var(--beam-spike2-${a})) calc(28px * var(--beam-h-${a})) at 50% calc(100% - 2px), ${b[1].color1}, ${b[1].color2} 55%, transparent 96%),
       radial-gradient(ellipse calc(${h} * (2 - var(--beam-spike2-${a}))) calc(${w} * var(--beam-h-${a})) at 64% calc(100% - 4px), ${b[2].color1}, ${b[2].color2} 35%, transparent 89%),
       radial-gradient(ellipse calc(7px * var(--beam-spike-${a})) calc(45px * var(--beam-h-${a})) at 78% calc(100% - 2px), ${b[3].color1}, ${b[3].color2} 48%, transparent 94%),
       radial-gradient(ellipse calc(${$} * (2 - var(--beam-spike-${a}))) calc(${F} * var(--beam-h-${a})) at 92% calc(100% - 3px), ${b[4].color1}, ${b[4].color2} 42%, transparent 91%),
       radial-gradient(ellipse calc(21px * var(--beam-spike-${a})) calc(15px * var(--beam-spike2-${a})) at calc(var(--beam-x-${a}) * 100%) calc(100% + 1px), ${d} 0%, ${u} 20%, ${y} 50%, transparent 100%),
       radial-gradient(ellipse calc(42px * var(--beam-w-${a})) calc(40px * var(--beam-h-${a})) at calc(var(--beam-x-${a}) * 100%) 100%, ${k} 0%, ${W} 25%, ${H} 55%, transparent 80%)`;{const j=s?M(t.primary,.11):ae(t.primary,.85),N=s?M(t.secondary,.09):ae(t.secondary,.7);return`radial-gradient(ellipse calc(${m} * var(--beam-spike-${a})) calc(${v} * var(--beam-h-${a})) at 8% calc(100% - 2px), ${l}, ${j} 30%, transparent 88%),
       radial-gradient(ellipse calc(10px * var(--beam-spike2-${a})) calc(35px * var(--beam-h-${a})) at 22% calc(100% - 4px), ${g}, ${N} 50%, transparent 95%),
       radial-gradient(ellipse calc(${f} * (2 - var(--beam-spike-${a}))) calc(${X} * var(--beam-h-${a})) at 36% calc(100% - 3px), ${b[0].color1}, ${b[0].color2} 40%, transparent 90%),
       radial-gradient(ellipse calc(14px * var(--beam-spike2-${a})) calc(28px * var(--beam-h-${a})) at 50% calc(100% - 2px), ${b[1].color1}, ${b[1].color2} 55%, transparent 96%),
       radial-gradient(ellipse calc(${h} * (2 - var(--beam-spike2-${a}))) calc(${w} * var(--beam-h-${a})) at 64% calc(100% - 4px), ${b[2].color1}, ${b[2].color2} 35%, transparent 89%),
       radial-gradient(ellipse calc(7px * var(--beam-spike-${a})) calc(45px * var(--beam-h-${a})) at 78% calc(100% - 2px), ${b[3].color1}, ${b[3].color2} 48%, transparent 94%),
       radial-gradient(ellipse calc(${c} * (2 - var(--beam-spike-${a}))) calc(${F} * var(--beam-h-${a})) at 92% calc(100% - 3px), ${b[4].color1}, ${b[4].color2} 42%, transparent 91%),
       radial-gradient(ellipse calc(50px * var(--beam-w-${a})) calc(32px * var(--beam-h-${a})) at calc(var(--beam-x-${a}) * 100%) calc(100%), rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.18) 30%, rgba(0, 0, 0, 0.03) 60%, transparent 85%)`}}const De=[{region:1,quad:"tl"},{region:2,quad:"tl"},{region:3,quad:"bl"},{region:1,quad:"bl"},{region:2,quad:"br"},{region:3,quad:"br"},{region:1,quad:"tr"},{region:2,quad:"tr"},{region:3,quad:"tr"}],Ra=[[65,35],[55,30],[35,65],[15,30],[173,28],[80,22],[69,28],[22,38],[47,44]],Ma=[{ci:0,region:1,quad:"tl",w:84,h:48},{ci:1,region:2,quad:"tl",w:72,h:42},{ci:2,region:3,quad:"bl",w:48,h:84},{ci:4,region:2,quad:"br",w:216,h:38},{ci:5,region:3,quad:"br",w:102,h:31},{ci:6,region:1,quad:"tr",w:89,h:38},{ci:8,region:3,quad:"tr",w:62,h:58}],Me=[{ci:0,region:1,quad:"tl",w:80,h:19,x:"27%",y:"0%"},{ci:6,region:2,quad:"tr",w:74,h:11,x:"73%",y:"-1%"},{ci:7,region:3,quad:"tr",w:15,h:44,x:"100%",y:"33%"},{ci:8,region:1,quad:"br",w:19,h:38,x:"101%",y:"72%"},{ci:4,region:2,quad:"br",w:84,h:13,x:"67%",y:"100%"},{ci:1,region:3,quad:"bl",w:60,h:21,x:"24%",y:"101%"},{ci:2,region:1,quad:"bl",w:17,h:40,x:"0%",y:"60%"},{ci:3,region:2,quad:"tl",w:13,h:32,x:"-1%",y:"28%"}],Ca=[{ci:0,region:1,quad:"tl",w:110,h:30,x:"27%",y:"3%"},{ci:6,region:2,quad:"tr",w:100,h:20,x:"73%",y:"1%"},{ci:7,region:3,quad:"tr",w:26,h:62,x:"100%",y:"33%"},{ci:8,region:1,quad:"br",w:30,h:56,x:"101%",y:"72%"},{ci:4,region:2,quad:"br",w:120,h:22,x:"67%",y:"99%"},{ci:1,region:3,quad:"bl",w:88,h:32,x:"24%",y:"99%"},{ci:2,region:1,quad:"bl",w:28,h:58,x:"0%",y:"60%"}];function qa(r,e,a){const t=r.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);return`rgba(${t?`${t[1]}, ${t[2]}, ${t[3]}`:"255, 255, 255"}, var(--bop-${e}-${a}))`}function ue(r,e,a,t,o,s,n,l){return`radial-gradient(ellipse calc(${e}px * var(--bw${t}-${l}) * var(--pulse-glow-sx, 1) * var(--pulse-glow-boost, 1)) calc(${a}px * var(--bh${t}-${l}) * var(--bgh-${l}) * var(--pulse-glow-sy, 1) * var(--pulse-glow-boost, 1)) at calc(${s} + var(--bx${t}-${l})) calc(${n} + var(--by${t}-${l})), ${qa(r,o,l)}, transparent)`}function Ea(r,e){return C[r].border.map((a,t)=>{const{region:o,quad:s}=De[t],[n,l]=a.pos.split(" "),[p,g]=a.size.split(" ").map(parseFloat);return ue(a.color,p,g,o,s,n,l,e)}).join(`,
    `)}function Pa(r,e,a){const t=C[r].border.map((l,p)=>{const{region:g,quad:z}=De[p],[b,m]=l.pos.split(" "),[f,h]=Ra[p];return ue(l.color,f,h,g,z,b,m,e)}),o=a?"255, 255, 255":"0, 0, 0",s=a?.18:.08,n=[["0%","0%","tl"],["100%","0%","tr"],["0%","100%","bl"],["100%","100%","br"]].map(([l,p,g])=>`radial-gradient(ellipse 60px 60px at ${l} ${p}, rgba(${o}, calc(${s} * var(--bop-${g}-${e}))), transparent 70%)`);return[...t,...n].join(`,
    `)}function Ce(r,e,a){const t=C[e].border;return r.map(o=>{var p,g;const s=t[o.ci],[n,l]=s.pos.split(" ");return ue(s.color,o.w,o.h,o.region,o.quad,(p=o.x)!=null?p:n,(g=o.y)!=null?g:l,a)}).join(`,
    `)}function Ve(r,e,a){const t=C[e].border,o=+a.toFixed(3);return r.map(s=>{var f,h;const n=t[s.ci],[l,p]=n.pos.split(" "),g=(f=s.x)!=null?f:l,z=(h=s.y)!=null?h:p,b=n.color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/),m=b?`${b[1]}, ${b[2]}, ${b[3]}`:"255, 255, 255";return`radial-gradient(ellipse calc(${s.w}px * var(--pulse-glow-sx, 1) * var(--pulse-glow-boost, 1)) calc(${s.h}px * var(--pulse-glow-sy, 1) * var(--pulse-glow-boost, 1)) at ${g} ${z}, rgba(${m}, ${o}), transparent)`}).join(`,
    `)}function B(r){return`
[data-beam="${r}"][data-paused],
[data-beam="${r}"][data-paused]::after,
[data-beam="${r}"][data-paused]::before,
[data-beam="${r}"][data-paused] [data-beam-bloom] {
  animation-play-state: paused !important;
}`}function Be(r){const e=["bw1","bh1","bw2","bh2","bw3","bh3","bgh","bop-tl","bop-tr","bop-bl","bop-br"],a=["bx1","by1","bx2","by2","bx3","by3"],t=e.map(s=>`@property --${s}-${r} {
  syntax: "<number>";
  initial-value: 1;
  inherits: true;
}`).join(`

`),o=a.map(s=>`@property --${s}-${r} {
  syntax: "<length>";
  initial-value: 0px;
  inherits: true;
}`).join(`

`);return`${t}

${o}

@property --beam-opacity-${r} {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

@property --beam-hue-${r} {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: true;
}`}function xe(r,e,a){const t=e==="dark",o=a/2.3;return r==="pulse-inner"?{sp:.28,dr:t?33:40,op:t?.48:.45,gh:t?.34:.22,bs:(t?1.9:2.6)*o,ss:(t?2.6:4.6)*o,ghs:(t?2.4:5.5)*o,huePeriod:16}:{sp:t?.28:.36,dr:t?14:19,op:t?.46:0,gh:t?.16:.58,bs:(t?2.3:3.7)*o,ss:(t?6.4:4.6)*o,ghs:(t?2.4:3.8)*o,huePeriod:14}}function La(r,e){const{sp:a,dr:t,op:o,gh:s,bs:n,ss:l,ghs:p}=e;return[{prop:`--bw1-${r}`,a:1-a,b:1+a*1.1,period:l*.9,delay:0,unit:""},{prop:`--bh1-${r}`,a:1+a*.9,b:1-a*.85,period:l*1.26,delay:0,unit:""},{prop:`--bx1-${r}`,a:-t,b:t*.9,period:n*1.6,delay:0,unit:"px"},{prop:`--by1-${r}`,a:t*.55,b:-t*.7,period:n*1.6,delay:0,unit:"px"},{prop:`--bw2-${r}`,a:1+a,b:1-a*.85,period:l*1.1,delay:0,unit:""},{prop:`--bh2-${r}`,a:1-a*.8,b:1+a*1.05,period:l*.81,delay:0,unit:""},{prop:`--bx2-${r}`,a:t*.8,b:-t*.9,period:n*1.88,delay:0,unit:"px"},{prop:`--by2-${r}`,a:-t,b:t*.65,period:n*1.88,delay:0,unit:"px"},{prop:`--bw3-${r}`,a:1-a*.6,b:1+a*1.15,period:l*.98,delay:0,unit:""},{prop:`--bh3-${r}`,a:1+a*.75,b:1-a,period:l*1.4,delay:0,unit:""},{prop:`--bx3-${r}`,a:-t*.6,b:t,period:n*1.45,delay:0,unit:"px"},{prop:`--by3-${r}`,a:-t*.85,b:t*.45,period:n*1.45,delay:0,unit:"px"},{prop:`--bgh-${r}`,a:1-s,b:1+s,period:p,delay:0,unit:""},{prop:`--bop-tl-${r}`,a:1-o,b:1,period:n,delay:0,unit:""},{prop:`--bop-tr-${r}`,a:1-o,b:1,period:n*1.32,delay:n*.28,unit:""},{prop:`--bop-bl-${r}`,a:1-o,b:1,period:n*.84,delay:n*.55,unit:""},{prop:`--bop-br-${r}`,a:1-o,b:1,period:n*1.58,delay:n*.83,unit:""}]}function Ia(r,e,a,t,o,s){if(r!=="pulse-inner"&&r!=="pulse-outside")return null;const n=xe(r,e,a);return{oscillators:La(s,n),hue:o?null:{prop:`--beam-hue-${s}`,range:360,period:n.huePeriod,continuous:!0}}}function oe(r,e,a){return`  animation: ${e}-${r} ${a}s ease forwards;`}function Aa(r){const{size:e}=r;return e==="line"?Ga(r):e==="sm"?Ta(r):e==="pulse-inner"?Va(r):e==="pulse-outside"?Ba(r):Da(r)}function Ta(r){const{id:e,borderRadius:a,borderWidth:t,duration:o,strokeOpacity:s,innerOpacity:n,bloomOpacity:l,innerShadow:p,colorVariant:g,staticColors:z,brightness:b,saturation:m,hueRange:f,theme:h}=r,$=Math.max(0,a-t),v=g==="mono"?.5:1,X=s*v,w=n*v,F=l*v,c=z?"":`animation: beam-hue-shift-${e} 12s ease-in-out infinite;`,d=z?"":`
@keyframes beam-hue-shift-${e} {
  0% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) - ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
  50% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) + ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
  100% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) - ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
}`,u=h==="dark",y=u?`conic-gradient(
        from var(--beam-angle-${e}),
        transparent 0%, transparent 54%,
        rgba(255, 255, 255, 0.1) 57%,
        rgba(255, 255, 255, 0.3) 60%,
        rgba(255, 255, 255, 0.6) 63%,
        rgba(255, 255, 255, 0.75) 66%,
        rgba(255, 255, 255, 0.6) 69%,
        rgba(255, 255, 255, 0.3) 72%,
        rgba(255, 255, 255, 0.1) 75%,
        transparent 78%, transparent 100%
      )`:`conic-gradient(
        from var(--beam-angle-${e}),
        transparent 0%, transparent 54%,
        rgba(0, 0, 0, 0.08) 57%,
        rgba(0, 0, 0, 0.2) 60%,
        rgba(0, 0, 0, 0.4) 63%,
        rgba(0, 0, 0, 0.55) 66%,
        rgba(0, 0, 0, 0.4) 69%,
        rgba(0, 0, 0, 0.2) 72%,
        rgba(0, 0, 0, 0.08) 75%,
        transparent 78%, transparent 100%
      )`,k=ka(g),W=wa(g),H=u?`conic-gradient(
        from var(--beam-angle-${e}),
        transparent 0%, transparent 58%,
        rgba(255, 255, 255, 0.03) 62%,
        rgba(255, 255, 255, 0.08) 65%,
        rgba(255, 255, 255, 0.2) 67%,
        rgba(255, 255, 255, 0.45) 69%,
        rgba(255, 255, 255, 0.85) 70%,
        rgba(255, 255, 255, 0.85) 70.5%,
        rgba(255, 255, 255, 0.45) 71.5%,
        rgba(255, 255, 255, 0.2) 73%,
        rgba(255, 255, 255, 0.08) 75%,
        rgba(255, 255, 255, 0.03) 78%,
        transparent 82%
      )`:`conic-gradient(
        from var(--beam-angle-${e}),
        transparent 0%, transparent 58%,
        rgba(0, 0, 0, 0.02) 62%,
        rgba(0, 0, 0, 0.08) 65%,
        rgba(0, 0, 0, 0.2) 67%,
        rgba(0, 0, 0, 0.4) 69%,
        rgba(0, 0, 0, 0.6) 70%,
        rgba(0, 0, 0, 0.6) 70.5%,
        rgba(0, 0, 0, 0.4) 71.5%,
        rgba(0, 0, 0, 0.2) 73%,
        rgba(0, 0, 0, 0.08) 75%,
        rgba(0, 0, 0, 0.02) 78%,
        transparent 82%
      )`,j=`conic-gradient(
    from var(--beam-angle-${e}),
    transparent 0%, transparent 22%,
    rgba(255, 255, 255, 0.12) 28%, rgba(255, 255, 255, 0.4) 36%,
    white 46%, white 82%,
    rgba(255, 255, 255, 0.4) 88%, rgba(255, 255, 255, 0.12) 94%,
    transparent 97%, transparent 100%
  )`;return`
@property --beam-angle-${e} {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: true;
}

@property --beam-opacity-${e} {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

[data-beam="${e}"] {
  position: relative;
  border-radius: ${a}px;
  overflow: hidden;
}

[data-beam="${e}"][data-active] {
  animation:
    beam-spin-${e} ${o}s linear infinite,
    beam-fade-in-${e} 0.6s ease forwards;
}

[data-beam="${e}"][data-fading] {
  animation:
    beam-spin-${e} ${o}s linear infinite,
    beam-fade-out-${e} 0.5s ease forwards;
}

[data-beam="${e}"][data-active]::after,
[data-beam="${e}"][data-fading]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${$}px;
  padding: ${t}px;
  clip-path: inset(0 round ${a}px);
  background: ${y},${k};
  -webkit-mask:
    conic-gradient(
      from var(--beam-angle-${e}),
      transparent 0%, transparent 30%,
      rgba(255, 255, 255, 0.1) 36%, rgba(255, 255, 255, 0.35) 44%,
      white 52%, white 80%,
      rgba(255, 255, 255, 0.35) 86%, rgba(255, 255, 255, 0.1) 92%,
      transparent 95%, transparent 100%
    ),
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: source-in, xor;
  mask:
    conic-gradient(
      from var(--beam-angle-${e}),
      transparent 0%, transparent 30%,
      rgba(255, 255, 255, 0.1) 36%, rgba(255, 255, 255, 0.35) 44%,
      white 52%, white 80%,
      rgba(255, 255, 255, 0.35) 86%, rgba(255, 255, 255, 0.1) 92%,
      transparent 95%, transparent 100%
    ),
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: intersect, exclude;
  pointer-events: none;
  z-index: 2;
  opacity: calc(var(--beam-opacity-${e}) * ${X.toFixed(2)} * var(--beam-stroke-opacity, 1) * var(--beam-strength, 1));
  ${c}
}

[data-beam="${e}"][data-active]::before,
[data-beam="${e}"][data-fading]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${a}px;
  clip-path: inset(0 round ${a}px);
  background: ${W};
  box-shadow: inset 0 0 5px 1px ${p};
  -webkit-mask-image: ${j};
  -webkit-mask-composite: source-over;
  mask-image: ${j};
  mask-composite: add;
  pointer-events: none;
  z-index: 1;
  opacity: calc(var(--beam-opacity-${e}) * ${w.toFixed(2)} * var(--beam-inner-opacity, 1) * var(--beam-strength, 1));
  ${c}
}

[data-beam="${e}"] [data-beam-bloom] {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: ${$}px;
  clip-path: inset(0 round ${a}px);
  background: ${H};
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  padding: ${t}px;
  filter: blur(8px) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)});
  pointer-events: none;
  z-index: 3;
  opacity: 0;
}

[data-beam="${e}"][data-active] [data-beam-bloom],
[data-beam="${e}"][data-fading] [data-beam-bloom] {
  display: block;
  opacity: calc(var(--beam-opacity-${e}) * ${F.toFixed(2)} * var(--beam-bloom-opacity, 1) * var(--beam-strength, 1));
}

@keyframes beam-spin-${e} {
  to { --beam-angle-${e}: 360deg; }
}

@keyframes beam-fade-in-${e} {
  to { --beam-opacity-${e}: 1; }
}

@keyframes beam-fade-out-${e} {
  from { --beam-opacity-${e}: 1; }
  to { --beam-opacity-${e}: 0; }
}
${d}
${B(e)}
`}function Da(r){const{id:e,borderRadius:a,borderWidth:t,duration:o,strokeOpacity:s,innerOpacity:n,bloomOpacity:l,innerShadow:p,colorVariant:g,staticColors:z,brightness:b,saturation:m,hueRange:f,theme:h}=r,$=Math.max(0,a-t),v=g==="mono"?.5:1,X=s*v,w=n*v,F=l*v,c=z?"":`animation: beam-hue-shift-${e} 12s ease-in-out infinite;`,d=z?"":`
@keyframes beam-hue-shift-${e} {
  0% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) - ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
  50% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) + ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
  100% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) - ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
}`,u=h==="dark",y=u?`conic-gradient(
        from var(--beam-angle-${e}),
        transparent 0%, transparent 54%,
        rgba(255, 255, 255, 0.1) 57%,
        rgba(255, 255, 255, 0.3) 60%,
        rgba(255, 255, 255, 0.6) 63%,
        rgba(255, 255, 255, 0.75) 66%,
        rgba(255, 255, 255, 0.6) 69%,
        rgba(255, 255, 255, 0.3) 72%,
        rgba(255, 255, 255, 0.1) 75%,
        transparent 78%, transparent 100%
      )`:`conic-gradient(
        from var(--beam-angle-${e}),
        transparent 0%, transparent 54%,
        rgba(0, 0, 0, 0.08) 57%,
        rgba(0, 0, 0, 0.2) 60%,
        rgba(0, 0, 0, 0.4) 63%,
        rgba(0, 0, 0, 0.55) 66%,
        rgba(0, 0, 0, 0.4) 69%,
        rgba(0, 0, 0, 0.2) 72%,
        rgba(0, 0, 0, 0.08) 75%,
        transparent 78%, transparent 100%
      )`,k=Wa(g),W=Ha(g),H=u?`conic-gradient(
        from var(--beam-angle-${e}),
        transparent 0%, transparent 58%,
        rgba(255, 255, 255, 0.03) 62%,
        rgba(255, 255, 255, 0.08) 65%,
        rgba(255, 255, 255, 0.2) 67%,
        rgba(255, 255, 255, 0.45) 69%,
        rgba(255, 255, 255, 0.85) 70%,
        rgba(255, 255, 255, 0.85) 70.5%,
        rgba(255, 255, 255, 0.45) 71.5%,
        rgba(255, 255, 255, 0.2) 73%,
        rgba(255, 255, 255, 0.08) 75%,
        rgba(255, 255, 255, 0.03) 78%,
        transparent 82%
      )`:`conic-gradient(
        from var(--beam-angle-${e}),
        transparent 0%, transparent 58%,
        rgba(0, 0, 0, 0.02) 62%,
        rgba(0, 0, 0, 0.08) 65%,
        rgba(0, 0, 0, 0.2) 67%,
        rgba(0, 0, 0, 0.4) 69%,
        rgba(0, 0, 0, 0.6) 70%,
        rgba(0, 0, 0, 0.6) 70.5%,
        rgba(0, 0, 0, 0.4) 71.5%,
        rgba(0, 0, 0, 0.2) 73%,
        rgba(0, 0, 0, 0.08) 75%,
        rgba(0, 0, 0, 0.02) 78%,
        transparent 82%
      )`;return`
@property --beam-angle-${e} {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: true;
}

@property --beam-opacity-${e} {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

[data-beam="${e}"] {
  position: relative;
  border-radius: ${a}px;
  overflow: hidden;
}

[data-beam="${e}"][data-active] {
  animation:
    beam-spin-${e} ${o}s linear infinite,
    beam-fade-in-${e} 0.6s ease forwards;
}

[data-beam="${e}"][data-fading] {
  animation:
    beam-spin-${e} ${o}s linear infinite,
    beam-fade-out-${e} 0.5s ease forwards;
}

[data-beam="${e}"][data-active]::after,
[data-beam="${e}"][data-fading]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${$}px;
  padding: ${t}px;
  clip-path: inset(0 round ${a}px);
  background: ${y},${k};
  -webkit-mask:
    conic-gradient(
      from var(--beam-angle-${e}),
      transparent 0%, transparent 30%,
      rgba(255, 255, 255, 0.1) 36%, rgba(255, 255, 255, 0.35) 44%,
      white 52%, white 80%,
      rgba(255, 255, 255, 0.35) 86%, rgba(255, 255, 255, 0.1) 92%,
      transparent 95%, transparent 100%
    ),
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: source-in, xor;
  mask:
    conic-gradient(
      from var(--beam-angle-${e}),
      transparent 0%, transparent 30%,
      rgba(255, 255, 255, 0.1) 36%, rgba(255, 255, 255, 0.35) 44%,
      white 52%, white 80%,
      rgba(255, 255, 255, 0.35) 86%, rgba(255, 255, 255, 0.1) 92%,
      transparent 95%, transparent 100%
    ),
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: intersect, exclude;
  pointer-events: none;
  z-index: 2;
  opacity: calc(var(--beam-opacity-${e}) * ${X.toFixed(2)} * var(--beam-stroke-opacity, 1) * var(--beam-strength, 1));
  ${c}
}

[data-beam="${e}"][data-active]::before,
[data-beam="${e}"][data-fading]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${a}px;
  background: ${W};
  box-shadow: inset 0 0 9px 1px ${p};
  -webkit-mask-image:
    conic-gradient(
      from var(--beam-angle-${e}),
      transparent 0%, transparent 30%,
      rgba(255, 255, 255, 0.1) 36%, rgba(255, 255, 255, 0.35) 44%,
      white 52%, white 80%,
      rgba(255, 255, 255, 0.35) 86%, rgba(255, 255, 255, 0.1) 92%,
      transparent 95%, transparent 100%
    ),
    linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
    linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
  -webkit-mask-composite: source-in, source-over;
  mask-image:
    conic-gradient(
      from var(--beam-angle-${e}),
      transparent 0%, transparent 30%,
      rgba(255, 255, 255, 0.1) 36%, rgba(255, 255, 255, 0.35) 44%,
      white 52%, white 80%,
      rgba(255, 255, 255, 0.35) 86%, rgba(255, 255, 255, 0.1) 92%,
      transparent 95%, transparent 100%
    ),
    linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
    linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
  mask-composite: intersect, add;
  pointer-events: none;
  z-index: 1;
  opacity: calc(var(--beam-opacity-${e}) * ${w.toFixed(2)} * var(--beam-inner-opacity, 1) * var(--beam-strength, 1));
  clip-path: inset(0 round ${a}px);
  ${c}
}

[data-beam="${e}"] [data-beam-bloom] {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: ${$}px;
  clip-path: inset(0 round ${a}px);
  background: ${H};
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  padding: ${t}px;
  filter: blur(8px) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)});
  pointer-events: none;
  z-index: 3;
  opacity: 0;
}

[data-beam="${e}"][data-active] [data-beam-bloom],
[data-beam="${e}"][data-fading] [data-beam-bloom] {
  display: block;
  opacity: calc(var(--beam-opacity-${e}) * ${F.toFixed(2)} * var(--beam-bloom-opacity, 1) * var(--beam-strength, 1));
}

@keyframes beam-spin-${e} {
  to { --beam-angle-${e}: 360deg; }
}

@keyframes beam-fade-in-${e} {
  to { --beam-opacity-${e}: 1; }
}

@keyframes beam-fade-out-${e} {
  from { --beam-opacity-${e}: 1; }
  to { --beam-opacity-${e}: 0; }
}
${d}
${B(e)}
`}function Va(r){const{id:e,borderRadius:a,borderWidth:t,duration:o,strokeOpacity:s,innerOpacity:n,bloomOpacity:l,colorVariant:p,staticColors:g,brightness:z,saturation:b,hueRange:m,theme:f}=r,h=f==="dark",$=p==="mono"?.5:1,v=(s*$).toFixed(2),X=(n*$).toFixed(2),w=(l*$).toFixed(2),{op:F}=xe("pulse-inner",f,o),c=8,d=z.toFixed(2),u=b.toFixed(2),y=g?`filter: brightness(${d}) saturate(${u});`:`filter: hue-rotate(calc(var(--beam-hue-base, 0deg) + var(--beam-hue-${e}))) brightness(${d}) saturate(${u});`,k=g?`filter: blur(${c}px) brightness(${d}) saturate(${u});`:`filter: blur(${c}px) hue-rotate(calc(var(--beam-hue-base, 0deg) + var(--beam-hue-${e}))) brightness(${d}) saturate(${u});`,W=Ea(p,e),H=Pa(p,e,h),j=Ve(Ma,p,1-F*.5);return`
${Be(e)}

[data-beam="${e}"] {
  position: relative;
  border-radius: ${a}px;
  overflow: hidden;
  isolation: isolate;
}

[data-beam="${e}"][data-active] {
${oe(e,"beam-fade-in",.6)}
}

[data-beam="${e}"][data-fading] {
${oe(e,"beam-fade-out",.5)}
}

[data-beam="${e}"][data-active]::after,
[data-beam="${e}"][data-fading]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${a}px;
  padding: ${t}px;
  clip-path: inset(0 round ${a}px);
  background: ${W};
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
  will-change: opacity, filter;
  opacity: calc(var(--beam-opacity-${e}) * ${v} * var(--beam-stroke-opacity, 1) * var(--beam-strength, 1));
  ${y}
}

[data-beam="${e}"][data-active]::before,
[data-beam="${e}"][data-fading]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${a}px;
  clip-path: inset(0 round ${a}px);
  background: ${H};
  -webkit-mask-image:
    linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
    linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
  -webkit-mask-composite: source-over;
  mask-image:
    linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
    linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
  mask-composite: add;
  pointer-events: none;
  z-index: 1;
  will-change: opacity, filter;
  opacity: calc(var(--beam-opacity-${e}) * ${X} * var(--beam-inner-opacity, 1) * var(--beam-strength, 1));
  ${y}
}

[data-beam="${e}"] [data-beam-bloom] {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: ${a}px;
  clip-path: inset(0 round ${a}px);
  background: ${j};
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  padding: ${t}px;
  pointer-events: none;
  z-index: 3;
  will-change: opacity;
  opacity: 0;
}

[data-beam="${e}"][data-active] [data-beam-bloom],
[data-beam="${e}"][data-fading] [data-beam-bloom] {
  display: block;
  opacity: calc(var(--beam-opacity-${e}) * ${w} * var(--beam-bloom-opacity, 1) * var(--beam-strength, 1));
  ${k}
}

@keyframes beam-fade-in-${e} { to { --beam-opacity-${e}: 1; } }
@keyframes beam-fade-out-${e} { from { --beam-opacity-${e}: 1; } to { --beam-opacity-${e}: 0; } }
${B(e)}

@media (prefers-reduced-motion: reduce) {
  [data-beam="${e}"][data-active],
  [data-beam="${e}"][data-fading],
  [data-beam="${e}"][data-active]::after,
  [data-beam="${e}"][data-fading]::after,
  [data-beam="${e}"][data-active]::before,
  [data-beam="${e}"][data-fading]::before,
  [data-beam="${e}"][data-active] [data-beam-bloom],
  [data-beam="${e}"][data-fading] [data-beam-bloom] {
    animation: none !important;
  }
}
`}function Ba(r){const{id:e,borderRadius:a,duration:t,strokeOpacity:o,innerOpacity:s,bloomOpacity:n,colorVariant:l,staticColors:p,brightness:g,saturation:z,hueRange:b,theme:m,hairlineOpacity:f=0}=r,h=m==="dark",$=l==="mono"?.5:1,v=(o*$).toFixed(2),X=(s*$).toFixed(2),w=(n*$).toFixed(2),F=h?"70, 70, 70":"0, 0, 0",c=f.toFixed(2),d=`linear-gradient(rgba(${F}, ${c}), rgba(${F}, ${c}))`,{op:u}=xe("pulse-outside",m,t),y=.95,k=.9,W=h?3:6,H=h?22.5:15,j=g.toFixed(2),N=z.toFixed(2),se=p?`filter: brightness(${j}) saturate(${N});`:`filter: hue-rotate(calc(var(--beam-hue-base, 0deg) + var(--beam-hue-${e}))) brightness(${j}) saturate(${N});`,q=`brightness(var(--beam-glow-brightness, ${j})) saturate(var(--beam-glow-saturate, ${N}))`,ne=p?`filter: blur(var(--beam-core-blur, ${W}px)) ${q};`:`filter: blur(var(--beam-core-blur, ${W}px)) hue-rotate(calc(var(--beam-hue-base, 0deg) + var(--beam-hue-${e}))) ${q};`,G=p?`filter: blur(var(--beam-bloom-blur, ${H}px)) ${q};`:`filter: blur(var(--beam-bloom-blur, ${H}px)) hue-rotate(calc(var(--beam-hue-base, 0deg) + var(--beam-hue-${e}))) ${q};`,D=Ce(Me,l,e),ce=Ce(Me,l,e),R=Ve(Ca,l,1-u*.5),O=f>0?`${D},
    ${d}`:D;return`
${Be(e)}

[data-beam="${e}"] {
  position: relative;
  border-radius: ${a}px;
  overflow: visible;
  isolation: isolate;
}

[data-beam="${e}"][data-active] {
${oe(e,"beam-fade-in",.6)}
}

[data-beam="${e}"][data-fading] {
${oe(e,"beam-fade-out",.5)}
}
${f>0?`
/* Idle hairline — painted above the (opaque) child in the inner 1px edge ring so
   it overlaps a standard inset component border exactly. */
[data-beam="${e}"]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${a}px;
  padding: 1px;
  clip-path: inset(0 round ${a}px);
  background: ${d};
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
}
`:""}
[data-beam="${e}"][data-active]::after,
[data-beam="${e}"][data-fading]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${a}px;
  padding: 1px;
  clip-path: inset(0 round ${a}px);
  background: ${O};
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
  will-change: opacity, filter;
  opacity: calc(var(--beam-opacity-${e}) * ${v} * var(--beam-stroke-opacity, 1) * var(--beam-strength, 1));
  ${se}
}

[data-beam="${e}"][data-active]::before,
[data-beam="${e}"][data-fading]::before {
  content: "";
  position: absolute;
  inset: -10px;
  z-index: -1;
  border-radius: ${a+10}px;
  background: ${ce};
  transform: scale(${y}, ${k});
  pointer-events: none;
  will-change: opacity, filter;
  opacity: calc(var(--beam-opacity-${e}) * ${X} * var(--beam-inner-opacity, 1) * var(--beam-strength, 1));
  ${ne}
}

[data-beam="${e}"] [data-beam-bloom] {
  display: none;
  position: absolute;
  inset: -30px;
  z-index: -1;
  border-radius: ${a+30}px;
  background: ${R};
  transform: scale(${y}, ${k});
  pointer-events: none;
  will-change: transform;
  opacity: 0;
}

[data-beam="${e}"][data-active] [data-beam-bloom],
[data-beam="${e}"][data-fading] [data-beam-bloom] {
  display: block;
  opacity: calc(var(--beam-opacity-${e}) * ${w} * var(--beam-bloom-opacity, 1) * var(--beam-strength, 1));
  ${G}
}

@keyframes beam-fade-in-${e} { to { --beam-opacity-${e}: 1; } }
@keyframes beam-fade-out-${e} { from { --beam-opacity-${e}: 1; } to { --beam-opacity-${e}: 0; } }
${B(e)}

@media (prefers-reduced-motion: reduce) {
  [data-beam="${e}"][data-active],
  [data-beam="${e}"][data-fading],
  [data-beam="${e}"][data-active]::after,
  [data-beam="${e}"][data-fading]::after,
  [data-beam="${e}"][data-active]::before,
  [data-beam="${e}"][data-fading]::before,
  [data-beam="${e}"][data-active] [data-beam-bloom],
  [data-beam="${e}"][data-fading] [data-beam-bloom] {
    animation: none !important;
  }
}
`}function Ga(r){const{id:e,borderRadius:a,borderWidth:t,duration:o,strokeOpacity:s,innerOpacity:n,bloomOpacity:l,innerShadow:p,colorVariant:g,staticColors:z,brightness:b,saturation:m,hueRange:f,theme:h}=r,$=Math.max(0,a-t),v=h==="dark",X=s,w=n,F=l,c=z?"":`animation: beam-hue-shift-${e} 12s ease-in-out infinite;`,d=z?"":`animation: beam-hue-shift-bloom-${e} 8s ease-in-out infinite;`,u=z?"":`
@keyframes beam-hue-shift-${e} {
  0% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) - ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
  50% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) + ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
  100% { filter: hue-rotate(calc(var(--beam-hue-base, 0deg) - ${f}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
}

@keyframes beam-hue-shift-bloom-${e} {
  0% { filter: blur(8px) hue-rotate(calc(var(--beam-hue-base, 0deg) - ${f+10}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
  50% { filter: blur(8px) hue-rotate(calc(var(--beam-hue-base, 0deg) + ${f+10}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
  100% { filter: blur(8px) hue-rotate(calc(var(--beam-hue-base, 0deg) - ${f+10}deg)) brightness(${b.toFixed(2)}) saturate(${m.toFixed(2)}); }
}`,y=v?`radial-gradient(
        ellipse calc(24px * var(--beam-w-${e})) calc(28px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%) calc(100% + 2px),
        rgba(255, 255, 255, 0.38) 0%,
        rgba(255, 255, 255, 0.12) 30%,
        transparent 65%
      )`:`radial-gradient(
        ellipse calc(35px * var(--beam-w-${e})) calc(28px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%) calc(100% + 2px),
        rgba(0, 0, 0, 0.6) 0%,
        rgba(0, 0, 0, 0.25) 35%,
        transparent 70%
      )`,k=ja(g,v,e),W=Oa(g,e),H=Na(g,v,e),j=g==="mono"?"filter: blur(6px);":"";return`
@property --beam-x-${e} {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

@property --beam-w-${e} {
  syntax: "<number>";
  initial-value: 1;
  inherits: true;
}

@property --beam-h-${e} {
  syntax: "<number>";
  initial-value: 1;
  inherits: true;
}

@property --beam-spike-${e} {
  syntax: "<number>";
  initial-value: 1;
  inherits: true;
}

@property --beam-spike2-${e} {
  syntax: "<number>";
  initial-value: 1;
  inherits: true;
}

@property --beam-edge-${e} {
  syntax: "<number>";
  initial-value: 1;
  inherits: true;
}

@property --beam-opacity-${e} {
  syntax: "<number>";
  initial-value: 0;
  inherits: true;
}

[data-beam="${e}"] {
  position: relative;
  border-radius: ${a}px;
  overflow: hidden;
}

[data-beam="${e}"][data-active] {
  animation:
    beam-travel-${e} ${o}s linear infinite,
    beam-edge-fade-${e} ${o}s linear infinite,
    beam-breathe-${e} ${(o*1.3).toFixed(1)}s ease-in-out infinite,
    beam-spike-${e} ${(o*1.33).toFixed(1)}s ease-in-out infinite,
    beam-spike2-${e} ${(o*1.7).toFixed(1)}s ease-in-out infinite,
    beam-fade-in-${e} 0.6s ease forwards;
}

[data-beam="${e}"][data-fading] {
  animation:
    beam-travel-${e} ${o}s linear infinite,
    beam-edge-fade-${e} ${o}s linear infinite,
    beam-breathe-${e} ${(o*1.3).toFixed(1)}s ease-in-out infinite,
    beam-spike-${e} ${(o*1.33).toFixed(1)}s ease-in-out infinite,
    beam-spike2-${e} ${(o*1.7).toFixed(1)}s ease-in-out infinite,
    beam-fade-out-${e} 0.5s ease forwards;
}

[data-beam="${e}"][data-active]::after,
[data-beam="${e}"][data-fading]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${$}px;
  padding: ${t}px;
  clip-path: inset(0 round ${a}px);
  background: ${y}, ${k};
  -webkit-mask:
    radial-gradient(
      ellipse calc(78px * var(--beam-w-${e})) calc(60px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%) 100%,
      white 0%, rgba(255, 255, 255, 0.5) 45%, transparent 100%
    ),
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: source-in, xor;
  mask:
    radial-gradient(
      ellipse calc(78px * var(--beam-w-${e})) calc(60px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%) 100%,
      white 0%, rgba(255, 255, 255, 0.5) 45%, transparent 100%
    ),
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: intersect, exclude;
  pointer-events: none;
  z-index: 2;
  opacity: calc(var(--beam-opacity-${e}) * var(--beam-edge-${e}) * ${X.toFixed(2)} * var(--beam-stroke-opacity, 1) * var(--beam-strength, 1));
  ${c}
}

[data-beam="${e}"][data-active]::before,
[data-beam="${e}"][data-fading]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: ${a}px;
  background: ${W};
  box-shadow: inset 0 0 9px 1px ${p};
  -webkit-mask-image:
    radial-gradient(
      ellipse calc(78px * var(--beam-w-${e})) calc(60px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%) 100%,
      white 0%, rgba(255, 255, 255, 0.5) 45%, transparent 100%
    ),
    linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
    linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
  -webkit-mask-composite: source-in, source-over;
  mask-image:
    radial-gradient(
      ellipse calc(78px * var(--beam-w-${e})) calc(60px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%) 100%,
      white 0%, rgba(255, 255, 255, 0.5) 45%, transparent 100%
    ),
    linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white),
    linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white);
  mask-composite: intersect, add;
  pointer-events: none;
  z-index: 1;
  opacity: calc(var(--beam-opacity-${e}) * var(--beam-edge-${e}) * ${w.toFixed(2)} * var(--beam-inner-opacity, 1) * var(--beam-strength, 1));
  clip-path: inset(0 round ${a}px);
  ${c}
}

[data-beam="${e}"] [data-beam-bloom] {
  display: none;
  position: absolute;
  inset: 0;
  border-radius: ${$}px;
  clip-path: inset(0 round ${a}px);
  padding: 0;
  -webkit-mask: radial-gradient(
    ellipse calc(84px * var(--beam-w-${e})) calc(110px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%) 100%,
    white 0%, rgba(255, 255, 255, 0.5) 35%, transparent 100%
  );
  -webkit-mask-composite: source-over;
  mask: radial-gradient(
    ellipse calc(84px * var(--beam-w-${e})) calc(110px * var(--beam-h-${e})) at calc(var(--beam-x-${e}) * 100%) 100%,
    white 0%, rgba(255, 255, 255, 0.5) 35%, transparent 100%
  );
  mask-composite: add;
  background: ${H};
  ${j}
  pointer-events: none;
  z-index: 3;
  opacity: 0;
}

[data-beam="${e}"][data-active] [data-beam-bloom],
[data-beam="${e}"][data-fading] [data-beam-bloom] {
  display: block;
  opacity: calc(var(--beam-opacity-${e}) * var(--beam-edge-${e}) * ${F.toFixed(2)} * var(--beam-bloom-opacity, 1) * var(--beam-strength, 1));
  ${d}
}

@keyframes beam-travel-${e} {
  0%   { --beam-x-${e}: 0.06;  --beam-w-${e}: 0.5; }
  10%  { --beam-x-${e}: 0.15;  --beam-w-${e}: 0.8; }
  20%  { --beam-x-${e}: 0.25;  --beam-w-${e}: 1.1; }
  30%  { --beam-x-${e}: 0.35;  --beam-w-${e}: 1.3; }
  40%  { --beam-x-${e}: 0.44;  --beam-w-${e}: 1.45; }
  50%  { --beam-x-${e}: 0.5;   --beam-w-${e}: 1.5; }
  60%  { --beam-x-${e}: 0.56;  --beam-w-${e}: 1.45; }
  70%  { --beam-x-${e}: 0.65;  --beam-w-${e}: 1.3; }
  80%  { --beam-x-${e}: 0.75;  --beam-w-${e}: 1.1; }
  90%  { --beam-x-${e}: 0.85;  --beam-w-${e}: 0.8; }
  100% { --beam-x-${e}: 0.94;  --beam-w-${e}: 0.5; }
}

@keyframes beam-edge-fade-${e} {
  0%    { --beam-edge-${e}: 0; }
  12.5% { --beam-edge-${e}: 0; }
  32.5% { --beam-edge-${e}: 1; }
  67.5% { --beam-edge-${e}: 1; }
  87.5% { --beam-edge-${e}: 0; }
  100%  { --beam-edge-${e}: 0; }
}

@keyframes beam-breathe-${e} {
  0%, 100% { --beam-h-${e}: 0.8; }
  25%      { --beam-h-${e}: 1.25; }
  55%      { --beam-h-${e}: 0.85; }
  80%      { --beam-h-${e}: 1.3; }
}

@keyframes beam-spike-${e} {
  0%   { --beam-spike-${e}: 0.8; }
  25%  { --beam-spike-${e}: 1.3; }
  50%  { --beam-spike-${e}: 0.9; }
  75%  { --beam-spike-${e}: 1.4; }
  100% { --beam-spike-${e}: 0.8; }
}

@keyframes beam-spike2-${e} {
  0%   { --beam-spike2-${e}: 1.2; }
  25%  { --beam-spike2-${e}: 0.7; }
  50%  { --beam-spike2-${e}: 1.4; }
  75%  { --beam-spike2-${e}: 0.8; }
  100% { --beam-spike2-${e}: 1.2; }
}

@keyframes beam-fade-in-${e} {
  to { --beam-opacity-${e}: 1; }
}

@keyframes beam-fade-out-${e} {
  from { --beam-opacity-${e}: 1; }
  to { --beam-opacity-${e}: 0; }
}
${u}
${B(e)}
`}const ie=new Set;let T=null,me=0;const Ua=1e3/30-2,_a=Math.PI*2;function qe(r){return(1-Math.cos(_a*r))/2}function Ge(r){if(T=requestAnimationFrame(Ge),r-me<Ua)return;me=r;const e=r/1e3;ie.forEach(({el:a,config:t})=>{for(const o of t.oscillators){const s=(e-o.delay)/o.period,n=o.a+(o.b-o.a)*qe(s);a.style.setProperty(o.prop,o.unit==="px"?`${n.toFixed(2)}px`:n.toFixed(4))}if(t.hue){const{prop:o,range:s,period:n,continuous:l}=t.hue,p=l?e/n%1*s:-s+2*s*qe(e/n);a.style.setProperty(o,`${p.toFixed(2)}deg`)}})}function Ka(){T==null&&(me=0,T=requestAnimationFrame(Ge))}function Qa(){ie.size===0&&T!=null&&(cancelAnimationFrame(T),T=null)}function Ja(r,e){const a={el:r,config:e};return ie.add(a),Ka(),()=>{ie.delete(a),Qa()}}function Za(){const[r,e]=x.useState(()=>typeof window>"u"||window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");return x.useEffect(()=>{if(typeof window>"u")return;const a=window.matchMedia("(prefers-color-scheme: dark)"),t=o=>{e(o.matches?"dark":"light")};return a.addEventListener("change",t),()=>a.removeEventListener("change",t)},[]),r}function er(r,e){return r==="auto"?e:r}const ar=x.forwardRef(function(F,w){var c=F,{children:r,size:e="md",colorVariant:a="colorful",theme:t="dark",staticColors:o=!1,duration:s,active:n=!0,borderRadius:l,brightness:p,saturation:g,hueRange:z=30,strength:b=1,className:m,style:f,onActivate:h,onDeactivate:$,onAnimationEnd:v}=c,X=Oe(c,["children","size","colorVariant","theme","staticColors","duration","active","borderRadius","brightness","saturation","hueRange","strength","className","style","onActivate","onDeactivate","onAnimationEnd"]);var ve,ye;const d=x.useId().replace(/:/g,"-"),u=Za(),y=x.useRef(null),[k,W]=x.useState(n),[H,j]=x.useState(!1),[N,se]=x.useState(!0),[q,ne]=x.useState(null),[G,D]=x.useState({x:1,y:1});x.useEffect(()=>{if(l!=null)return;const Y=y.current;if(!Y)return;const S=()=>{const P=Y.firstElementChild;if(!P)return;const de=getComputedStyle(P),L=parseFloat(de.borderTopLeftRadius);!isNaN(L)&&L>0&&ne(L)};S();const E=new MutationObserver(S);return E.observe(Y,{childList:!0,subtree:!1}),()=>E.disconnect()},[l,r]),x.useEffect(()=>{n&&!k&&!H?W(!0):!n&&k&&!H&&j(!0)},[n,k,H]),x.useEffect(()=>{const Y=y.current;if(!Y||typeof IntersectionObserver>"u")return;const S=new IntersectionObserver(E=>{for(const P of E)se(P.isIntersecting)},{rootMargin:"256px"});return S.observe(Y),()=>S.disconnect()},[]),x.useEffect(()=>{if(e!=="pulse-outside"){D({x:1,y:1});return}const Y=y.current;if(!Y)return;const S=350,E=140,P=.35,de=4,L=Q=>Math.max(P,Math.min(de,Q)),ke=()=>{const Q=Y.firstElementChild;if(!Q)return;const J=Q.getBoundingClientRect();if(!J.width||!J.height)return;const He=+L(J.width/S).toFixed(3),Xe=+L(J.height/E).toFixed(3);D(fe=>fe.x===He&&fe.y===Xe?fe:{x:He,y:Xe})};if(ke(),typeof ResizeObserver>"u")return;const we=Y.firstElementChild;if(!we)return;const We=new ResizeObserver(ke);return We.observe(we),()=>We.disconnect()},[e,r]);const ce=x.useCallback(Y=>{const S=Y.animationName;S.includes("fade-out")?(W(!1),j(!1),$==null||$()):S.includes("fade-in")&&(h==null||h()),v==null||v(Y)},[h,$,v]),R=er(t,u),O=ya[e][R],le=va[e],pe=e==="pulse-inner"||e==="pulse-outside",$e=(ve=l!=null?l:q)!=null?ve:le.borderRadius,U=s!=null?s:e==="line"?3.1:pe?2.3:1.96,he=g!=null?g:O.saturation,ze=(ye=p!=null?p:O.brightness)!=null?ye:1.3,_=e==="line"?Math.min(z,13):z,K=a==="mono"?!0:o,Ue=x.useMemo(()=>Aa({id:d,borderRadius:$e,borderWidth:le.borderWidth,duration:U,strokeOpacity:O.strokeOpacity,innerOpacity:O.innerOpacity,bloomOpacity:O.bloomOpacity,innerShadow:O.innerShadow,size:e,colorVariant:a,staticColors:K,brightness:ze,saturation:he,hueRange:_,theme:R,hairlineOpacity:O.hairlineOpacity}),[d,$e,le.borderWidth,U,O.strokeOpacity,O.innerOpacity,O.bloomOpacity,O.innerShadow,O.hairlineOpacity,e,a,K,ze,he,_,R]),be=x.useMemo(()=>pe?Ia(e,R,U,_,K,d):null,[pe,e,R,U,_,K,d]);x.useEffect(()=>{var Y;if(!be||!(k||H)||!N)return;const S=y.current;if(S&&!(typeof window<"u"&&(Y=window.matchMedia)!=null&&Y.call(window,"(prefers-reduced-motion: reduce)").matches))return Ja(S,be)},[be,k,H,N]);const _e=x.useCallback(Y=>{y.current=Y,typeof w=="function"?w(Y):w&&(w.current=Y)},[w]),Ke=I(ee(I({},f!=null?f:{}),{"--beam-strength":Math.max(0,Math.min(1,b))}),e==="pulse-outside"?{"--pulse-glow-sx":G.x,"--pulse-glow-sy":G.y}:{});return i.jsxs(i.Fragment,{children:[i.jsx("style",{children:Ue}),i.jsxs("div",ee(I({},X),{ref:_e,"data-beam":d,"data-active":k&&!H?"":void 0,"data-fading":H?"":void 0,"data-paused":k&&!H&&!N?"":void 0,className:m,style:Ke,onAnimationEnd:ce,children:[r,i.jsx("div",{"data-beam-bloom":!0})]}))]})});function rr(){const[r,e]=x.useState(()=>typeof matchMedia!="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches);return x.useEffect(()=>{const a=matchMedia("(prefers-reduced-motion: reduce)"),t=()=>e(a.matches);return a.addEventListener("change",t),()=>a.removeEventListener("change",t)},[]),r}function tr({children:r}){const e=rr();return i.jsx(ar,{size:"md",colorVariant:"sunset",theme:"dark",staticColors:!0,duration:6,strength:.65,borderRadius:16,active:!e,className:"hero-beam",children:r})}const or=4e3;function ir(r){const e=x.useRef(null),[a,t]=x.useState(0),[o,s]=x.useState(1),[n,l]=x.useState(0),[p,g]=x.useState(!1),[z,b]=x.useState(!1),[m,f]=x.useState(!1),h=x.useRef({id:-1,from:0,left:0,moved:!1}),$=()=>{const c=e.current,d=c==null?void 0:c.firstElementChild;if(!c||!(d!=null&&d.offsetWidth))return null;const u=getComputedStyle(c);return{step:d.offsetWidth+parseFloat(u.columnGap||"0"),inset:parseFloat(u.paddingInlineStart||"0")+parseFloat(u.paddingInlineEnd||"0")}},v=c=>{const d=e.current,u=$();if(!d||!u)return;const y=d.scrollWidth-d.clientWidth;if(y<4)return;const k=c>0&&d.scrollLeft>=y-4||c<0&&d.scrollLeft<=4,W=k?c>0?0:y:d.scrollLeft+c*u.step;d.scrollTo({left:W,behavior:k||ge()?"auto":"smooth"})},X=c=>{v(c),l(d=>d+1)};x.useEffect(()=>{const c=e.current;if(!c)return;let d=0;const u=()=>{d=0;const W=$();W&&(t(Math.min(r-1,Math.round(c.scrollLeft/W.step))),s(Math.max(1,Math.round((c.clientWidth-W.inset)/W.step))))},y=()=>{d||(d=requestAnimationFrame(u))};c.addEventListener("scroll",y,{passive:!0});const k=new ResizeObserver(y);return k.observe(c),u(),()=>{c.removeEventListener("scroll",y),k.disconnect(),cancelAnimationFrame(d)}},[r]),x.useEffect(()=>{const c=e.current;if(!c||typeof IntersectionObserver=="undefined"){b(!0);return}const d=new IntersectionObserver(([u])=>b(u.isIntersecting),{threshold:.3});return d.observe(c),()=>d.disconnect()},[]),x.useEffect(()=>{const c=e.current;if(!c||m||p||!z||r<2||ge()||c.scrollWidth-c.clientWidth<4)return;const d=window.setTimeout(()=>{v(1),l(u=>u+1)},or);return()=>window.clearTimeout(d)},[m,p,z,n,r,o]);const w=c=>{var u;const d=h.current;d.id===c.pointerId&&(d.id=-1,(u=e.current)==null||u.releasePointerCapture(c.pointerId),g(!1),d.moved&&(l(y=>y+1),setTimeout(()=>{h.current.moved=!1},0)))};return{ref:e,index:a,span:o,hold:p,nudge:X,handlers:{onPointerEnter:()=>f(!0),onPointerLeave:()=>f(!1),onFocus:()=>f(!0),onBlur:()=>f(!1),onPointerDown:c=>{const d=e.current;!d||c.pointerType==="touch"||c.button!==0||(h.current={id:c.pointerId,from:c.clientX,left:d.scrollLeft,moved:!1},d.setPointerCapture(c.pointerId),g(!0))},onPointerMove:c=>{const d=e.current,u=h.current;if(!d||u.id!==c.pointerId)return;const y=c.clientX-u.from;Math.abs(y)>5&&(u.moved=!0),d.scrollLeft=u.left-y},onPointerUp:w,onPointerCancel:w,onClickCapture:c=>{h.current.moved&&(c.preventDefault(),c.stopPropagation())},onKeyDown:c=>{c.key!=="ArrowLeft"&&c.key!=="ArrowRight"||(c.preventDefault(),X(c.key==="ArrowRight"?1:-1))}}}}function sr({label:r,title:e,items:a,to:t,ranked:o=!1}){const{ref:s,index:n,span:l,hold:p,nudge:g,handlers:z}=ir(a.length),b=da(26,[a.length]);return i.jsxs("section",{className:"shelf",ref:b,children:[i.jsxs("div",{className:"section-heading",children:[i.jsxs("div",{children:[i.jsx(Le,{prefix:"MỤC",children:r}),i.jsx("h2",{children:e})]}),i.jsxs("div",{className:"rail-tools",children:[i.jsxs(re,{className:"rail-all",to:t,children:["Xem tất cả",i.jsx(Re,{})]}),i.jsxs("div",{className:"rail-transport",children:[i.jsx("span",{className:"rail-ticks","aria-hidden":"true",children:a.map((m,f)=>i.jsx("i",{className:f>=n&&f<n+l?"on":""},`${m.slug}-${f}`))}),i.jsxs("span",{className:"rail-count","aria-hidden":"true",children:[String(n+1).padStart(2,"0"),i.jsx("i",{children:"/"}),String(a.length).padStart(2,"0")]}),i.jsx("button",{type:"button",onClick:()=>g(-1),"aria-label":`Phim trước trong mục ${e}`,children:i.jsx(xa,{})}),i.jsx("button",{type:"button",onClick:()=>g(1),"aria-label":`Phim sau trong mục ${e}`,children:i.jsx(Re,{})})]})]})]}),i.jsx("div",{className:"rail",children:i.jsx("div",ee(I({},z),{ref:s,tabIndex:0,role:"group",className:`movie-row${o?" ranked":""}${p?" dragging":""}`,"aria-label":`${e}: ${a.length} phim. Giữ chuột kéo ngang, hoặc dùng phím mũi tên trái phải.`,children:a.map((m,f)=>i.jsx(ia,{movie:m,rank:o?f+1:void 0},`${m.slug}-${f}`))}))})]})}function A(r){return r.items.length?i.jsx(sr,I({},r)):null}function nr({name:r}){const e=r.trim().split(/\s+/),a=e.length>1?e.pop():void 0;return i.jsxs("h1",{className:"hero-title",children:[e.join(" "),a?i.jsxs(i.Fragment,{children:[" ",i.jsx("i",{className:"hero-accent",children:a})]}):null]})}function cr({movie:r}){var n;const e=Number.isFinite(r.id)&&r.id>0,{data:a}=ta(r.id,{skip:!e}),[t,{isLoading:o}]=oa();if(!e)return null;const s=(n=a==null?void 0:a.favorite)!=null?n:!1;return i.jsxs("button",{className:s?"button ghost active":"button ghost",disabled:o,onClick:()=>t({movieId:r.id,enabled:!s}),children:[i.jsx(ca,{fill:s?"currentColor":"none"}),s?"Đã lưu":"Lưu phim này"]})}function lr({items:r}){const e=Ie();return r.length?i.jsxs("div",{className:"next-up",children:[i.jsx(Le,{prefix:"TIẾP THEO",children:"Xem gì nữa"}),i.jsx("div",{className:"next-grid",children:r.map(a=>i.jsxs(re,{to:`/movie/${a.slug}`,state:{preview:a},onPointerDown:e(a),children:[i.jsx("div",{children:i.jsx("img",{src:te(a,!0)||"/poster-placeholder.svg",alt:a.name,loading:"lazy",decoding:"async",sizes:"180px"})}),i.jsx("b",{children:a.name})]},a.slug))})]}):null}function pr(r,e){return r.length<3?r.filter((a,t)=>t!==e):[r[(e+1)%r.length],r[(e+2)%r.length]]}const br=r=>r===0?"high":"auto";function dr({items:r,index:e,onSelect:a}){return r.length<2?null:i.jsx("div",{className:"hero-dots",role:"group","aria-label":"Chọn phim nổi bật",children:r.map((t,o)=>i.jsx("button",{type:"button",className:o===e?"on":"","aria-label":o===e?`Đang chiếu: ${t.name}`:`Chuyển sang ${t.name}`,onClick:()=>a(o),children:i.jsx("i",{})},t.slug))})}function fr({rotation:r,warm:e}){var m,f,h;const[a,t]=x.useState(!1),[o,s]=x.useState(null),n=ha(r,a),l=o!=null?o:n,p=(m=r[l])!=null?m:r[0],g=$=>{$===l&&o!==null?s(null):(s($),t(!1))},z=r[(l+1)%r.length];x.useEffect(()=>{const $=z&&te(z,!0);if(!$)return;const v=new Image;return v.decoding="async",v.src=$,()=>{v.src=""}},[z]);const b=ua([p.slug]);return i.jsxs("section",{className:"hero",ref:b,onPointerEnter:()=>t(!0),onPointerLeave:()=>t(!1),children:[i.jsx("img",{"data-motion":"media",className:"hero-media",src:te(p,!0)||"/poster-placeholder.svg",alt:"",fetchPriority:br(l),decoding:"async"},p.slug),i.jsx("div",{className:"hero-veil"}),i.jsx("div",{className:"hero-overlay","aria-hidden":"true"}),i.jsxs("div",{className:"hero-layout",children:[i.jsxs("div",{className:"hero-copy","data-motion":"copy",children:[i.jsx(nr,{name:p.name}),i.jsxs("span",{className:"hero-eyebrow",children:[(h=(f=p.genres)==null?void 0:f[0])!=null?h:"Đang nổi"," · ",p.type==="series"||p.type==="tv"?"Phim bộ":"Phim lẻ"]}),i.jsx(cr,{movie:p})]}),i.jsx(tr,{children:i.jsxs("aside",{className:"hero-panel hero-panel--beam",children:[i.jsx("span",{className:"hero-eyebrow",children:p.originName||"Mới về kho"}),i.jsx(sa,{movie:p}),i.jsx("p",{className:"description",children:na(p.description)||`Xem ${p.name} ngay trên kho phim của gia đình.`}),i.jsxs("div",{className:"actions",children:[i.jsxs(re,{className:"button primary",to:`/movie/${p.slug}`,state:{preview:p},onPointerDown:e(p),children:[i.jsx(Se,{fill:"currentColor"}),"Phát"]}),i.jsxs(re,{className:"button ghost",to:`/movie/${p.slug}`,state:{preview:p},onPointerDown:e(p),children:[i.jsx(ra,{}),"Chi tiết"]}),r.length>1&&i.jsx("button",{type:"button",className:"button ghost hero-toggle","aria-hidden":"true",tabIndex:-1,onClick:()=>t($=>!$),children:a?i.jsx(Se,{fill:"currentColor"}):i.jsx(za,{fill:"currentColor"})})]}),i.jsx(dr,{items:r,index:l,onSelect:g}),i.jsx(lr,{items:pr(r,l)})]},p.slug)})]})]})}function wr(){var z,b;const r=V({kind:"home",page:1}),e=Ie(),a=V({kind:"list",value:"phim-bo",page:1}),t=V({kind:"list",value:"phim-le",page:1}),o=V({kind:"list",value:"phim-chieu-rap",page:1}),s=V({kind:"list",value:"4k",page:1}),n=(b=(z=r.data)==null?void 0:z.items)!=null?b:[],l=x.useMemo(()=>n.filter(m=>te(m,!0)).slice(0,5),[r.data]),p=n[0],g=x.useMemo(()=>[...n].sort((m,f)=>{var h,$;return((h=f.rating)!=null?h:0)-(($=m.rating)!=null?$:0)}).slice(0,10),[r.data]);return r.isError&&!p?i.jsx(Ne,{children:i.jsx("div",{className:"page-container page-top",children:i.jsx(aa,{onRetry:r.refetch})})}):p?i.jsx(gr,{rotation:l,warm:e,home:r,series:a,movies:t,cinema:o,ultra:s,items:n,top:g}):i.jsxs(Ne,{flush:!0,children:[i.jsx("div",{className:"hero-skeleton"}),i.jsxs("div",{className:"page-container page-top",children:[i.jsx(Ee,{}),i.jsx(Pe,{})]}),i.jsx(Ae,{})]})}function gr({rotation:r,warm:e,home:a,series:t,movies:o,cinema:s,ultra:n,items:l,top:p}){var h,$,v,X,w,F,c,d;const g=r[0],z=fa(!0,[g.slug,l.length]),b=ga(!0,[g.slug,l.length]),m=ma([g.slug,l.length]),f=u=>{z.current=u,b.current=u};return i.jsxs("div",{className:"home",ref:f,children:[i.jsx(la,{}),i.jsx("div",{className:"home-bg",children:i.jsx(fr,{rotation:r,warm:e})}),i.jsx("div",{className:"home-header-actions",ref:m,children:i.jsx(pa,{})}),i.jsxs("div",{className:"app-frame home-frame",children:[i.jsx("main",{children:i.jsxs("div",{className:"page-container page-top home-sheet",children:[i.jsx(Ee,{}),a.isLoading?i.jsx(Pe,{}):i.jsx(A,{label:"Mới cập nhật",title:"Vừa thêm vào kho",items:l,to:"/browse/list/phim-moi-cap-nhat"}),i.jsx(A,{label:"Điểm cao",title:"Đáng xem nhất",items:p,to:"/browse/list/phim-moi-cap-nhat",ranked:!0}),i.jsx(A,{label:"Chiếu rạp",title:"Đang chiếu tại rạp",items:($=(h=s.data)==null?void 0:h.items)!=null?$:[],to:"/browse/list/phim-chieu-rap"}),i.jsx(A,{label:"Phim bộ",title:"Xem dài hơi",items:(X=(v=t.data)==null?void 0:v.items)!=null?X:[],to:"/browse/list/phim-bo"}),i.jsx(A,{label:"Phim lẻ",title:"Xem một buổi",items:(F=(w=o.data)==null?void 0:w.items)!=null?F:[],to:"/browse/list/phim-le"}),i.jsx(A,{label:"Chất lượng",title:"Bản 4K",items:(d=(c=n.data)==null?void 0:c.items)!=null?d:[],to:"/browse/list/4k"})]})}),i.jsx(ba,{})]}),i.jsx(Ae,{})]})}export{wr as default};
