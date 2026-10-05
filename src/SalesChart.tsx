import { useState, type CSSProperties, type PointerEvent } from 'react';
import type { Entry,Offering } from '../shared/model';
import { addDays,dayCount,shortDate,today,totals,validDate } from '../shared/domain';
import { expectedSalesAt,forecastPoints,layoutSalesMilestones } from '../shared/sales';

export function SalesChart({offering:o,entries}:{offering:Offering;entries:Entry[]}) {
  const current=today(),endActual=current<o.end?current:o.end;
  const [selected,setSelected]=useState<string|null>(null),[showAll,setShowAll]=useState(false);
  const defaultDay=endActual<o.start?o.start:endActual;
  const candidate=selected&&validDate(selected)?selected:defaultDay;
  const selectedDay=candidate<o.start?o.start:candidate>o.end?o.end:candidate;
  const days=Math.max(dayCount(o.start,o.end)-1,0),top=Math.max(o.goal,totals(entries,o.start,endActual).closed,1);
  const layout=layoutSalesMilestones(o,selectedDay);
  const markerY=layout.markers.length?layout.labelRows*20+12:0;
  const plotTop=layout.markers.length?markerY+70:58,plotBottom=plotTop+126,chartHeight=plotBottom+28;
  const x=(date:string)=>30+(dayCount(o.start,date)-1)/Math.max(days,1)*270;
  const y=(count:number)=>plotBottom-count/top*126;
  const dates=endActual<o.start?[]:[...new Set([o.start,...entries.filter(entry=>entry.date<=endActual&&entry.date>=o.start).map(entry=>entry.date),endActual])].sort();
  const actual=dates.map(date=>({date,count:totals(entries,o.start,date).closed})),planned=forecastPoints(o);
  const path=(rows:{date:string;count:number}[])=>rows.map((row,index)=>(index?'L':'M')+x(row.date)+' '+y(row.count)).join(' ');
  const expected=expectedSalesAt(o,selectedDay),selectedActual=selectedDay<=endActual?totals(entries,o.start,selectedDay).closed:null;
  const anchor=Math.max(selectedActual||0,expected,actual.at(-1)?.count||0),tooltipX=Math.max(34,Math.min(206,x(selectedDay)-44)),tooltipY=y(anchor)-42;
  const axisDates=[...new Set([0,.33,.66,1].map(fraction=>addDays(o.start,Math.round(days*fraction))))];
  function selectDate(event:PointerEvent<SVGSVGElement>) {
    const bounds=event.currentTarget.getBoundingClientRect();
    const position=Math.max(30,Math.min(300,(event.clientX-bounds.left)/bounds.width*326));
    setSelected(addDays(o.start,Math.round((position-30)/270*days)));
  }
  return <div className="chart-box">
    <div className="sales-chart-wrap">
      <svg viewBox={`0 0 326 ${chartHeight}`} className="sales-chart" role="img" aria-label={`Evolución acumulada: ${totals(entries,o.start,endActual).closed} ${o.unit.toLowerCase()} de ${o.goal} previstas, con ${layout.markers.length} hitos de ventas`} onPointerDown={event=>{if(event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);selectDate(event)}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))selectDate(event)}}>
        {[0,.25,.5,.75,1].map(fraction=><g key={fraction}><line x1="30" x2="300" y1={y(top*fraction)} y2={y(top*fraction)} stroke="var(--line)"/><text x="22" y={y(top*fraction)+4} textAnchor="end">{Math.round(top*fraction)}</text></g>)}
        {layout.markers.map(marker=><g className="sales-milestone" key={marker.target.date} data-date={marker.target.date}>
          <line x1={marker.x} x2={marker.x} y1={markerY} y2={plotBottom} vectorEffect="non-scaling-stroke"/>
          <circle cx={marker.x} cy={markerY} r={Math.max(.75,Math.min(5,marker.hitWidth*326/100/2-.5))}/>
          {marker.labelRow!==null?<text className="sales-milestone-label" x={marker.labelX} y={marker.labelRow*20+14} textAnchor="middle">{marker.label}</text>:null}
        </g>)}
        <path d={path(planned)} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 5"/>
        <path d={path(actual)} fill="none" stroke="var(--purple)" strokeWidth="3"/>
        {actual.length?<circle cx={x(actual.at(-1)!.date)} cy={y(actual.at(-1)!.count)} r="4" fill="var(--purple)"/>:null}
        <g className="chart-selection"><line x1={x(selectedDay)} x2={x(selectedDay)} y1={markerY+22} y2={plotBottom}/><circle cx={x(selectedDay)} cy={y(expected)} r="4"/><text x={x(selectedDay)} y={layout.markers.length?markerY+16:12} textAnchor="middle">{shortDate(selectedDay)}</text>{selectedActual!==null?<circle cx={x(selectedDay)} cy={y(selectedActual)} r="5"/>:null}</g>
        <g className="chart-tooltip"><rect x={tooltipX} y={tooltipY} width="88" height="34" rx="6"/><text x={tooltipX+7} y={tooltipY+14}>Conseguidas: {selectedActual===null?'n/d':selectedActual}</text><text x={tooltipX+7} y={tooltipY+27}>Previstas: {Math.round(expected)}</text></g>
        {axisDates.map((date,index)=><text key={date} x={x(date)} y={plotBottom+24} textAnchor={index===0?'start':index===axisDates.length-1?'end':'middle'}>{shortDate(date)}</text>)}
      </svg>
      {layout.markers.map(marker=><button type="button" className="sales-milestone-hit" key={marker.target.date} style={{'--sales-hit-width':`min(44px, ${marker.hitWidth}%)`,left:`clamp(calc(var(--sales-hit-width) / 2), ${marker.x/326*100}%, calc(100% - var(--sales-hit-width) / 2))`,top:`${markerY/chartHeight*100}%`} as CSSProperties} tabIndex={marker.labelRow===null?-1:0} aria-label={`Hito de ventas: ${marker.target.count} ${o.unit.toLowerCase()} hasta el ${shortDate(marker.target.date)}`} aria-pressed={selectedDay===marker.target.date} onClick={()=>setSelected(marker.target.date)}/>)}
    </div>
    <div className="legend"><span><i/>Conseguidas</span><span><i className="dashed"/>Objetivo previsto</span>{layout.markers.length?<span><i className="sales-milestone-key"/>Hitos de ventas</span>:null}</div>
    {layout.markers.length>6?<details className="sales-milestone-list" onToggle={event=>setShowAll(event.currentTarget.open)}><summary>Ver los {layout.markers.length} hitos de ventas</summary>{showAll?layout.markers.map(marker=><button type="button" className="summary-row" key={marker.target.date} onClick={()=>setSelected(marker.target.date)}><span>{shortDate(marker.target.date)}</span><strong>{marker.target.count} {o.unit.toLowerCase()}</strong></button>):null}</details>:null}
    <p className="sales-selection-status" role="status">{shortDate(selectedDay)}: {selectedActual===null?'sin resultados futuros':`${selectedActual} conseguidas`}, {Math.round(expected)} previstas.</p>
    <details className="chart-detail"><summary>Mover la barra para consultar por fecha</summary><label className="field">Fecha<input type="date" min={o.start} max={o.end} value={selectedDay} onChange={event=>setSelected(event.target.value)}/></label></details>
  </div>;
}
