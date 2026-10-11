import{r as n,c as a}from"./index-DxqpE8aI.js";function d(e,t=320){const[o,r]=n.useState(e);return n.useEffect(()=>{const s=window.setTimeout(()=>r(e),t);return()=>window.clearTimeout(s)},[e,t]),o}function f(){const[e,t]=n.useState(!1),o=n.useRef(null);return n.useEffect(()=>{if(!e)return;const r=c=>{var i;(i=o.current)!=null&&i.contains(c.target)||t(!1)},s=c=>{c.key==="Escape"&&t(!1)};return addEventListener("pointerdown",r),addEventListener("keydown",s),()=>{removeEventListener("pointerdown",r),removeEventListener("keydown",s)}},[e]),{open:e,setOpen:t,box:o}}/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=a("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=a("ChevronDown",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=a("Search",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]);export{w as C,k as S,f as a,p as b,d as u};
