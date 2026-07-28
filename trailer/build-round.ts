import { scoreRoundV3 } from '/home/user/draw-the-chart/src/scoring/v3/index';
import { writeFileSync } from 'node:fs';
const noise = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ANCHOR = 178.62;
const lookbackPrices: number[] = [];
{ let lv = 172.4; for (let i = 0; i < 120; i++) { lv += (noise(i*3.1)-0.44)*0.62; lookbackPrices.push(lv); }
  const s = ANCHOR - lookbackPrices[lookbackPrices.length-1]!; for (let i=0;i<lookbackPrices.length;i++) lookbackPrices[i]! += s; }
const CP: [number,number][] = [[0,0],[0.18,2.1],[0.36,3.4],[0.54,1.6],[0.74,3.9],[1,5.2]];
const drawnAt = (t:number) => { for (let i=0;i<CP.length-1;i++){const [t0,p0]=CP[i]!,[t1,p1]=CP[i+1]!;
  if(t>=t0&&t<=t1) return ANCHOR+lerp(p0,p1,(t-t0)/(t1-t0));} return ANCHOR+CP[CP.length-1]![1]; };
const N = 60;
const predictedPrices = Array.from({length:N+1},(_,i)=>drawnAt(i/N));
const actualPrices = Array.from({length:N+1},(_,i)=>{ const t=i/N;
  return drawnAt(Math.min(1,t*1.30)) - 3.0*Math.sin(t*Math.PI)
    + (noise(i*5.3)-0.5)*1.0 + (noise(i*13.1)-0.5)*0.5; });
actualPrices[0] = ANCHOR;
const r = scoreRoundV3({ predictedPrices, actualPrices, lookbackPrices, seed: 445625, stake: 250 });
const out = {
  anchor: ANCHOR, stake: 250,
  percentile: +(r.percentile*100).toFixed(1), beaten: r.beaten, fieldSize: r.fieldSize,
  multiplier: +r.multiplier.toFixed(2), payout: Math.round(r.payout), profit: Math.round(r.profit),
  similarity: { shape:+r.similarity.shape.toFixed(1), direction:+r.similarity.direction.toFixed(1),
                level:+r.similarity.level.toFixed(1), total:+r.similarity.total.toFixed(1) },
  lookbackPrices: lookbackPrices.map(p=>+p.toFixed(3)),
  predictedPrices: predictedPrices.map(p=>+p.toFixed(3)),
  actualPrices: actualPrices.map(p=>+p.toFixed(3)),
  swarm: r.fieldContext.swarm.slice(0, 40).map(s => s.map(v => +v.toFixed(5))),
};
writeFileSync('/tmp/claude-0/-home-user-draw-the-chart/5803a1bd-822f-5458-8c80-c632946161ab/scratchpad/round.json', JSON.stringify(out));
console.log(JSON.stringify({ ...out, lookbackPrices:'[...]', predictedPrices:'[...]', actualPrices:'[...]', swarm:`[${out.swarm.length} paths]` }, null, 2));
