import type { PlotConfig } from './config';
export const fineDefaults = () => ({mode:'auto' as 'auto'|'manual',horizontal:10,vertical:5,segment:20,textGap:5,wrap:true,maxColumns:0,align:'left' as 'left'|'center'|'right'|'justify',positions:{} as Record<string,{x:number;y:number}>});
export function arrange(widths:number[], available:number, height:number, gap:number, vertical:number, columns:number, wrap:boolean, align:string) {
  const rows:number[][]=[]; let row:number[]=[], used=0;
  widths.forEach((w,i)=>{if(row.length && ((columns>0 && row.length>=columns)||(wrap && used+gap+w>available))){rows.push(row);row=[];used=0;} row.push(i);used+=(row.length>1?gap:0)+w;});if(row.length)rows.push(row);
  return rows.flatMap((r,ri)=>{const total=r.reduce((s,i)=>s+widths[i],0);const spacing=align==='justify'&&r.length>1?Math.max(gap,(available-total)/(r.length-1)):gap; const occupied=total+spacing*(r.length-1);let x=align==='center'?(available-occupied)/2:align==='right'?available-occupied:0;return r.map(i=>{const result={i,x,y:ri*(height+vertical)};x+=widths[i]+spacing;return result;});});
}
const ns='http://www.w3.org/2000/svg';
export function installLegend(gd:HTMLElement,c:PlotConfig,keys:string[],onToggle:(key:string,visible:boolean)=>void,onMove:(panel:number,key:string,x:number,y:number)=>void) {
  gd.querySelectorAll('.fine-legend').forEach(n=>n.remove());
  const plot=gd as unknown as {data:any[];_fullLayout:any}; const full=plot._fullLayout; const svg=gd.querySelectorAll('svg.main-svg')[2]??gd.querySelector('svg.main-svg');if(!svg)return;
  gd.querySelectorAll('g').forEach(g=>{const cl=g.getAttribute('class')??'';if(/^legend[0-9]*$/.test(cl)){const n=cl==='legend'?0:Number(cl.slice(6))-1;const fine=c.legendMode==='global'?c.legend.fine:c.panelOptions[n]?.legend.fine;(g as SVGElement).style.display=fine?'none':'';}});
  const root=document.createElementNS(ns,'g');root.setAttribute('class','fine-legend');root.style.pointerEvents='all';root.style.touchAction='none';svg.append(root); const warnings:string[]=[];
  const measure=document.createElementNS(ns,'text');root.append(measure);
  const groups=c.legendMode==='panel'?Array.from({length:c.panels},(_,i)=>i):[-1];
  groups.forEach(panel=>{const l=panel<0?c.legend:c.panelOptions[panel].legend;const f=l.fine;if(!f||!l.show||!c.legend.show)return;const items=plot.data.map((t,i)=>({t,i,key:keys[i]})).filter(({t})=>t.showlegend && (panel<0||t.yaxis===(panel===0?'y':`y${panel+1}`)));
    const px=(v:number)=>v*4/3; const font=px(l.fontSize??c.font.legend); measure.setAttribute('font-size',String(font));measure.setAttribute('font-family',c.font.family);
    const widths=items.map(({t})=>{measure.textContent=t.name;return measure.getComputedTextLength()+px(f.segment+f.textGap)+6;});
    const ax=full[panel<=0?'xaxis':`xaxis${panel+1}`], ay=full[panel<=0?'yaxis':`yaxis${panel+1}`];
    const x0=panel<0?full._size.l:ax._offset, y0=panel<0?full._size.t:ay._offset, w=panel<0?full._size.w:ax._length,h=panel<0?full._size.h:ay._length;
    const positions=arrange(widths,w,font+4,px(f.horizontal),px(f.vertical),l.orientation==='v'?1:f.maxColumns,f.wrap,f.align);
    const groupHeight=Math.max(font+4,...positions.map(p=>p.y+font+4));
    const top=l.position==='top'?y0-groupHeight-5:l.position==='bottom'?y0+h+px(c.font.axis+c.font.tick+c.spacing.axisTitle)+8:l.position==='manual'?y0+(1-l.y)*h:y0+8;
    items.forEach(({t,key},index)=>{const pos=positions.find(p=>p.i===index)!;const saved=f.mode==='manual'?f.positions[key]:undefined;let x=saved?x0+saved.x*w:x0+pos.x+(l.position==='manual'?l.x*w:0), y=saved?y0+(1-saved.y)*h:top+pos.y;
      const g=document.createElementNS(ns,'g');g.setAttribute('data-legend-key',key);g.setAttribute('role','button');g.setAttribute('aria-label',`图例 ${t.name}`);g.setAttribute('tabindex','0');g.style.cursor=f.mode==='manual'?'move':'pointer';const transform=()=>g.setAttribute('transform',`translate(${x},${y})`);transform();root.append(g);
      if(widths[index]>w)warnings.push(`图例文字超出当前区域，请扩大画布或缩小字号。`);
      const rect=document.createElementNS(ns,'rect');Object.entries({width:widths[index],height:font+4,fill:'white','fill-opacity':l.opacity,stroke:l.border?c.font.color:'none'}).forEach(([k,v])=>rect.setAttribute(k,String(v)));g.append(rect);
      const line=document.createElementNS(ns,'path');line.setAttribute('d',`M 2 ${font/2+2} h ${px(f.segment)}`);line.setAttribute('stroke',t.line.color);line.setAttribute('stroke-width',t.line.width);line.setAttribute('stroke-dasharray',({dash:'7 4',dot:'2 3',dashdot:'7 3 2 3'} as Record<string,string>)[t.line.dash]??'none');g.append(line);
      const text=document.createElementNS(ns,'text');text.textContent=t.name;Object.entries({x:px(f.segment+f.textGap)+2,y:font,'font-size':font,'font-family':c.font.family,fill:c.font.color}).forEach(([k,v])=>text.setAttribute(k,String(v)));g.append(text);g.setAttribute('opacity',t.visible==='legendonly'?'.4':'1');
      const toggle=()=>onToggle(key,t.visible==='legendonly');g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
      g.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const start={clientX:e.clientX,clientY:e.clientY,x,y};g.setPointerCapture(e.pointerId);let moved=false;
        g.onpointermove=ev=>{ev.stopPropagation();if(f.mode!=='manual')return;const bounds=svg.getBoundingClientRect();x=start.x+(ev.clientX-start.clientX)*full.width/bounds.width;y=start.y+(ev.clientY-start.clientY)*full.height/bounds.height;moved ||= Math.hypot(ev.clientX-start.clientX,ev.clientY-start.clientY)>3; x=Math.round(x/4)*4;y=Math.round(y/4)*4;transform();};
        g.onpointerup=ev=>{ev.stopPropagation();g.onpointermove=null;g.onpointerup=null;if(moved)onMove(panel,key,(x-x0)/w,1-(y-y0)/h);else toggle();};};
      if(x<0||y<0||x+widths[index]>full.width||y+font+4>full.height)warnings.push(`图例“${t.name}”可能裁切，请扩大画布或调整位置。`);
    });
  });measure.remove();return [...new Set(warnings)].join(' ');
}

