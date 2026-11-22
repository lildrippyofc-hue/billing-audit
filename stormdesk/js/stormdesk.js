/* =========================================================
   1) CONFIG
   ========================================================= */
const MAG = 'https://mag.ncep.noaa.gov/data';
const range = (a,b,s=1)=>{const r=[];for(let i=a;i<=b;i+=s)r.push(i);return r;};
const pad3 = n=>String(n).padStart(3,'0'), pad2 = n=>String(n).padStart(2,'0');

const P_GLOBAL = {
  'Precipitation':{precip_p06:'6-hr Precip',precip_p24:'24-hr Precip',precip_ptot:'Total Precip',precip_rate_type:'Precip Rate / Type',sim_radar_comp:'Sim. Radar (Composite)',snodpth_chng:'Snow Depth Change'},
  'Surface':{'10m_wnd_2m_temp':'2m Temp / 10m Wind / MSLP','10m_wnd_precip':'MSLP / Wind / Precip','1000_500_thick':'MSLP + 1000–500 Thickness','850_temp_mslp_precip':'850mb Temp / MSLP / Precip','1000_850_thick':'1000–850 Thickness','850_700_thick':'850–700 Thickness'},
  'Upper Air':{'500_vort_ht':'500mb Vorticity','500_wnd_ht':'500mb Wind / Height','500_rh_ht':'500mb RH','250_wnd_ht':'250mb Jet','200_wnd_ht':'200mb Wind','300_wnd_ht':'300mb Wind','700_rh_ht':'700mb RH / Omega','850_temp_ht':'850mb Temp','850_pw_ht':'850mb PWAT','850_vort_ht':'850mb Vorticity','925_temp_ht':'925mb Temp','850vor_500ht_200wd':'850 Vort / 500 Ht / 200 Wind'}
};
const P_AIGFS = JSON.parse(JSON.stringify(P_GLOBAL));
delete P_AIGFS['Precipitation'].precip_rate_type; delete P_AIGFS['Precipitation'].sim_radar_comp; delete P_AIGFS['Precipitation'].snodpth_chng; delete P_AIGFS['Upper Air']['850_pw_ht'];
const P_MESO = {
  'Precipitation':{sim_radar_comp:'Sim. Radar (Composite)',sim_radar_1km:'Sim. Radar (1 km)',precip_p01:'1-hr Precip',precip_ptot:'Total Precip',precip_rate_type:'Precip Rate / Type'},
  'Surface':{'2m_temp_10m_wnd':'2m Temp / 10m Wind','2m_dewp_10m_wnd':'2m Dewpoint','10m_wnd_sfc_gust':'Wind Gusts','1000_500_thick':'MSLP + Thickness','850_temp_mslp_precip':'850 Temp / MSLP','ceiling':'Cloud Ceiling','vis':'Visibility'},
  'Severe':{sfc_cape_cin:'SB CAPE / CIN',best_cape_cin:'MU CAPE / CIN',helicity_1km:'0–1 km Helicity',helicity_3km:'0–3 km Helicity',max_updraft_hlcy:'Updraft Helicity',echo_top:'Echo Tops'},
  'Upper Air':{'500_vort_ht':'500mb Vorticity','850_temp_ht':'850mb Temp','700_rh_ht':'700mb RH / Omega'}
};
const P_HRRR = JSON.parse(JSON.stringify(P_MESO)); P_HRRR['Precipitation'].snow_total='Total Snowfall'; P_HRRR['Severe'].lightning='Lightning';
const P_RRFS = JSON.parse(JSON.stringify(P_MESO)); P_RRFS['Precipitation'].snodpth_chng='Snow Depth Change'; P_RRFS['Precipitation'].precip_p06='6-hr Precip';
const P_GEFSMEAN = {
  'Precip':{precip_p06:'Mean 6-hr Precip',precip_p24:'Mean 24-hr Precip',precip_ptot:'Mean Total Precip',dom_precip_type:'Dominant Precip Type',snodpth_chng_mean:'Mean Snow Depth Change',snodpth_chng_sprd:'Snow Depth Change Spread'},
  'Probabilities':{'prob_precip_0.25in':'P(6-hr precip > 0.25")','prob_precip_0.5in':'P(6-hr precip > 0.50")','prob_precip_1in':'P(6-hr precip > 1.00")','prob_ice_0.25in':'P(Ice > 0.25")',prob_cape_500:'P(CAPE > 500)',prob_cape_2000:'P(CAPE > 2000)'},
  'Surface':{mslp:'Mean MSLP','2m_temp':'Mean 2m Temp','10m_wnd':'Mean 10m Wind',cape:'Mean CAPE'},
  'Upper Air':{'500_vort_ht':'500mb Height / Vort','500_wnd':'500mb Wind','500_temp':'500mb Temp','700_vort_ht':'700mb Height / Vort','850_temp':'850mb Temp','850_wnd':'850mb Wind','250_wnd':'250mb Jet'}
};
const P_RAP = {
  'Precipitation':{sim_radar_comp:'Sim. Radar (Composite)',sim_radar_1km:'Sim. Radar (1 km)',precip_p01:'1-hr Precip',precip_ptot:'Total Precip',precip_rate:'Precip Rate',snow_total:'Total Snowfall'},
  'Surface':{'2m_temp_10m_wnd':'2m Temp / 10m Wind','2m_dewp_10m_wnd':'2m Dewpoint','10m_wnd_sfc_gust':'Wind Gusts','1000_500_thick':'MSLP + 1000–500 Thickness','1000_850_thick':'1000–850 Thickness','850_700_thick':'850–700 Thickness',vis:'Visibility'},
  'Severe':{cape_cin:'CAPE / CIN',helicity:'Helicity',echo_top:'Echo Tops'},
  'Upper Air':{'500_vort_ht':'500mb Vorticity','500_temp_ht':'500mb Temp','250_wnd_ht':'250mb Jet','700_rh_ht':'700mb RH / Omega','850_temp_ht':'850mb Temp','925_temp_ht':'925mb Temp'}
};
const P_NBM = {
  'Snow & Ice':{total_accu_snow:'Total Snowfall',['6hour_accu_snow']:'6-hr Snowfall',['1hour_accu_snow']:'1-hr Snowfall',snow_liquid_ratio:'Snow:Liquid Ratio',prob_snow:'Prob. of Snow',prob_sleet:'Prob. of Sleet',prob_freezing_rain:'Prob. of Freezing Rain',['prob_1h_snow_1in']:'P(1-hr snow ≥ 1")',['10th_percentile_1hr_snow']:'10th %ile Hourly Snow',['50th_percentile_1hr_snow']:'50th %ile Hourly Snow',['90th_percentile_1hr_snow']:'90th %ile Hourly Snow'},
  'Precipitation':{precip_p06:'6-hr Precip',precip_ptot:'Total Precip',['6hour_precip_chance']:'6-hr Precip Chance',['12hour_precip_chance']:'12-hr Precip Chance',prob_rain:'Prob. of Rain'},
  'Surface':{'2m_temp_10m_wnd':'2m Temp / Wind','2m_max_temp':'Max Temp','2m_min_temp':'Min Temp','2m_apparent_temp':'Wind Chill / Feels Like','10m_wnd_gust':'Wind Gusts','2m_dewp_10m_wnd':'Dewpoint',total_cloud_cover:'Cloud Cover',visibility:'Visibility'}
};
const P_REFS = {
  'Snow & Ice':{mean_snow_total:'Mean Total Snow',mean_snow_3h:'Mean 3-hr Snow',mean_snow_1h:'Mean 1-hr Snow',['prob_3h_snow_1in']:'P(3-hr snow ≥ 1")',['prob_3h_snow_3in']:'P(3-hr snow ≥ 3")',['prob_1h_snow_1in']:'P(1-hr snow ≥ 1")',prob_snow:'Prob. of Snow',prob_sleet:'Prob. of Sleet',prob_freezing_rain:'Prob. of Freezing Rain',['prob_2m_temp_0C']:'P(2m temp < 32°F)'},
  'Precip & Radar':{mean_precip_ptot:'Mean Total Precip',mean_precip_p03:'Mean 3-hr Precip',lpmm_mean_precip_ptot:'LPMM Total Precip',pmm_refd_max:'PMM Max Reflectivity',prob_cref_40dbz:'P(Comp. Refl > 40 dBZ)'},
  'Surface':{mean_2m_temp:'Mean 2m Temp',mean_2m_dewp:'Mean 2m Dewpoint',prob_10m_wspd_30kt:'P(Wind > 30 kt)',mean_vis:'Mean Visibility'},
  'Convection':{mean_ml_cape:'Mean ML CAPE',prob_cape_1000:'P(CAPE > 1000)',prob_max_hlcy_75:'P(UH > 75)'}
};
const EXTERNAL_MODELS = [
  ['College of DuPage NEXLAB (NAM, GFS, HRRR, RAP, ECMWF, GEM, ICON…)','https://weather.cod.edu/forecast/'],
  ['Pivotal Weather (ECMWF, GFS, GEM, UKMET, NAM, Kuchera snow)','https://www.pivotalweather.com/model.php'],
  ['Tropical Tidbits models','https://www.tropicaltidbits.com/analysis/models/'],
  ['ECMWF Charts (IFS, AIFS, ENS)','https://charts.ecmwf.int/'],
  ['Canada: GDPS / RDPS / HRDPS / GEPS','https://weather.gc.ca/model_forecast/index_e.html'],
  ['UKMET, ARPEGE, ICON, JMA (Meteociel)','https://www.meteociel.fr/modeles/'],
  ['NAVGEM / COAMPS (FNMOC)','https://www.fnmoc.navy.mil/'],
  ['WPC model diagnostics','https://www.wpc.ncep.noaa.gov/mdlbias/'],
  ['NCEP MAG (all NOAA models)','https://mag.ncep.noaa.gov/'],
];


const ECMWF_PRODUCTS = {
  'Precip & Snow':{'medium-mslp-rain':'MSLP & 6-hr precipitation','medium-rain-rate':'Precip rate & type','medium-snowfall':'6-hr snowfall','medium-tcw':'Precipitable water'},
  'Surface':{'medium-mslp-wind850':'MSLP & 850 mb wind','medium-2t-wind':'2 m temperature & wind','medium-cloud-cover':'Cloud cover'},
  'Upper Air':{'medium-z500-t850':'500 mb height & 850 mb temp','medium-uv-z|250':'250 mb jet & height','medium-uv-z|500':'500 mb wind & height','medium-uv-z|700':'700 mb wind & height','medium-uv-z|850':'850 mb wind & height','medium-t-z|850':'850 mb temperature & height','medium-t-z|500':'500 mb temperature & height'}
};
/* Each model: dir (MAG folder), areas, cycles (UTC), latency (hrs after init before useful), hours(cycle) */
const MODELS = {
  gfs:   {name:'GFS', desc:'NOAA Global, 0.25°, to 16 days', group:'Global', kind:'mag', dir:'gfs', params:P_GLOBAL,
          areas:{namer:'North America','west-atl':'Western Atlantic',samer:'South America',alaska:'Alaska',europe:'Europe'},
          cycles:[0,6,12,18], latency:4.5, hours:()=>range(0,120,3).concat(range(126,384,6))},
  aigfs: {name:'AIGFS', desc:'NOAA AI global model', group:'Global', kind:'mag', dir:'aigfs', params:P_AIGFS,
          areas:{namer:'North America'}, cycles:[0,6,12,18], latency:5, hours:()=>range(0,384,6)},
  ecmwf_oc:{name:'ECMWF', desc:'Official ECMWF IFS charts, 00Z/12Z runs to 15 days', group:'ECMWF', kind:'ecmwf', params:ECMWF_PRODUCTS, defaultParam:'medium-z500-t850',
          areas:{opencharts_north_america:'North America'}, cycles:[0,12], latency:7.5, hours:()=>range(0,144,6).concat(range(156,360,12))},
  cmc_gdps_img:{name:'GDPS', desc:'Official Environment Canada GDPS maps, to 10 days', group:'Canada (CMC)', kind:'geomet', wms:['GDPS','GDPS_15km'], params:{'Loading…':{}}},
  cmc_rdps_img:{name:'RDPS', desc:'Official Environment Canada regional model maps, ~3.5 days', group:'Canada (CMC)', kind:'geomet', wms:['RDPS','RDPS_10km'], params:{'Loading…':{}}},
  cmc_hrdps_img:{name:'HRDPS', desc:'Official Environment Canada 2.5 km maps, 2 days', group:'Canada (CMC)', kind:'geomet', wms:['HRDPS','HRDPS_2.5km'], params:{'Loading…':{}}},
  cmc_geps_img:{name:'GEPS', desc:'Canadian global ensemble maps (means & probabilities)', group:'Canada (CMC)', kind:'geomet', wms:['GEPS'], params:{'Loading…':{}}},
  ecmwf: {name:'ECMWF', desc:'European IFS 9 km, interactive', group:'Interactive (Windy)', kind:'windy', product:'ecmwf'},
  icon:  {name:'ICON', desc:'German DWD global, interactive', group:'Interactive (Windy)', kind:'windy', product:'icon'},
  gfsw:  {name:'GFS', desc:'interactive version', group:'Interactive (Windy)', kind:'windy', product:'gfs'},
  iconeu:{name:'ICON-EU', desc:'7 km Europe, interactive', group:'Interactive (Windy)', kind:'windy', product:'iconEu'},
  hrrr:  {name:'HRRR', desc:'3 km, hourly runs', group:'Mesoscale (CONUS)', kind:'mag', dir:'hrrr', params:P_HRRR,
          areas:{conus:'CONUS'}, cycles:range(0,23), latency:2, hours:c=>c%6===0?range(0,48):range(0,18)},
  rrfs:  {name:'RRFS', desc:'3 km Rapid Refresh FV3 (NAM successor)', group:'Mesoscale (CONUS)', kind:'mag', dir:'rrfs', params:P_RRFS,
          areas:{conus:'CONUS'}, cycles:range(0,23), latency:2.5, hours:c=>c%6===0?range(0,48).concat(range(51,84,3)):range(0,18)},
  rap:   {name:'RAP', desc:'13 km Rapid Refresh, hourly', group:'Mesoscale (CONUS)', kind:'mag', dir:'rap', params:P_RAP,
          areas:{conus:'CONUS'}, cycles:range(0,23), latency:1.5, hours:c=>c%6===3?range(0,51):range(0,21)},

  /* --- Map viewer models (drawn from Open-Meteo point grids) --- */
  ecm_ifs:{name:'ECMWF IFS', desc:'European flagship HRES, 0.25°, to 15 days', group:'Data maps (drawn here)', kind:'grid', om:'ecmwf_ifs025', days:15, step:6},
  ecm_aifs:{name:'ECMWF AIFS', desc:'ECMWF AI model, to 15 days', group:'ECMWF', kind:'grid', om:'ecmwf_aifs025_single', days:15, step:6},
  cmc_gdps:{name:'CMC GDPS', desc:'Canadian global GEM, ~15 km, to 10 days', group:'Data maps (drawn here)', kind:'grid', om:'gem_global', days:10, step:6},
  cmc_rdps:{name:'CMC RDPS', desc:'Canadian regional GEM, 10 km, ~3.5 days', group:'Data maps (drawn here)', kind:'grid', om:'gem_regional', days:4, step:3},
  cmc_hrdps:{name:'CMC HRDPS', desc:'Canadian 2.5 km high-res, 2 days', group:'Data maps (drawn here)', kind:'grid', om:'gem_hrdps_continental', days:2, step:3},
  g_graphcast:{name:'GraphCast', desc:'Google DeepMind AI model (GFS-initialized), 10 days', group:'Google AI', kind:'grid', om:'gfs_graphcast025', days:10, step:6},
  ukmo:{name:'UKMO', desc:'UK Met Office global 10 km, 7 days', group:'More global', kind:'grid', om:'ukmo_global_deterministic_10km', days:7, step:6},
  icon_g:{name:'ICON', desc:'German DWD global 13 km, 7.5 days', group:'More global', kind:'grid', om:'icon_global', days:7, step:6},
  jma:{name:'JMA', desc:'Japan GSM, 11 days', group:'More global', kind:'grid', om:'jma_gsm', days:11, step:6},
  arpege:{name:'ARPEGE', desc:'Météo-France global, 4 days', group:'More global', kind:'grid', om:'meteofrance_arpege_world', days:4, step:6},
  cma:{name:'CMA', desc:'China GRAPES global, 10 days', group:'More global', kind:'grid', om:'cma_grapes_global', days:10, step:6},
  kma:{name:'KMA', desc:'Korea global, 12 days', group:'More global', kind:'grid', om:'kma_gdps', days:12, step:6},
  bom:{name:'ACCESS-G', desc:'Australia BOM global, 10 days', group:'More global', kind:'grid', om:'bom_access_global', days:10, step:6},
  gfs_grid:{name:'GFS (map viewer)', desc:'GFS in the same viewer, for side-by-side checks', group:'More global', kind:'grid', om:'gfs_global', days:10, step:6},
  nam_grid:{name:'NAM 3 km', desc:'NCEP NAM CONUS nest, ~2.5 days', group:'More global', kind:'grid', om:'ncep_nam_conus', days:3, step:3},
  nbm:   {name:'NBM', desc:'National Blend — snow totals, ptype odds', group:'Blends & Winter', kind:'mag', dir:'nbm', params:P_NBM,
          areas:{conus:'CONUS'}, cycles:range(0,23), latency:1.5, hours:()=>range(1,36).concat(range(39,264,3))},
};
const WINDY_LAYERS = {temp:'Temperature',rain:'Rain / Snow / Thunder',ptype:'Precip Type',snowAccu:'Snow Accumulation',rainAccu:'Rain Accumulation',wind:'Wind',gust:'Wind Gusts',pressure:'Pressure',clouds:'Clouds',cape:'CAPE',dewpoint:'Dew Point'};

const ENS_MODELS = {
  gefsmean:{name:'GEFS Mean & Spread', desc:'31 members, to 16 days', kind:'mag', dir:'gefs-mean-sprd', params:P_GEFSMEAN,
            areas:{namer:'North America','west-atl':'Western Atlantic'}, cycles:[0,6,12,18], latency:6, hours:()=>range(0,384,6)},
  refs:{name:'REFS', desc:'Rapid Refresh ensemble, CONUS, ~2.5 days', kind:'mag', dir:'refs', params:P_REFS,
            areas:{conus:'CONUS'}, cycles:[0,6,12,18], latency:4, hours:()=>range(1,60)}
};
const SPAG = {dir:'gefs-spag', area:'namer', cycles:[0,6,12,18], latency:6, hours:()=>range(0,384,6),
  params:{'500_528_570_ht':'500mb 528/570 dam','500_522_564_ht':'500mb 522/564 dam','500_534_576_ht':'500mb 534/576 dam','500_540_582_ht':'500mb 540/582 dam','500_516_558_ht':'500mb 516/558 dam','500_510_552_ht':'500mb 510/552 dam','mslp_1000_1040_iso':'MSLP 1000/1040 mb','mslp_1004_1044_iso':'MSLP 1004/1044 mb','mslp_1008_1048_iso':'MSLP 1008/1048 mb','mslp_996_1036_iso':'MSLP 996/1036 mb','200_1200_ht':'200mb 1200 dam'}};

/* =========================================================
   2) HELPERS
   ========================================================= */
const $ = id=>document.getElementById(id);
const store = {get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtZ = d=>`${pad2(d.getUTCHours())}Z ${DOW[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
const fmtLocal = d=>d.toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric'});

/* Most recent init time for a cycle hour, given latency */
function cycleDate(c, latency){
  const now = Date.now(); const d = new Date(); d.setUTCMinutes(0,0,0); d.setUTCHours(c);
  while(d.getTime() > now - latency*3600e3) d.setUTCDate(d.getUTCDate()-1);
  return d;
}
function latestCycle(cycles, latency){
  let best=cycles[0], bt=0;
  cycles.forEach(c=>{const t=cycleDate(c,latency).getTime(); if(t>bt){bt=t;best=c;}});
  return best;
}
function fillCycles(sel, cycles, latency){
  const latest = latestCycle(cycles, latency);
  const sorted = cycles.slice().sort((a,b)=>cycleDate(b,latency)-cycleDate(a,latency));
  sel.innerHTML = sorted.map(c=>`<option value="${c}" ${c===latest?'selected':''}>${fmtZ(cycleDate(c,latency))}${c===latest?' (latest)':''}</option>`).join('');
}
const magUrl = (dir,c,area,param,fh)=>{ const u=`${MAG}/${dir}/${pad2(c)}/${area}/${param}/${dir}_${area}_${pad3(fh)}_${param}.gif`; return (window.STORMDESK_PROXY? window.STORMDESK_PROXY+encodeURIComponent(u) : u); };

/* Re-usable image-loop controller (model, ensemble, spaghetti viewers).
   Short runs get hour buttons; long runs get a slider + day-jump chips. */
class Looper{
  /* Image-loop controller for model maps. NOAA's map server can take 20-45 s per image, so frames are loaded in the
     background (a few at a time, nearest first), shown only once fully loaded, and play waits for frames instead of
     skipping past them. A loading banner shows which hour is coming and how long it has been loading. */
  constructor(o){
    Object.assign(this,o); this.idx=0; this.timer=null; this.bad=new Set(); this.cache=new Map(); this.queue=[]; this.active=0; this.want=null;
    this.maxParallel=this.maxParallel||4;
    this.msg=document.createElement('div'); this.msg.className='loadmsg'; this.msg.hidden=true; this.wrap.appendChild(this.msg);
    this.img.addEventListener('load',()=>this.wrap.classList.remove('err'));
  }
  setHours(h){
    this.hours=h; this.bad=new Set(); this.queue=[]; if(this.idx>=h.length)this.idx=0; const el=this.hoursEl;
    this.mode = h.length<=40 ? 'btn' : 'slider'; el.classList.toggle('hours', this.mode==='btn');
    if(this.mode==='btn'){
      el.innerHTML=h.map((x,i)=>`<button data-i="${i}">${x}</button>`).join('');
      el.querySelectorAll('button').forEach(b=>b.onclick=()=>{this.stop();this.go(+b.dataset.i)});
    } else {
      const maxD=Math.ceil(h[h.length-1]/24); let chips=`<button data-i="0">Start</button>`;
      for(let d=1; d<=maxD; d++){const i=h.findIndex(x=>x>=d*24); if(i>=0) chips+=`<button data-i="${i}" data-d="${d}">D${d}</button>`;}
      el.innerHTML=`<div class="slider"><input type="range" min="0" max="${h.length-1}" value="${this.idx}" aria-label="Forecast hour"><span class="fh"></span></div><div class="daychips">${chips}</div>`;
      this.range=el.querySelector('input'); this.fhEl=el.querySelector('.fh');
      this.range.oninput=()=>{this.stop(); this.go(+this.range.value);};
      el.querySelectorAll('.daychips button').forEach(b=>b.onclick=()=>{this.stop(); this.go(+b.dataset.i);});
    }
    this.go(this.idx);
  }
  markBad(i){ this.bad.add(i); if(this.mode==='btn'){const b=this.hoursEl.children[i]; if(b)b.classList.add('bad');} }
  /* frame state: undefined | {state:'loading'|'ok'|'err', url} keyed by the image URL (or a promise for async sources) */
  frameKey(fh){ return this.url(fh) || (this.asyncKey? this.asyncKey(fh) : null); }
  load(fh, cb){
    const key=this.frameKey(fh); if(!key){ cb&&cb('err'); return; }
    let f=this.cache.get(key);
    if(f){ if(f.state==='loading'){ (f.cbs=f.cbs||[]).push(cb); } else cb&&cb(f.state,f.src); return; }
    f={state:'loading',cbs:cb?[cb]:[],t0:Date.now()}; this.cache.set(key,f);
    const finish=(state,src)=>{ f.state=state; f.src=src; this.active=Math.max(0,this.active-1); (f.cbs||[]).forEach(c=>c&&c(state,src)); f.cbs=[]; this.pump(); };
    const fetchImg=src=>{ const im=new Image(); const to=setTimeout(()=>{ im.src=''; finish('err'); },90000);
      im.onload=()=>{clearTimeout(to); finish('ok',src);}; im.onerror=()=>{clearTimeout(to); finish('err');}; im.src=src; };
    this.active++;
    const u=this.url(fh);
    if(u) fetchImg(u);
    else if(this.asyncUrl){ const pr=this.asyncUrl(fh); if(!pr){ finish('err'); return; }
      Promise.race([pr, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),30000))]).then(fetchImg).catch(()=>finish('err')); }
    else finish('err');
  }
  pump(){ // background prefetch, nearest frames first
    while(this.active<this.maxParallel && this.queue.length){ const fh=this.queue.shift(); const k=this.frameKey(fh); const f=k&&this.cache.get(k); if(!f) this.load(fh); }
  }
  prefetch(n){ if(!this.hours) return; const q=[]; for(let k=1;k<=n;k++){ q.push(this.hours[(this.idx+k)%this.hours.length]); } if(this.idx>0) q.push(this.hours[this.idx-1]); this.queue=q; this.pump(); }
  showMsg(text){ this.msg.hidden=!text; if(text) this.msg.innerHTML=text; this.wrap.classList.toggle('loading',!!text); }
  go(i){
    if(!this.hours||!this.hours.length)return; this.idx=(i+this.hours.length)%this.hours.length; const fh=this.hours[this.idx], idx=this.idx;
    if(this.mode==='btn') [...this.hoursEl.children].forEach((b,j)=>b.classList.toggle('active',j===idx));
    else { this.range.value=idx; this.fhEl.textContent='f'+pad3(fh);
      const day=Math.floor(fh/24); this.hoursEl.querySelectorAll('.daychips button').forEach(b=>b.classList.toggle('on', (+b.dataset.d||0)===day)); }
    this.want=fh; clearInterval(this._tick);
    const shown=()=>this.img.getAttribute('src')&&this.img.naturalWidth;
    const done=(state,src)=>{ if(this.want!==fh) return; clearInterval(this._tick); this.showMsg('');
      if(state==='ok'){ this.wrap.classList.remove('err'); this.img.src=src; }
      else { this.wrap.classList.add('err'); this.markBad(idx); } };
    const key=this.frameKey(fh), f=key&&this.cache.get(key);
    if(!(f&&f.state!=='loading')){
      const t0=f?f.t0:Date.now();
      const upd=()=>this.showMsg(`<span class="spinner"></span> Loading <b>f${pad3(fh)}</b>… ${Math.round((Date.now()-t0)/1000)}s${shown()?' <span class="muted">· still showing the previous map</span>':''}<br><small class="muted">NOAA's map server is slow right now (often 20–45 s per map). Maps you've already viewed load instantly.</small>`);
      upd(); this._tick=setInterval(upd,1000);
    }
    this.load(fh,done);
    if(this.onChange)this.onChange(fh);
    this.prefetch(this.timer?10:4);
  }
  nextIndex(){ let n=this.idx; for(let k=0;k<this.hours.length;k++){ n=(n+1)%this.hours.length; if(!this.bad.has(n)) return n; } return (this.idx+1)%this.hours.length; }
  next(){ this.go(this.nextIndex()); }
  prev(){ this.go(this.idx-1); }
  play(){ if(this.timer) return this.stop(); this.playBtn.textContent='❚❚ Pause'; this.timer=1;
    const step=()=>{ if(!this.timer) return; const n=this.nextIndex(), fh=this.hours[n], k=this.frameKey(fh), f=k&&this.cache.get(k);
      if(f&&f.state==='ok'){ this.go(n); this.timer=setTimeout(step,+(this.speedEl?this.speedEl.value:450)); }
      else if(f&&f.state==='err'){ this.markBad(n); this.timer=setTimeout(step,50); }
      else { this.load(fh); this.prefetch(10); this.showMsg(`<span class="spinner"></span> Buffering <b>f${pad3(fh)}</b>… the loop continues as maps arrive.`); this.timer=setTimeout(step,500); } };
    this.prefetch(10); this.timer=setTimeout(step,300); }
  stop(){ clearTimeout(this.timer); this.timer=null; if(this.playBtn)this.playBtn.textContent='▶ Play'; if(this.want!=null){ const k=this.frameKey(this.want), f=k&&this.cache.get(k); if(f&&f.state!=='loading') this.showMsg(''); } }
}
function validText(c, latency, fh){
  const init=cycleDate(c,latency), v=new Date(init.getTime()+fh*3600e3);
  return `Init <b>${fmtZ(init)}</b> · Hour <b>${pad3(fh)}</b> · Valid <b>${fmtZ(v)}</b> · ${fmtLocal(v)} your time`;
}

/* =========================================================
   3) NAVIGATION (hamburger drawer)
   ========================================================= */
const SECTIONS = [
  ['Home',[['home','🏠','Dashboard','Now, alerts, model snow totals, snow-day odds']]],
  ['Winter tracking',[['winter','❄️','Winter Desk','Storm totals, Kuchera, ice, trends, roads'],['sounding','🎈','Soundings','Model skew-T for your ZIP · precip type']]],
  ['Models',[['models','🗺️','Forecast Models','GFS, HRRR, RRFS, RAP, NBM, ECMWF, ICON…'],['ensembles','📊','Ensembles','GEFS mean/spread, REFS snow odds'],
             ['longrange','🗓️','Long Range','EC46, SEAS5, NMME, CFSv2, AO/NAO/MJO'],['spaghetti','🍝','Spaghetti Plots','GEFS maps + point plumes'],['pointmodels','📈','Model Compare','40+ models at your ZIP']]],
  ['Observations',[['satellite','🛰️','Satellite','GOES East & West'],['radar','📡','Radar','NWS radar loops'],['analysis','🧭','Analysis','Surface, upper air, snow depth']]],
  ['Outlooks',[['outlooks','📅','Outlooks','WPC snow odds, QPF, SPC, CPC'],['tropics','🌀','Tropics','NHC outlooks & storms']]],
  ['Your Weather',[['local','📍','Local 20-Day','ZIP forecast with snow %']]],
  ['Politics & World',[['politics','🗳️','Politics','2028 polling averages, approval, Iran & Ukraine news']]]
];
$('drawerNav').innerHTML=SECTIONS.map(([g,items])=>`<h5>${g}</h5>`+items.map(([id,ic,name,d])=>
  `<button class="ditem" data-tab="${id}"><span class="dic">${ic}</span><span><b>${name}</b><small>${d}</small></span></button>`).join('')).join('');
const SECNAME={}; SECTIONS.forEach(([,it])=>it.forEach(([id,,n])=>SECNAME[id]=n));
function openDrawer(o){document.body.classList.toggle('drawer-open',o); $('burger').setAttribute('aria-expanded',o);}
$('burger').onclick=()=>openDrawer(!document.body.classList.contains('drawer-open'));
$('drawerShade').onclick=()=>openDrawer(false); $('drawerClose').onclick=()=>openDrawer(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape')openDrawer(false);});
function showTab(t){
  document.querySelectorAll('#drawerNav .ditem').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+t));
  $('curSec').textContent=SECNAME[t]||''; openDrawer(false); location.hash=t; lazyInit(t); window.scrollTo(0,0);
}
document.querySelectorAll('#drawerNav .ditem').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
document.addEventListener('click',e=>{const g=e.target.closest('[data-goto]'); if(g){e.preventDefault();showTab(g.dataset.goto);}});
setInterval(()=>{const n=new Date(); $('clock').innerHTML=`${pad2(n.getUTCHours())}:${pad2(n.getUTCMinutes())}Z<br>${n.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;},1000);

/* =========================================================
   4) FORECAST MODELS TAB
   ========================================================= */
const MV = {model:'gfs', param:'500_vort_ht', area:'namer', windyLayer:'temp', paramFor:{}};
const mvLoop = new Looper({img:$('mvImg'), wrap:$('mvWrap'), hoursEl:$('mvHours'), playBtn:$('mvPlay'), speedEl:$('mvSpeed'),
  url:fh=>{const m=MODELS[MV.model]; if(m.kind==='mag') return magUrl(m.dir, +$('mvCycle').value, MV.area, MV.param, fh); if(m.kind==='geomet') return wmsUrl(m,fh); return null;},
  asyncUrl:fh=>{const m=MODELS[MV.model]; return m.kind==='ecmwf' ? ecmwfUrl(m,fh) : null;},
  asyncKey:fh=>{const m=MODELS[MV.model]; return m.kind==='ecmwf' ? `ec|${MV.param}|${$('mvCycle').value}|${MV.area}|${fh}` : null;},
  onChange:fh=>{const m=MODELS[MV.model];
    if(m.kind==='geomet'){ const L=m.layers&&m.layers[MV.param]; if(!L) return; const v=new Date(L.t0+fh*3600e3);
      $('mvValid').innerHTML=`Valid <b>${fmtZ(v)}</b> · ${fmtLocal(v)} your time · +${fh} h from first map · latest run`;
      $('mvSrc').href='https://weather.gc.ca/model_forecast/index_e.html'; $('mvSrc').textContent='Environment Canada model charts ↗'; return; }
    $('mvValid').innerHTML=validText(+$('mvCycle').value,m.latency,fh);
    if(m.kind==='ecmwf'){ $('mvSrc').href='https://charts.ecmwf.int/products/'+MV.param.split('|')[0]; $('mvSrc').textContent='Open on charts.ecmwf.int ↗'; }
    else { $('mvSrc').href='https://mag.ncep.noaa.gov/'; $('mvSrc').textContent='Open NCEP MAG ↗'; } }});

/* ---- ECMWF OpenCharts (official IFS images, CC BY 4.0) ---- */
const ecCache={};
async function ecmwfUrl(m,fh){
  const [slug,level]=MV.param.split('|'), base=cycleDate(+$('mvCycle').value,m.latency), valid=new Date(base.getTime()+fh*3600e3);
  const iso=d=>d.toISOString().slice(0,19)+'Z', key=`${slug}|${level}|${iso(base)}|${fh}|${MV.area}`;
  if(ecCache[key]) return ecCache[key];
  const u=`https://charts.ecmwf.int/opencharts-api/v1/products/${slug}/?base_time=${iso(base)}&valid_time=${iso(valid)}&projection=${MV.area}${level?'&level='+level:''}`;
  const r=await fetch(px(u)); if(!r.ok) throw new Error('ecmwf'); const j=await r.json();
  return ecCache[key]=j.data.link.href;
}

/* ---- Environment Canada MSC GeoMet (official CMC model maps via WMS) ---- */
const WMS='https://geo.weather.gc.ca/geomet';
function parseDim(s){ s=(s||'').trim(); if(!s) return null;
  const parts=s.split(','); let times=[];
  parts.forEach(pt=>{ if(pt.includes('/')){ const [a,b,p]=pt.split('/'); const st=Date.parse(a), en=Date.parse(b), ph=+((p||'').match(/PT(\d+)H/)||[0,3])[1]; for(let t=st;t<=en;t+=ph*3600e3) times.push(t);} else times.push(Date.parse(pt)); });
  times=times.filter(t=>!isNaN(t)).sort((a,b)=>a-b); if(!times.length) return null;
  return {t0:times[0], hours:times.map(t=>Math.round((t-times[0])/3600e3))};
}
async function geometDiscover(m){
  if(m.layers) return true;
  for(const g of m.wms){
    try{
      const r=await fetch(px(`${WMS}?service=WMS&version=1.3.0&request=GetCapabilities&layer=${encodeURIComponent(g)}`)); if(!r.ok) continue;
      const xml=new DOMParser().parseFromString(await r.text(),'text/xml'); const layers={}, cats={};
      [...xml.getElementsByTagName('Layer')].forEach(L=>{
        const name=[...L.children].find(c=>c.localName==='Name'); const dim=[...L.children].find(c=>c.localName==='Dimension'&&c.getAttribute('name')==='time');
        if(!name||!dim) return; const d=parseDim(dim.textContent); if(!d) return;
        const title=([...L.children].find(c=>c.localName==='Title')||{}).textContent||name.textContent;
        const par=L.parentElement, cat=((par&&[...par.children].find(c=>c.localName==='Title'))||{}).textContent||'Layers';
        layers[name.textContent]={...d,title}; (cats[cat]=cats[cat]||{})[name.textContent]=title.replace(/^(GDPS|RDPS|HRDPS|GEPS)[^-–]*[-–]\s*/,'');
      });
      if(Object.keys(layers).length){ m.layers=layers; m.params=cats; return true; }
    }catch(e){}
  }
  return false;
}
function wmsRegion(){ const r=gridRegions(); return r[MV.area]||r.conus; }
function wmsUrl(m,fh){
  const L=m.layers&&m.layers[MV.param]; if(!L) return null; const r=wmsRegion();
  const t=new Date(L.t0+fh*3600e3).toISOString().slice(0,19)+'Z', mid=(r.lat0+r.lat1)/2*Math.PI/180;
  const W=1200, H=Math.round(W*(r.lat1-r.lat0)/((r.lon1-r.lon0)*Math.cos(mid)));
  return `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${encodeURIComponent(MV.param)}&STYLES=&CRS=EPSG:4326&BBOX=${r.lat0},${r.lon0},${r.lat1},${r.lon1}&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${t}`;
}
function drawWmsOverlay(){
  const m=MODELS[MV.model], cv=$('mvOverlay'); if(m.kind!=='geomet'){cv.style.display='none'; return;}
  const img=$('mvImg'), wr=$('mvWrap').getBoundingClientRect(), ir=img.getBoundingClientRect(); if(!ir.width) return;
  cv.style.display='block'; cv.style.left=(ir.left-wr.left)+'px'; cv.style.top=(ir.top-wr.top)+'px'; cv.style.width=ir.width+'px'; cv.style.height=ir.height+'px';
  const dpr=window.devicePixelRatio||1; cv.width=ir.width*dpr; cv.height=ir.height*dpr; const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  const r=wmsRegion(), P=gProj(r,ir.width,ir.height);
  const line=(mesh,color,w)=>{ if(!mesh) return; c.strokeStyle=color; c.lineWidth=w; c.beginPath(); mesh.coordinates.forEach(l=>l.forEach(([lo,la],k)=>{const x=P.x(lo),y=P.y(la); k?c.lineTo(x,y):c.moveTo(x,y);})); c.stroke(); };
  line(GEO&&GEO.countries,'rgba(255,255,255,.85)',1.3); line(GEO&&GEO.states,'rgba(255,255,255,.55)',0.7);
  const L=getLoc(); if(L){c.fillStyle='#fff'; c.strokeStyle='#000'; c.lineWidth=2; c.beginPath(); c.arc(P.x(L.lon),P.y(L.lat),4,0,7); c.fill(); c.stroke();}
}
$('mvImg').addEventListener('load',()=>{ if(MODELS[MV.model].kind==='geomet') loadGeo().then(drawWmsOverlay); else $('mvOverlay').style.display='none'; });
window.addEventListener('resize',()=>{clearTimeout(window._wr); window._wr=setTimeout(drawWmsOverlay,200);});

function renderModelBar(){
  const ORDER=['Global','ECMWF','Canada (CMC)','Google AI','Mesoscale (CONUS)','Blends & Winter','More global','Data maps (drawn here)','Interactive (Windy)'];
  const groups={}; ORDER.forEach(g=>groups[g]=[]); Object.entries(MODELS).forEach(([k,v])=>(groups[v.group]=groups[v.group]||[]).push([k,v]));
  $('modelBar').innerHTML=Object.entries(groups).filter(([,l])=>l.length).map(([g,list])=>`<div class="mgroup"><span>${g}</span>`+
    list.map(([k,v])=>`<button class="chip ${k===MV.model?'on':''}" data-model="${k}" title="${v.desc}">${v.name}</button>`).join('')+'</div>').join('')+
    `<div class="mgroup"><span>Long range</span><button class="chip" data-goto="longrange">EC46 · SEAS5 · NMME · CFSv2 ❄</button></div>`;
  $('modelBar').querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>selectModel(b.dataset.model));
}
function renderModelSide(){
  const m=MODELS[MV.model], q=$('paramFilter').value.trim().toLowerCase(); let h='';
  const hasP = !!m.params && m.kind!=='grid';
  const cats = hasP ? m.params : m.kind==='grid' ? GRID_VARS : {'Map layers':WINDY_LAYERS};
  const cur = hasP ? MV.param : m.kind==='grid' ? G.var : MV.windyLayer, attr = hasP ? 'data-param' : m.kind==='grid' ? 'data-gvar' : 'data-wlayer';
  for(const cat in cats){
    const items=Object.entries(cats[cat]).filter(([p,l])=>!q||l.toLowerCase().includes(q)||p.toLowerCase().includes(q)||cat.toLowerCase().includes(q));
    if(!items.length) continue;
    h+=`<details class="cat" open><summary>${cat}</summary>`+items.map(([p,l])=>`<button class="item ${p===cur?'active':''}" ${attr}="${p}">${l}</button>`).join('')+'</details>';
  }
  $('modelSide').innerHTML=h||'<p class="small muted" style="padding:6px">No maps match that filter.</p>';
  $('modelSide').querySelectorAll('[data-param]').forEach(b=>b.onclick=()=>{MV.param=b.dataset.param; MV.paramFor[MV.model]=MV.param; renderModelSide(); if(MODELS[MV.model].kind==='geomet'){mvLoop.stop(); showGeometLayer();} else updateModel();});
  $('modelSide').querySelectorAll('[data-gvar]').forEach(b=>b.onclick=()=>{G.var=b.dataset.gvar; renderModelSide(); loadGrid();});
  $('modelSide').querySelectorAll('[data-wlayer]').forEach(b=>b.onclick=()=>{MV.windyLayer=b.dataset.wlayer; renderModelSide(); updateModel();});
}
$('paramFilter').oninput=renderModelSide;
$('extLinks').innerHTML=EXTERNAL_MODELS.map(([n,u])=>`<a class="item small" href="${u}" target="_blank" rel="noopener">${n}</a>`).join('');

function selectModel(k){
  mvLoop.stop(); MV.model=k; const m=MODELS[k];
  if(m.kind==='mag' || m.kind==='ecmwf'){
    const all=Object.assign({},...Object.values(m.params));
    MV.param = MV.paramFor[k] || (all[MV.param] ? MV.param : (m.defaultParam || Object.keys(all).find(p=>p==='500_vort_ht')||Object.keys(all)[0]));
    if(!m.areas[MV.area]) MV.area=Object.keys(m.areas)[0];
    $('mvArea').innerHTML=Object.entries(m.areas).map(([a,n])=>`<option value="${a}" ${a===MV.area?'selected':''}>${n}</option>`).join('');
    fillCycles($('mvCycle'), m.cycles, m.latency);
    $('mvCycle').parentElement.style.display=''; $('mvArea').parentElement.style.display=Object.keys(m.areas).length>1?'':'none';
  }
  if(m.kind==='geomet'){
    const regs=gridRegions(); if(!regs[MV.area]) MV.area=getLoc()?'me':'conus';
    $('mvArea').innerHTML=Object.entries(regs).map(([a,r])=>`<option value="${a}" ${a===MV.area?'selected':''}>${r.name}</option>`).join('');
    $('mvArea').parentElement.style.display=''; $('mvCycle').parentElement.style.display='none';
  }
  renderModelBar(); renderModelSide(); updateModel(); store.set('wx.model',k);
}
const GEOMET_PREF=[/PrecipType/i,/Precip.*Accum|PR$|_PR\b/i,/AirTemp|_TT\b/i,/MSL|_PN\b/i];
async function startGeomet(m){
  $('mvTitle').textContent=`CMC ${m.name} · loading layer list…`; $('mvWrap').classList.remove('err');
  const ok=await geometDiscover(m); if(MODELS[MV.model]!==m) return;
  if(!ok){ $('mvTitle').textContent=`CMC ${m.name}`; $('mvWrap').classList.add('err'); $('mvErr').textContent="Couldn't load Environment Canada's map list from this page right now.";
    $('mvSrc').href='https://weather.gc.ca/model_forecast/index_e.html'; $('mvSrc').textContent='Environment Canada model charts ↗'; return; }
  if(!m.layers[MV.paramFor[MV.model]]){ const names=Object.keys(m.layers); MV.paramFor[MV.model]=GEOMET_PREF.map(re=>names.find(n=>re.test(n))).find(Boolean)||names[0]; }
  MV.param=MV.paramFor[MV.model]; renderModelSide(); showGeometLayer();
}
function showGeometLayer(){ const m=MODELS[MV.model], L=m.layers[MV.param]; if(!L) return;
  $('mvTitle').textContent=`CMC ${m.name} · ${L.title.replace(/^(GDPS|RDPS|HRDPS|GEPS)[^-–]*[-–]\s*/,'')}`;
  $('mvLegend').innerHTML=`<img alt="Legend" src="${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&SLD_VERSION=1.1.0&LAYER=${encodeURIComponent(MV.param)}&FORMAT=image/png&LANG=en" onerror="this.remove()">`;
  mvLoop.idx=0; mvLoop.setHours(L.hours); }
function updateModel(){
  const m=MODELS[MV.model], wrap=$('mvWrap'), isMag=m.kind==='mag', isGrid=m.kind==='grid';
  const isImg=['mag','ecmwf','geomet'].includes(m.kind);
  $('mvTimebar').style.display=isImg?'':'none'; $('mvSelects').style.display=isImg?'':'none'; $('mvLegend').innerHTML=''; $('mvOverlay').style.display='none';
  $('gridBox').style.display=isGrid?'':'none'; wrap.style.display=isGrid?'none':''; if(!isGrid) gStop();
  const old=wrap.querySelector('iframe'); if(old)old.remove();
  $('mvDesc').textContent = m.desc + (isMag ? ` · runs ${m.cycles.length===24?'hourly':m.cycles.map(c=>pad2(c)+'Z').join(' ')}` : isGrid ? ' · map viewer' : ' · interactive map');
  if(isGrid){ mvLoop.stop(); $('mvValid').innerHTML=''; loadGrid(); return; }
  if(m.kind==='geomet'){ const old=wrap.querySelector('iframe'); if(old)old.remove(); $('mvImg').style.display=''; $('mvDesc').textContent=m.desc;
    if(m.layers && m.layers[MV.param]) showGeometLayer(); else startGeomet(m); return; }
  if(m.kind==='ecmwf'){ $('mvImg').style.display=''; const all=Object.assign({},...Object.values(m.params));
    $('mvTitle').textContent=`ECMWF · ${all[MV.param]}`; $('mvDesc').textContent=m.desc+' · © ECMWF, CC BY 4.0'; mvLoop.setHours(m.hours()); return; }
  if(isMag){
    $('mvImg').style.display=''; const all=Object.assign({},...Object.values(m.params));
    $('mvTitle').textContent=`${m.name} · ${all[MV.param]}`;
    mvLoop.setHours(m.hours(+$('mvCycle').value));
  } else {
    $('mvImg').style.display='none'; wrap.classList.remove('err');
    const loc=getLoc(); const lat=loc?loc.lat.toFixed(2):39, lon=loc?loc.lon.toFixed(2):-95;
    $('mvTitle').textContent=`${m.name} · ${WINDY_LAYERS[MV.windyLayer]}`;
    $('mvValid').innerHTML='Use the timeline at the bottom of the map to step through the forecast.';
    const f=document.createElement('iframe');
    f.src=`https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=%C2%B0F&metricWind=mph&zoom=${loc?6:4}&overlay=${MV.windyLayer}&product=${m.product}&level=surface&lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&marker=${loc?'true':''}`;
    f.allowFullscreen=true; wrap.appendChild(f);
  }
}
$('mvArea').onchange=()=>{MV.area=$('mvArea').value; if(MODELS[MV.model].kind==='geomet') mvLoop.go(mvLoop.idx); else updateModel();};
$('mvCycle').onchange=()=>updateModel();
$('mvPrev').onclick=()=>{mvLoop.stop();mvLoop.prev();}; $('mvNext').onclick=()=>{mvLoop.stop();mvLoop.next();}; $('mvPlay').onclick=()=>mvLoop.play();


/* =========================================================
   4c) GRID MAP VIEWER — draws model maps in the browser from
   Open-Meteo point data. Covers ECMWF, CMC, Google & more.
   ========================================================= */
const GRID_VARS = {
  'Precip & Snow':{kuch:'Total snowfall (Kuchera)',stot:'Total snowfall (model)',s6:'6-hr snowfall',ptot:'Total precipitation',p6:'6-hr precipitation'},
  'Surface':{t2m:'2 m temperature',mslp:'Sea-level pressure',gust:'Wind gusts',dew:'Dew point'},
  'Upper air':{t850:'850 mb temperature',z500:'500 mb height'}
};
const GV = {
  t2m:{om:'temperature_2m',unit:'°F',pal:'temp'}, dew:{om:'dew_point_2m',unit:'°F',pal:'temp'}, t850:{om:'temperature_850hPa',unit:'°F',pal:'temp850'},
  mslp:{om:'pressure_msl',unit:' mb',pal:'mslp'}, gust:{om:'wind_gusts_10m',unit:' mph',pal:'wind'}, z500:{om:'geopotential_height_500hPa',unit:' dam',pal:'z500',scale:0.1},
  p6:{om:'precipitation',unit:'"',pal:'precip',acc:'win'}, ptot:{om:'precipitation',unit:'"',pal:'precip',acc:'tot'},
  s6:{om:'snowfall',unit:'"',pal:'snow',acc:'win'},
  kuch:{om:'snowfall,temperature_2m,temperature_925hPa,temperature_850hPa,temperature_700hPa',unit:'"',pal:'snow',acc:'tot',multi:true}, stot:{om:'snowfall',unit:'"',pal:'snow',acc:'tot'}
};
const PAL = {
  temp:[[-30,'#f0abfc'],[-10,'#7c3aed'],[0,'#4338ca'],[15,'#2563eb'],[28,'#38bdf8'],[32,'#e0f2fe'],[33,'#a7f3d0'],[45,'#22c55e'],[60,'#facc15'],[75,'#f97316'],[90,'#dc2626'],[105,'#7f1d1d']],
  temp850:[[-40,'#f0abfc'],[-20,'#7c3aed'],[0,'#2563eb'],[25,'#38bdf8'],[32,'#e0f2fe'],[33,'#a7f3d0'],[45,'#22c55e'],[60,'#facc15'],[75,'#dc2626']],
  mslp:[[970,'#581c87'],[985,'#2563eb'],[1000,'#38bdf8'],[1012,'#e5e7eb'],[1024,'#fbbf24'],[1036,'#ea580c'],[1050,'#7f1d1d']],
  wind:[[0,'#1e293b'],[15,'#0ea5e9'],[30,'#22c55e'],[45,'#facc15'],[60,'#f97316'],[75,'#dc2626'],[95,'#a21caf']],
  z500:[[504,'#7c3aed'],[522,'#2563eb'],[540,'#38bdf8'],[555,'#22c55e'],[570,'#facc15'],[582,'#f97316'],[594,'#b91c1c']],
  precip:[[0.01,'#bbf7d0'],[0.1,'#4ade80'],[0.25,'#16a34a'],[0.5,'#facc15'],[1,'#f97316'],[2,'#dc2626'],[4,'#c026d3']],
  snow:[[0.1,'#dbeafe'],[1,'#93c5fd'],[3,'#3b82f6'],[6,'#1d4ed8'],[12,'#7c3aed'],[18,'#c026d3'],[30,'#fbcfe8']]
};
const hex2rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
function palColor(name,v){ if(v==null||isNaN(v)) return null; const st=PAL[name];
  if((name==='precip'||name==='snow') && v<st[0][0]) return null;
  if(v<=st[0][0]) return hex2rgb(st[0][1]); if(v>=st[st.length-1][0]) return hex2rgb(st[st.length-1][1]);
  for(let i=1;i<st.length;i++) if(v<=st[i][0]){const [a,ca]=st[i-1],[b,cb]=st[i],f=(v-a)/(b-a),A=hex2rgb(ca),B=hex2rgb(cb); return A.map((x,k)=>Math.round(x+(B[k]-x)*f));} }
function gridRegions(){ const r={conus:{name:'CONUS',lat0:24,lat1:50,lon0:-126,lon1:-66,dlat:2.5,dlon:3},
  ne:{name:'Northeast & Great Lakes',lat0:36,lat1:48,lon0:-92,lon1:-66,dlat:1.25,dlon:1.5},
  mw:{name:'Midwest & Plains',lat0:34,lat1:49,lon0:-104,lon1:-82,dlat:1.25,dlon:1.5},
  se:{name:'South & Southeast',lat0:24,lat1:38,lon0:-100,lon1:-75,dlat:1.25,dlon:1.75},
  w:{name:'West',lat0:31,lat1:49,lon0:-125,lon1:-102,dlat:1.5,dlon:1.75},
  na:{name:'North America',lat0:15,lat1:70,lon0:-170,lon1:-50,dlat:5,dlon:6}};
  const L=getLoc(); if(L) r.me={name:`Around ${L.name}`,lat0:+(L.lat-6).toFixed(2),lat1:+(L.lat+6).toFixed(2),lon0:+(L.lon-8).toFixed(2),lon1:+(L.lon+8).toFixed(2),dlat:1,dlon:1.25};
  return r; }
const G={var:'kuch', region: getLoc()?'me':'conus', data:null, frames:[], idx:0, timer:null};
const gridCache={};
async function gridFetch(m, reg, v){
  const key=`${m.om}|${JSON.stringify(reg)}|${GV[v].om}`; if(gridCache[key]) return gridCache[key];
  const lats=[],lons=[]; let nLat=0,nLon=0;
  for(let la=reg.lat0; la<=reg.lat1+1e-6; la+=reg.dlat){nLat++; nLon=0; for(let lo=reg.lon0; lo<=reg.lon1+1e-6; lo+=reg.dlon){nLon++; lats.push(la.toFixed(2)); lons.push(lo.toFixed(2));}}
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&hourly=${GV[v].om}&models=${m.om}&forecast_days=${m.days}&timezone=GMT&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph`;
  const r=await fetch(u); const j=await r.json().catch(()=>null);
  if(!r.ok||!j) throw new Error((j&&j.reason)||'Model data unavailable right now.');
  const arr=Array.isArray(j)?j:[j]; const times=arr[0].hourly.time;
  const vals=arr.map(x=>{ const Hh=x.hourly;
    if(GV[v].multi) return Hh.time.map((_,i)=>Hh.snowfall?.[i]==null?null:(Hh.snowfall[i]/7)*kuchRatio([Hh.temperature_2m?.[i],Hh.temperature_925hPa?.[i],Hh.temperature_850hPa?.[i],Hh.temperature_700hPa?.[i]]));
    return (Hh[GV[v].om]||[]).map(y=>y==null?null:y*(GV[v].scale||1)); });
  const out={nLat,nLon,times,vals,reg}; gridCache[key]=out; return out;
}
function gridField(D, i, v, step){
  const acc=GV[v].acc;
  return D.vals.map(a=>{ if(!acc) return a[i];
    let s=0, any=false; const from = acc==='tot'?1:Math.max(1,i-step+1);
    for(let k=from;k<=i;k++){ if(a[k]!=null){s+=a[k]; any=true;} } return any?s:null; });
}
let GEO=null;
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);});}
async function loadGeo(){ if(GEO) return GEO;
  try{ if(!window.topojson) await loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
    const [us,w]=await Promise.all([fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(r=>r.json()), fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json').then(r=>r.json())]);
    GEO={states:topojson.mesh(us,us.objects.states,(a,b)=>a!==b), countries:topojson.mesh(w,w.objects.countries)};
  }catch(e){ GEO={}; } return GEO; }
function gProj(reg,W,H){return {x:lon=>(lon-reg.lon0)/(reg.lon1-reg.lon0)*W, y:lat=>(reg.lat1-lat)/(reg.lat1-reg.lat0)*H};}
function gSample(D,field,lat,lon){
  const reg=D.reg, gi=(lat-reg.lat0)/reg.dlat, gj=(lon-reg.lon0)/reg.dlon;
  if(gi<0||gj<0||gi>D.nLat-1||gj>D.nLon-1) return null;
  const i0=Math.min(Math.floor(gi),D.nLat-2), j0=Math.min(Math.floor(gj),D.nLon-2), fi=gi-i0, fj=gj-j0;
  const at=(i,j)=>field[i*D.nLon+j]; const q=[at(i0,j0),at(i0,j0+1),at(i0+1,j0),at(i0+1,j0+1)];
  if(q.some(x=>x==null)) { const n=q.filter(x=>x!=null); return n.length?mean(n):null; }
  return q[0]*(1-fi)*(1-fj)+q[1]*(1-fi)*fj+q[2]*fi*(1-fj)+q[3]*fi*fj;
}
function drawGrid(){
  const D=G.data; if(!D||!G.frames.length) return; const cv=$('gCanvas'), reg=D.reg, m=MODELS[MV.model];
  const W=cv.parentElement.clientWidth, mid=(reg.lat0+reg.lat1)/2*Math.PI/180;
  let H=Math.round(W*(reg.lat1-reg.lat0)/((reg.lon1-reg.lon0)*Math.cos(mid))); H=Math.min(H, Math.round(innerHeight*0.72));
  const dpr=window.devicePixelRatio||1; cv.width=W*dpr; cv.height=H*dpr; cv.style.height=H+'px';
  const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  const i=G.frames[G.idx], field=gridField(D,i,G.var,m.step); G.field=field;
  c.fillStyle='#0c1424'; c.fillRect(0,0,W,H);
  const B=3, pal=GV[G.var].pal;
  for(let py=0;py<H;py+=B) for(let px=0;px<W;px+=B){
    const lat=reg.lat1-(py+B/2)/H*(reg.lat1-reg.lat0), lon=reg.lon0+(px+B/2)/W*(reg.lon1-reg.lon0);
    const col=palColor(pal,gSample(D,field,lat,lon)); if(col){c.fillStyle=`rgb(${col})`; c.fillRect(px,py,B,B);} }
  const P=gProj(reg,W,H);
  const line=(mesh,color,w)=>{ if(!mesh) return; c.strokeStyle=color; c.lineWidth=w; c.beginPath();
    mesh.coordinates.forEach(l=>l.forEach(([lo,la],k)=>{const x=P.x(lo),y=P.y(la); k?c.lineTo(x,y):c.moveTo(x,y);})); c.stroke(); };
  line(GEO&&GEO.countries,'rgba(15,23,42,.95)',1.6); line(GEO&&GEO.states,'rgba(15,23,42,.75)',0.8);
  const L=getLoc(); if(L){const x=P.x(L.lon),y=P.y(L.lat); c.fillStyle='#fff'; c.strokeStyle='#000'; c.lineWidth=2; c.beginPath(); c.arc(x,y,4,0,7); c.fill(); c.stroke();}
  if($('gNums').checked){ c.font='bold 10px Segoe UI, sans-serif'; c.textAlign='center';
    for(let a=0;a<D.nLat;a++) for(let b=0;b<D.nLon;b++){ const v=field[a*D.nLon+b]; if(v==null) continue;
      const x=P.x(reg.lon0+b*reg.dlon), y=P.y(reg.lat0+a*reg.dlat); const t=GV[G.var].acc? (v<0.05?'':v.toFixed(v<10?1:0)) : Math.round(v);
      if(t===''||x<8||x>W-8||y<8||y>H-4) continue; c.lineWidth=3; c.strokeStyle='rgba(0,0,0,.75)'; c.strokeText(t,x,y+3); c.fillStyle='#fff'; c.fillText(t,x,y+3);} c.textAlign='start'; }
  const t=new Date(D.times[i]+'Z'), hrs=Math.round((t-Date.now())/3600e3);
  $('gValid').innerHTML=`<b>${m.name}</b> · ${GRID_VARS_FLAT[G.var]} · Valid <b>${fmtZ(t)}</b> · ${fmtLocal(t)} your time · ${hrs>=0?'+':''}${hrs} h from now${GV[G.var].acc==='tot'?' · total since start of run window':''}`;
  [...$('gHours').querySelectorAll('.daychips button')].forEach(b=>b.classList.toggle('on',+b.dataset.i===G.idx));
  const rg=$('gHours').querySelector('input'); if(rg){rg.value=G.idx; $('gHours').querySelector('.fh').textContent=`${MON[t.getMonth()]} ${t.getDate()} ${pad2(t.getUTCHours())}Z`;}
}
const GRID_VARS_FLAT=Object.assign({},...Object.values(GRID_VARS));
function gLegend(){ const st=PAL[GV[G.var].pal];
  $('gBar').innerHTML=`<div class="cbar-g" style="background:linear-gradient(90deg,${st.map(([v,c],k)=>`${c} ${k/(st.length-1)*100}%`).join(',')})"></div><div class="cbar-l">${st.map(([v])=>`<span>${v}${GV[G.var].unit}</span>`).join('')}</div>`; }
async function loadGrid(){
  const m=MODELS[MV.model]; if(m.kind!=='grid') return; gStop();
  const regs=gridRegions(); if(!regs[G.region]) G.region='conus';
  $('gRegion').innerHTML=Object.entries(regs).map(([k,r])=>`<option value="${k}" ${k===G.region?'selected':''}>${r.name}</option>`).join('');
  $('mvTitle').textContent=`${m.name} · ${GRID_VARS_FLAT[G.var]}`; gLegend();
  $('gStatus').innerHTML='<span class="spinner"></span> loading model grid…';
  try{
    const [D]=await Promise.all([gridFetch(m, regs[G.region], G.var), loadGeo()]);
    if(MODELS[MV.model]!==m) return;
    const step=m.step, frames=[]; let last=D.times.length-1;
    while(last>0 && D.vals.slice(0,20).every(a=>a[last]==null)) last--;
    for(let i=(GV[G.var].acc?step:0); i<=last; i+=step) frames.push(i);
    if(!frames.length || last<=0){ G.data=null; $('gStatus').textContent=`${m.name} doesn't provide ${GRID_VARS_FLAT[G.var].toLowerCase()}. Try another map.`; $('gCanvas').getContext('2d').clearRect(0,0,9999,9999); return; }
    G.data=D; G.frames=frames;
    const now=Date.now(); G.idx=GV[G.var].acc==='tot'?frames.length-1:Math.max(0,frames.findIndex(i=>new Date(D.times[i]+'Z')>=now));
    // timeline
    let chips=''; let lastDay='';
    frames.forEach((i,k)=>{const t=new Date(D.times[i]+'Z'); const d=`${MON[t.getMonth()]} ${t.getDate()}`; if(d!==lastDay){lastDay=d; chips+=`<button data-i="${k}">${DOW[t.getDay()]} ${t.getDate()}</button>`;}});
    $('gHours').innerHTML=`<div class="slider"><input type="range" min="0" max="${frames.length-1}" value="${G.idx}" aria-label="Forecast time"><span class="fh"></span></div><div class="daychips">${chips}</div>`;
    $('gHours').querySelector('input').oninput=e=>{gStop(); G.idx=+e.target.value; drawGrid();};
    $('gHours').querySelectorAll('.daychips button').forEach(b=>b.onclick=()=>{gStop(); G.idx=+b.dataset.i; drawGrid();});
    $('gStatus').textContent=`${D.vals.length} grid points · ${m.om}`;
    drawGrid();
  }catch(e){ $('gStatus').textContent=e.message; }
}
function gStop(){clearInterval(G.timer); G.timer=null; $('gPlay').textContent='▶ Play';}
$('gPlay').onclick=()=>{ if(G.timer) return gStop(); $('gPlay').textContent='❚❚ Pause'; G.timer=setInterval(()=>{G.idx=(G.idx+1)%G.frames.length; drawGrid();},+$('gSpeed').value); };
$('gPrev').onclick=()=>{gStop(); G.idx=(G.idx-1+G.frames.length)%G.frames.length; drawGrid();};
$('gNext').onclick=()=>{gStop(); G.idx=(G.idx+1)%G.frames.length; drawGrid();};
$('gRegion').onchange=()=>{G.region=$('gRegion').value; loadGrid();};
$('gNums').onchange=drawGrid;
$('gCanvas').addEventListener('mousemove',e=>{ const D=G.data; if(!D||!G.field) return; const cv=$('gCanvas'), r=cv.getBoundingClientRect(), reg=D.reg;
  const lon=reg.lon0+(e.clientX-r.left)/r.width*(reg.lon1-reg.lon0), lat=reg.lat1-(e.clientY-r.top)/r.height*(reg.lat1-reg.lat0); const v=gSample(D,G.field,lat,lon);
  const tip=$('gTip'); if(v==null){tip.style.display='none';return;} tip.style.display='block'; tip.style.left=(e.clientX-r.left+12)+'px'; tip.style.top=(e.clientY-r.top+12)+'px';
  tip.textContent=`${GV[G.var].acc?v.toFixed(2):Math.round(v)}${GV[G.var].unit} · ${lat.toFixed(1)}, ${lon.toFixed(1)}`;});
$('gCanvas').addEventListener('mouseleave',()=>$('gTip').style.display='none');
window.addEventListener('resize',()=>{clearTimeout(window._gr); window._gr=setTimeout(()=>{if(MODELS[MV.model]&&MODELS[MV.model].kind==='grid')drawGrid();},200);});

/* =========================================================
   4b) LONG RANGE TAB (winter: weeks 3-6, months 1-7)
   ========================================================= */
const CPC='https://www.cpc.ncep.noaa.gov/products';
const NMME_MODELS={NMME:'NMME mean (all models)',prob:'NMME probability',CFSv2:'NCEP CFSv2',CanESM5:'Canada CanESM5','GEM5.2_NEMO':'Canada GEM5.2-NEMO',NCAR_CESM1:'NCAR CESM1',NCAR_CCSM4:'NCAR CCSM4',NASA_GEOS5v2:'NASA GEOS-S2S'};
const LR={view:'ec46', nm:'NMME', nv:'tmp2m', lead:2};
const LR_VIEWS=[
  ['Your location · ECMWF 51 members',[['ec46','EC46 weekly','6 weeks: temps, snow odds'],['seas5','SEAS5 monthly','6 months: temps, snow odds']]],
  ['Multi-model seasonal',[['nmme','NMME + 6 models','Monthly temp/precip, 7 months']]],
  ['NOAA CFSv2',[['cfs','CFSv2 next month','Temp/precip + probabilities']]],
  ['Official CPC',[['cpc','CPC outlooks','6–10, 8–14, Wk 3–4, monthly, seasonal'],['cpc13','All seasonal outlooks','13 overlapping seasons']]],
  ['Winter drivers',[['drivers','AO · NAO · PNA · MJO','Pattern forecasts that steer cold & storms']]]
];
function addMonths(n){const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+n); return d;}
const monLabel=d=>`${MON[d.getMonth()]} ${d.getFullYear()}`;
function renderLrSide(){
  $('lrSide').innerHTML=LR_VIEWS.map(([g,items])=>`<h4>${g}</h4>`+items.map(([id,n,d])=>`<button class="item ${id===LR.view?'active':''}" data-lr="${id}">${n} <small>${d}</small></button>`).join('')).join('')+
   `<h4>More long range ↗</h4><a class="item small" href="https://charts.ecmwf.int/?query=extended" target="_blank" rel="noopener">ECMWF extended-range charts</a><a class="item small" href="https://www.tropicaltidbits.com/analysis/models/?model=cfs-avg" target="_blank" rel="noopener">CFS on Tropical Tidbits</a><a class="item small" href="https://www.cpc.ncep.noaa.gov/products/people/wwang/cfsv2fcst/" target="_blank" rel="noopener">CFSv2 seasonal (CPC)</a><a class="item small" href="https://iri.columbia.edu/our-expertise/climate/forecasts/enso/current/" target="_blank" rel="noopener">IRI ENSO forecast</a><a class="item small" href="https://www.cpc.ncep.noaa.gov/products/stratosphere/" target="_blank" rel="noopener">Stratosphere / polar vortex</a>`;
  $('lrSide').querySelectorAll('[data-lr]').forEach(b=>b.onclick=()=>{LR.view=b.dataset.lr; renderLrSide(); renderLr();});
}
function renderLr(){
  const M=$('lrMain'), v=LR.view;
  if(v==='nmme'){
    const url = LR.nm==='prob' ? `${CPC}/NMME/prob/images/prob_ensemble_${LR.nv}_us_lead${LR.lead}.png` : `${CPC}/NMME/current/images/${LR.nm}_ensemble_${LR.nv}_us_lead${LR.lead}.png`;
    const base=new Date().getDate()>=9?0:-1;
    M.innerHTML=`<div class="viewer-head"><div><div class="viewer-title">NMME · ${NMME_MODELS[LR.nm]} · ${LR.nv==='tmp2m'?'Temperature':'Precipitation'} · ≈ ${monLabel(addMonths(base+LR.lead-1))}</div><div class="small muted">Monthly anomaly vs. normal. Issued around the 8th of each month.</div></div>
      <div class="seg" id="nmVar"><button data-v="tmp2m" class="${LR.nv==='tmp2m'?'on':''}">Temp</button><button data-v="prate" class="${LR.nv==='prate'?'on':''}">Precip</button></div></div>
      <div class="row" style="margin-bottom:8px">${Object.entries(NMME_MODELS).map(([k,n])=>`<button class="chip ${k===LR.nm?'on':''}" data-nm="${k}">${n}</button>`).join('')}</div>
      <div class="imgwrap" id="lrWrap"><img id="lrImg" src="${url}" alt="NMME map"><div class="imgmsg"><div>Map unavailable.</div><a href="${CPC}/NMME/monanom.shtml" target="_blank" rel="noopener">NMME page ↗</a></div></div>
      <div class="timebar"><span class="small muted">Lead</span><div class="hours" style="margin:0">${[1,2,3,4,5,6,7].map(l=>`<button data-lead="${l}" class="${l===LR.lead?'active':''}" style="min-width:70px">${MON[addMonths(base+l-1).getMonth()]} (${l})</button>`).join('')}</div></div>`;
    $('lrImg').onerror=()=>$('lrWrap').classList.add('err');
    M.querySelectorAll('[data-nm]').forEach(b=>b.onclick=()=>{LR.nm=b.dataset.nm; renderLr();});
    M.querySelectorAll('[data-lead]').forEach(b=>b.onclick=()=>{LR.lead=+b.dataset.lead; renderLr();});
    M.querySelectorAll('#nmVar button').forEach(b=>b.onclick=()=>{LR.nv=b.dataset.v; renderLr();});
    return;
  }
  if(v==='cfs'){ const ym=(d=>`${d.getFullYear()}${pad2(d.getMonth()+1)}`)(addMonths(1)), b=`${CPC}/CFSv2/monthly/images/summaryCFSv2.`;
    M.innerHTML=`<h3 style="margin:0 0 4px">CFSv2 · ${monLabel(addMonths(1))}</h3><p class="small muted">Average of the latest 3 days of CFSv2 runs.</p><div class="grid g2 gal" id="lrGal"></div>`;
    return gallery($('lrGal'),[['Temperature anomaly',`${b}NaT2m.${ym}.gif`,`${CPC}/CFSv2/monthly/`],['Temperature probability',`${b}NaT2mProb.${ym}.gif`,`${CPC}/CFSv2/monthly/`],['Precipitation anomaly',`${b}NaPrec.${ym}.gif`,`${CPC}/CFSv2/monthly/`],['Precipitation probability',`${b}NaPrecProb.${ym}.gif`,`${CPC}/CFSv2/monthly/`]]); }
  if(v==='cpc'){ const p=`${CPC}/predictions`;
    M.innerHTML=`<h3 style="margin:0 0 8px">CPC Official Outlooks</h3><div class="grid g3 gal" id="lrGal"></div>`;
    return gallery($('lrGal'),[['6–10 Day Temp',`${p}/610day/610temp.new.gif`],['6–10 Day Precip',`${p}/610day/610prcp.new.gif`],['8–14 Day Temp',`${p}/814day/814temp.new.gif`],['8–14 Day Precip',`${p}/814day/814prcp.new.gif`],
      ['Week 3–4 Temp',`${p}/WK34/gifs/WK34temp.gif`],['Week 3–4 Precip',`${p}/WK34/gifs/WK34prcp.gif`],['Monthly Temp',`${p}/30day/off15_temp.gif`],['Monthly Precip',`${p}/30day/off15_prcp.gif`],
      ['Season 1 Temp',`${p}/long_range/lead01/off01_temp.gif`],['Season 1 Precip',`${p}/long_range/lead01/off01_prcp.gif`],['Season 2 Temp',`${p}/long_range/lead02/off02_temp.gif`],['Season 2 Precip',`${p}/long_range/lead02/off02_prcp.gif`]].map(([n,u])=>[n,u,`${p}/`])); }
  if(v==='cpc13'){ const p=`${CPC}/predictions/multi_season/13_seasonal_outlooks/color`;
    M.innerHTML=`<h3 style="margin:0 0 8px">All 13 Seasonal Outlooks</h3><div class="grid g2 gal" id="lrGal"></div>`;
    return gallery($('lrGal'),[['Temperature, all seasons',`${p}/t.gif`,`${CPC}/predictions/90day/`],['Precipitation, all seasons',`${p}/p.gif`,`${CPC}/predictions/90day/`],['Next month & next season',`${p}/page2.gif`,`${CPC}/predictions/90day/`]]); }
  if(v==='drivers'){ const c=`${CPC}/precip/CWlink`;
    M.innerHTML=`<h3 style="margin:0 0 4px">Winter Pattern Drivers</h3><p class="small muted">Negative AO/NAO plus a positive PNA often means cold air and stormier weather in the central and eastern US. The MJO phase sets the pattern 1–3 weeks out.</p><div class="grid g3 gal" id="lrGal"></div>`;
    return gallery($('lrGal'),[['Arctic Oscillation (AO), GEFS',`${c}/daily_ao_index/ao.gefs.sprd2.png`,`${c}/daily_ao_index/teleconnections.shtml`],['North Atlantic Oscillation (NAO), GEFS',`${c}/pna/nao.gefs.sprd2.png`,`${c}/daily_ao_index/teleconnections.shtml`],
      ['Pacific–North American (PNA), GEFS',`${c}/pna/pna.gefs.sprd2.png`,`${c}/daily_ao_index/teleconnections.shtml`],['Antarctic Oscillation (AAO), GEFS',`${c}/daily_ao_index/aao/aao.gefs.sprd2.png`,`${c}/daily_ao_index/teleconnections.shtml`],
      ['MJO, GEFS bias-corrected plume',`${CPC}/precip/mjo/img/GEFS_BC.png`,`${c}/MJO/mjo.shtml`],['MJO, GEFS + GFS',`${CPC}/precip/mjo/img/NGFS.png`,`${c}/MJO/mjo.shtml`],
      ['MJO, statistical models',`${CPC}/precip/mjo/img/rmm_stat.png`,`${c}/MJO/mjo.shtml`],['CFS 200 mb velocity potential',`${CPC}/people/wd52qz/mjo/chi/cfs.gif`,`${c}/MJO/mjo.shtml`],
      ['Weekly SST anomaly (ENSO)',`${CPC}/analysis_monitoring/enso_update/sstweek_c.gif`,`${CPC}/analysis_monitoring/enso_update/sst.shtml`]]); }
  // point products
  const loc=getLoc();
  if(!loc){M.innerHTML=`<div class="card"><h3>Set your location first</h3><p class="muted">Enter a ZIP on the <a href="#" data-goto="local">Local 20-Day</a> tab. EC46 and SEAS5 will then run for that spot.</p></div>`; return;}
  if(v==='ec46') return renderEC46(loc,M);
  if(v==='seas5') return renderSEAS5(loc,M);
}
const seasCache={};
async function fetchSeasonal(loc, days){
  const k=`${loc.lat},${loc.lon},${days}`; if(seasCache[k]) return seasCache[k];
  const base=`https://seasonal-api.open-meteo.com/v1/seasonal?latitude=${loc.lat}&longitude=${loc.lon}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch`;
  for(const u of (days?[base+`&forecast_days=${days}`, base]:[base])){
    try{const r=await fetch(u); if(!r.ok) continue; const j=await r.json(); if(j.daily){seasCache[k]=j; return j;}}catch(e){}
  }
  throw new Error('ECMWF seasonal data unavailable right now.');
}
/* bins: array of {label, idx:[day indices]} -> per-member stats */
function binStats(daily, bins){
  const T=members(daily,'temperature_2m_mean'), H=members(daily,'temperature_2m_max'), L=members(daily,'temperature_2m_min'), S=members(daily,'snowfall_sum'), P=members(daily,'precipitation_sum');
  return bins.map(b=>{
    const per=T.map((m,k)=>{const tv=b.idx.map(i=>m.y[i]).filter(x=>x!=null); if(tv.length<b.idx.length*.6) return null;
      const avg=(arr,i)=>{const a=b.idx.map(j=>arr&&arr.y[j]).filter(x=>x!=null); return a.length?mean(a):null;};
      const sum=arr=>arr?b.idx.reduce((s,j)=>s+(arr.y[j]||0),0):0;
      return {t:mean(tv), hi:avg(H[k]), lo:avg(L[k]), s:sum(S[k]), p:sum(P[k])};}).filter(Boolean);
    if(!per.length) return {...b, n:0};
    const pr=th=>Math.round(100*per.filter(x=>x.s>=th).length/per.length);
    return {...b, n:per.length, t:mean(per.map(x=>x.t)), t10:pct(per.map(x=>x.t),.1), t90:pct(per.map(x=>x.t),.9),
      hi:mean(per.map(x=>x.hi).filter(x=>x!=null)), lo:mean(per.map(x=>x.lo).filter(x=>x!=null)),
      s:mean(per.map(x=>x.s)), s50:pct(per.map(x=>x.s),.5), p:mean(per.map(x=>x.p)), pr1:pr(1), pr3:pr(3), pr6:pr(6), pr12:pr(12)};
  });
}
function lrCards(stats, kind){
  return `<div class="days" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">`+stats.filter(s=>s.n).map(s=>`<div class="day">
    <div class="dname">${s.label}</div><div class="ddate">${s.sub}</div>
    <div style="margin:6px 0"><span class="hi">${Math.round(s.hi)}°</span> / <span class="lo">${Math.round(s.lo)}°</span></div>
    <div class="meta">Avg temp ${Math.round(s.t)}° <span class="muted">(${Math.round(s.t10)}–${Math.round(s.t90)}°)</span><br>
    ❄️ Snow avg ${s.s.toFixed(1)}" · median ${s.s50.toFixed(1)}"<br>
    ${kind==='week'?`P(≥1") <span class="snowpct">${s.pr1}%</span> · P(≥3") <span class="snowpct">${s.pr3}%</span>`:`P(≥6") <span class="snowpct">${s.pr6}%</span> · P(≥12") <span class="snowpct">${s.pr12}%</span>`}<br>
    💧 Precip ${s.p.toFixed(2)}"</div>
    <div class="snowbar"><i style="width:${kind==='week'?s.pr1:s.pr6}%"></i></div></div>`).join('')+'</div>';
}
async function renderEC46(loc,M){
  M.innerHTML=`<div class="viewer-head"><div><div class="viewer-title">ECMWF EC46 · ${loc.name}</div><div class="small muted">51-member extended ensemble, about 46 days, grouped by week</div></div><span class="small muted" id="lrStat"><span class="spinner"></span> loading…</span></div><div id="lrBody"></div>`;
  try{
    const j=await fetchSeasonal(loc,46), t=j.daily.time; const bins=[];
    for(let w=0; w*7<t.length && w<7; w++){const idx=range(w*7, Math.min(w*7+6, t.length-1)); if(idx.length<5) break;
      const a=new Date(t[idx[0]]+'T12:00'), b=new Date(t[idx[idx.length-1]]+'T12:00');
      bins.push({label:`Week ${w+1}`, sub:`${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}`, idx});}
    const st=binStats(j.daily,bins);
    $('lrBody').innerHTML=lrCards(st,'week')+`<div class="grid g2" style="margin-top:12px"><div class="card"><h3>Daily mean temperature · all members</h3><canvas class="chart" id="lrC1" style="height:280px"></canvas></div><div class="card"><h3>Weekly snow odds</h3><canvas class="chart" id="lrC2" style="height:280px"></canvas><div class="legend"><span><i style="background:#c4b5fd;height:8px"></i>P(≥1")</span><span><i style="background:#f59e0b"></i>P(≥3")</span></div></div></div>`;
    const T=members(j.daily,'temperature_2m_mean'), x=t.map(s=>new Date(s+'T12:00').getTime());
    const avgS=x.map((_,i)=>{const a=T.map(m=>m.y[i]).filter(v=>v!=null); return a.length?mean(a):null;});
    lineChart($('lrC1'),{x,series:[...T.map(m=>({y:m.y,color:'rgba(56,189,248,.25)',w:1})),{y:avgS,color:'#f59e0b',w:3}],unit:'°',freeze:32});
    barChart($('lrC2'),{labels:st.map(s=>s.label.replace('Week ','Wk')),a:st.map(s=>s.n?s.pr1:null),b:st.map(s=>s.n?s.pr3:null),dimFrom:99,every:1});
    $('lrStat').textContent=`${T.length} members`;
  }catch(e){$('lrStat').textContent=e.message;}
}
async function renderSEAS5(loc,M){
  M.innerHTML=`<div class="viewer-head"><div><div class="viewer-title">ECMWF SEAS5 · ${loc.name}</div><div class="small muted">51-member seasonal ensemble, grouped by calendar month. Look for trends, not exact numbers.</div></div><span class="small muted" id="lrStat"><span class="spinner"></span> loading…</span></div><div id="lrBody"></div>`;
  try{
    const j=await fetchSeasonal(loc,0), t=j.daily.time, byM={};
    t.forEach((s,i)=>{(byM[s.slice(0,7)]=byM[s.slice(0,7)]||[]).push(i);});
    const bins=Object.entries(byM).filter(([,idx])=>idx.length>=7).map(([ym,idx])=>{const d=new Date(ym+'-15T12:00'); return {label:`${MON[d.getMonth()]} ${d.getFullYear()}`, sub:idx.length<28?`partial (${idx.length} days)`:'full month', idx, x:d.getTime()};});
    const st=binStats(j.daily,bins);
    $('lrBody').innerHTML=lrCards(st,'month')+`<div class="grid g2" style="margin-top:12px"><div class="card"><h3>Monthly avg temperature (10–90% range)</h3><canvas class="chart" id="lrC1" style="height:280px"></canvas></div><div class="card"><h3>Monthly snow odds</h3><canvas class="chart" id="lrC2" style="height:280px"></canvas><div class="legend"><span><i style="background:#c4b5fd;height:8px"></i>P(≥6")</span><span><i style="background:#f59e0b"></i>P(≥12")</span></div></div></div>
      <p class="small muted">These are raw model values, not differences from normal. Coarse seasonal models usually come in low on snow totals, so compare months to each other rather than reading the inches literally.</p>`;
    const ok=st.filter(s=>s.n);
    lineChart($('lrC1'),{x:ok.map(s=>s.x),series:[{y:ok.map(s=>s.t),color:'#f59e0b',w:3,dots:true},{y:ok.map(s=>s.hi),color:'#f87171',w:1.5,dash:[4,3]},{y:ok.map(s=>s.lo),color:'#60a5fa',w:1.5,dash:[4,3]}],band:ok.map(s=>[s.t10,s.t90]),bandColor:'rgba(245,158,11,.18)',unit:'°',freeze:32,monthly:true});
    barChart($('lrC2'),{labels:ok.map(s=>s.label.split(' ')[0]),a:ok.map(s=>s.pr6),b:ok.map(s=>s.pr12),dimFrom:99,every:1});
    $('lrStat').textContent=`${members(j.daily,'temperature_2m_mean').length} members · ${ok.length} months`;
  }catch(e){$('lrStat').textContent=e.message;}
}
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
  const act=document.querySelector('.tab.active').id;
  if(act==='tab-models' && MODELS[MV.model].kind==='grid' && G.frames.length){ if(e.key==='ArrowRight'){$('gNext').click();e.preventDefault();} if(e.key==='ArrowLeft'){$('gPrev').click();e.preventDefault();} if(e.key===' '){$('gPlay').click();e.preventDefault();} return; }
  const L = act==='tab-models'?mvLoop: act==='tab-ensembles'?evLoop: act==='tab-spaghetti'?spLoop:null; if(!L)return;
  if(e.key==='ArrowRight'){L.stop();L.next();e.preventDefault();} if(e.key==='ArrowLeft'){L.stop();L.prev();e.preventDefault();}
  if(e.key===' '){L.play();e.preventDefault();}
});

/* =========================================================
   5) ENSEMBLES TAB
   ========================================================= */
const EV={model:'gefsmean', param:'500_vort_ht', area:'namer'};
const evLoop = new Looper({img:$('evImg'), wrap:$('evWrap'), hoursEl:$('evHours'), playBtn:$('evPlay'),
  url:fh=>magUrl(ENS_MODELS[EV.model].dir, +$('evCycle').value, EV.area, EV.param, fh),
  onChange:fh=>$('evValid').innerHTML=validText(+$('evCycle').value, ENS_MODELS[EV.model].latency, fh)});
function renderEnsSide(){
  const m=ENS_MODELS[EV.model]; let h='<h4>Ensemble Systems</h4>';
  for(const k in ENS_MODELS) h+=`<button class="item ${k===EV.model?'active':''}" data-ens="${k}">${ENS_MODELS[k].name} <small>${ENS_MODELS[k].desc}</small></button>`;
  for(const cat in m.params){ h+=`<h4>${cat}</h4>`; for(const p in m.params[cat]) h+=`<button class="item ${p===EV.param?'active':''}" data-param="${p}">${m.params[cat][p]}</button>`; }
  h+=`<h4>Other ensembles</h4><button class="item" data-goto="spaghetti">GEFS Spaghetti Maps</button><button class="item" data-goto="spaghetti">Point Plumes: ECMWF / GEFS / GEM / ICON</button><a class="item" href="https://charts.ecmwf.int/" target="_blank" rel="noopener">ECMWF ENS charts ↗</a><a class="item" href="https://weather.gc.ca/ensemble/index_e.html" target="_blank" rel="noopener">Canadian NAEFS / GEPS ↗</a>`;
  $('ensSide').innerHTML=h;
  $('ensSide').querySelectorAll('[data-param]').forEach(b=>b.onclick=()=>{EV.param=b.dataset.param;renderEnsSide();updateEns();});
  $('ensSide').querySelectorAll('[data-ens]').forEach(b=>b.onclick=()=>{evLoop.stop(); EV.model=b.dataset.ens; const mm=ENS_MODELS[EV.model];
    const all=Object.assign({},...Object.values(mm.params)); if(!all[EV.param]) EV.param=Object.keys(all)[0];
    EV.area=Object.keys(mm.areas)[0]; initEns();});
}
function updateEns(){const m=ENS_MODELS[EV.model]; const all=Object.assign({},...Object.values(m.params));
  $('evTitle').textContent=`${m.name} — ${all[EV.param]}`; evLoop.setHours(m.hours());}
function initEns(){const m=ENS_MODELS[EV.model];
  $('evArea').innerHTML=Object.entries(m.areas).map(([a,n])=>`<option value="${a}" ${a===EV.area?'selected':''}>${n}</option>`).join('');
  fillCycles($('evCycle'), m.cycles, m.latency); renderEnsSide(); updateEns();}
$('evArea').onchange=()=>{EV.area=$('evArea').value;updateEns();}; $('evCycle').onchange=updateEns;
$('evPrev').onclick=()=>{evLoop.stop();evLoop.prev();}; $('evNext').onclick=()=>{evLoop.stop();evLoop.next();}; $('evPlay').onclick=()=>evLoop.play();

/* =========================================================
   6) SPAGHETTI TAB (maps + point plumes)
   ========================================================= */
const spLoop = new Looper({img:$('spImg'), wrap:$('spWrap'), hoursEl:$('spHours'), playBtn:$('spPlay'),
  url:fh=>magUrl(SPAG.dir, +$('spCycle').value, SPAG.area, $('spParam').value, fh),
  onChange:fh=>$('spValid').innerHTML=validText(+$('spCycle').value, SPAG.latency, fh)});
function initSpag(){
  $('spParam').innerHTML=Object.entries(SPAG.params).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  fillCycles($('spCycle'), SPAG.cycles, SPAG.latency); spLoop.setHours(SPAG.hours());
  const loc=getLoc(); if(loc){ $('ptLoc').textContent=loc.name; loadPlume(); }
}
$('spParam').onchange=()=>spLoop.go(spLoop.idx); $('spCycle').onchange=()=>spLoop.setHours(SPAG.hours());
$('spPrev').onclick=()=>{spLoop.stop();spLoop.prev();}; $('spNext').onclick=()=>{spLoop.stop();spLoop.next();}; $('spPlay').onclick=()=>spLoop.play();

/* Open-Meteo ensemble model IDs (with fallbacks for older/newer naming) */
const ENS_IDS = {
  gefs:{ids:['gfs05','ncep_gefs05'], days:21, label:'GEFS'},
  ecmwf:{ids:['ecmwf_ifs025','ecmwf_ifs025_ensemble'], days:15, label:'ECMWF ENS'},
  aifs:{ids:['ecmwf_aifs025','ecmwf_aifs025_ensemble'], days:15, label:'ECMWF AIFS ENS'},
  gem:{ids:['gem_global','cmc_gem_geps'], days:16, label:'GEPS'},
  icon:{ids:['icon_seamless','dwd_icon_seamless_eps','icon_global'], days:7, label:'ICON-EPS'},
  gefs25:{ids:['gfs025','ncep_gefs025'], days:10, label:'GEFS 0.25°'},
  aigfs:{ids:['ncep_aigfs025','aigfs025'], days:16, label:'AIGFS ENS'},
  ukmo:{ids:['ukmo_global_ensemble_20km','ukmo_mogreps_g'], days:8, label:'MOGREPS-G'},
  wn2:{ids:['google_weathernext2','weathernext2'], days:15, label:'WeatherNext 2'}
};
const ensCache={};
async function fetchEnsemble(key, lat, lon, vars){
  const ck=`${key}|${lat}|${lon}|${vars}`; if(ensCache[ck])return ensCache[ck];
  const cfg=ENS_IDS[key];
  for(const id of cfg.ids){
    for(const days of [cfg.days, Math.min(cfg.days,15), 7]){
      try{
        const u=`https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${lat}&longitude=${lon}&hourly=${vars}&models=${id}&forecast_days=${days}&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph`;
        const r=await fetch(u); if(!r.ok)continue; const j=await r.json(); if(!j.hourly)continue;
        ensCache[ck]=j; return j;
      }catch(e){}
    }
  }
  throw new Error(cfg.label+' ensemble unavailable');
}
function members(hourly, v){
  return Object.keys(hourly).filter(k=>k===v||k.startsWith(v+'_member')).map(k=>({key:k, control:k===v, y:hourly[k]}));
}
async function loadPlume(){
  const loc=getLoc(); if(!loc){$('ptStatus').textContent='Enter a ZIP on the Local 20-Day tab first.';return;}
  const key=$('ptModel').value, v=$('ptVar').value; $('ptStatus').innerHTML='<span class="spinner"></span> loading…';
  try{
    const j=await fetchEnsemble(key, loc.lat, loc.lon, v);
    const t=j.hourly.time.map(s=>new Date(s).getTime());
    let ms=members(j.hourly,v);
    if(v==='snowfall'||v==='precipitation'){ ms=ms.map(m=>{let s=0; return {...m, y:m.y.map(x=>x==null?null:(s+=x))};}); }
    // trim trailing all-null
    let last=t.length-1; while(last>0 && ms.every(m=>m.y[last]==null)) last--;
    const tt=t.slice(0,last+1);
    const mean=tt.map((_,i)=>{const a=ms.map(m=>m.y[i]).filter(x=>x!=null); return a.length?a.reduce((p,c)=>p+c,0)/a.length:null;});
    const series=ms.filter(m=>!m.control).map(m=>({y:m.y.slice(0,last+1), color:'rgba(56,189,248,.35)', w:1}));
    const ctrl=ms.find(m=>m.control); if(ctrl) series.push({y:ctrl.y.slice(0,last+1), color:'#f87171', w:1.5});
    series.push({y:mean, color:'#f59e0b', w:3});
    lineChart($('ptChart'), {x:tt, series, unit: v==='temperature_2m'?'°':v==='wind_speed_10m'?'':'"', zeroBase:v!=='temperature_2m', freeze: v==='temperature_2m'?32:null});
    $('ptStatus').textContent=`${ENS_IDS[key].label}: ${ms.length} members · ${loc.name}`;
  }catch(e){$('ptStatus').textContent=e.message;}
}
$('ptGo').onclick=loadPlume; $('ptModel').onchange=loadPlume; $('ptVar').onchange=loadPlume;

/* =========================================================
   7) MODEL COMPARE TAB (deterministic point forecasts)
   ========================================================= */
const DET = [
  ['gfs_seamless','GFS','#38bdf8'],['ecmwf_ifs025','ECMWF IFS','#f87171'],['ecmwf_aifs025_single','ECMWF AIFS','#fb923c'],
  ['icon_seamless','ICON','#34d399'],['gem_seamless','GEM','#facc15'],['ukmo_seamless','UKMO','#c084fc'],
  ['jma_seamless','JMA','#f472b6'],['meteofrance_seamless','Météo-France','#a3e635'],['ncep_nbm_conus','NBM','#e5e7eb'],['gfs_hrrr','HRRR','#22d3ee'],
  ['ncep_nam_conus','NAM','#fda4af'],['gem_regional','GEM Regional (RDPS)','#fde68a'],['gem_hrdps_continental','HRDPS','#fef08a'],
  ['gfs_graphcast025','GraphCast (AI)','#93c5fd'],['ncep_aigfs025','AIGFS (AI)','#7dd3fc'],['knmi_seamless','KNMI Harmonie','#d8b4fe'],
  ['dmi_seamless','DMI Harmonie','#f0abfc'],['metno_seamless','MET Norway','#bbf7d0'],['kma_seamless','KMA (Korea)','#fcd34d'],
  ['cma_grapes_global','CMA GRAPES (China)','#fca5a5'],['bom_access_global','BOM ACCESS (Australia)','#a5f3fc'],['italia_meteo_arpae_icon_2i','ItaliaMeteo ICON-2I','#bef264'],
  /* --- extra variants: specific resolutions / regional versions --- */
  ['gfs_global','GFS 0.11/0.25° raw','#0ea5e9'],['ecmwf_ifs','ECMWF IFS 9 km HRES','#ef4444'],['icon_global','ICON Global 13 km','#10b981'],
  ['icon_eu','ICON-EU 7 km','#059669'],['icon_d2','ICON-D2 2 km','#047857'],['gem_global','GEM Global (GDPS)','#eab308'],
  ['ukmo_global_deterministic_10km','UKMO Global 10 km','#a855f7'],['ukmo_uk_deterministic_2km','UKMO UKV 2 km','#9333ea'],
  ['meteofrance_arpege_world','ARPEGE World','#84cc16'],['meteofrance_arpege_europe','ARPEGE Europe','#65a30d'],['meteofrance_arome_france','AROME France','#4d7c0f'],
  ['jma_gsm','JMA GSM','#ec4899'],['jma_msm','JMA MSM','#db2777'],['metno_nordic','MET Nordic','#86efac'],
  ['meteoswiss_icon_ch1','MeteoSwiss ICON-CH1','#f9a8d4'],['meteoswiss_icon_ch2','MeteoSwiss ICON-CH2','#fbcfe8'],
  ['kma_gdps','KMA GDPS','#fbbf24'],['kma_ldps','KMA LDPS','#f59e0b'],['ncep_hrrr_conus_15min','HRRR 15-min','#06b6d4'],
  ['ncep_nam_conus','NAM CONUS 3 km','#fb7185'],['ncep_gfs_graphcast025','GraphCast (alt id)','#60a5fa']
];
let detData=null;
async function loadDet(){
  const loc=getLoc(); if(!loc){$('pmStatus').textContent='Enter a ZIP on the Local 20-Day tab first.';return;}
  $('pmLoc').textContent=loc.name; $('pmStatus').innerHTML=`<span class="spinner"></span> loading ${DET.length} models…`;
  const daily='temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum';
  const res=await Promise.all(DET.map(async([id,name,color])=>{
    try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=${daily}&models=${id}&forecast_days=16&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch`);
      if(!r.ok)return null; const j=await r.json(); if(!j.daily||!j.daily.temperature_2m_max.some(v=>v!=null))return null; return {id,name,color,d:j.daily};}catch(e){return null;}
  }));
  detData=res.filter(Boolean); $('pmStatus').textContent=`${detData.length} models loaded · ${loc.name}`; drawDet();
}
function drawDet(){
  if(!detData||!detData.length)return; const v=$('pmVar').value;
  const time=detData[0].d.time; const x=time.map(s=>new Date(s+'T12:00').getTime());
  const series=detData.map(m=>({y:time.map(t=>{const i=m.d.time.indexOf(t); return i<0?null:m.d[v][i];}), color:m.color, w:2, dots:true}));
  lineChart($('pmChart'),{x,series,unit:v.startsWith('temp')?'°':'"',zeroBase:!v.startsWith('temp'),daily:true});
  $('pmLegend').innerHTML=detData.map(m=>`<span><i style="background:${m.color}"></i>${m.name}</span>`).join('');
  const fmt=val=>val==null?'–':v.startsWith('temp')?Math.round(val)+'°':(+val).toFixed(2);
  let h='<tr><th>Model</th>'+time.map(t=>{const d=new Date(t+'T12:00');return `<th>${DOW[d.getDay()]}<br>${d.getMonth()+1}/${d.getDate()}</th>`}).join('')+'</tr>';
  detData.forEach((m,k)=>{h+=`<tr><td><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.color};margin-right:5px"></i>${m.name}</td>`+series[k].y.map(val=>`<td>${fmt(val)}</td>`).join('')+'</tr>';});
  $('pmTable').innerHTML=h;
}
$('pmGo').onclick=loadDet; $('pmVar').onchange=drawDet;

/* =========================================================
   8) SATELLITE / RADAR
   ========================================================= */
const SAT_SECTORS = {
  GOES19:{CONUS:'CONUS',FD:'Full Disk','SECTOR/umv':'Upper Mississippi Valley','SECTOR/cgl':'Central Great Lakes','SECTOR/sp':'Southern Plains','SECTOR/smv':'Southern Mississippi Valley','SECTOR/ne':'Northeast','SECTOR/se':'Southeast','SECTOR/car':'Caribbean','SECTOR/taw':'Tropical Atlantic (wide)'},
  GOES18:{CONUS:'PACUS (West CONUS)',FD:'Full Disk','SECTOR/pnw':'Pacific Northwest','SECTOR/psw':'Pacific Southwest','SECTOR/nr':'Northern Rockies','SECTOR/sr':'Southern Rockies','SECTOR/ak':'Alaska','SECTOR/hi':'Hawaii','SECTOR/tpw':'Tropical Pacific (wide)'}
};
const SAT_SIZES = {CONUS:['1250x750','625x375'], FD:['1808x1808','678x678']};
let satMode='loop';
function fillSatSectors(){const s=$('satSat').value; $('satSector').innerHTML=Object.entries(SAT_SECTORS[s]).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');}
function satUrl(){
  const sat=$('satSat').value, sec=$('satSector').value, band=$('satBand').value;
  const base=`https://cdn.star.nesdis.noaa.gov/${sat}/ABI/${sec}/${band}/`;
  const [still,loop]=SAT_SIZES[sec]||['1200x1200','600x600'];
  const secName=sec.startsWith('SECTOR/')?sec.split('/')[1]:sec;
  return satMode==='loop' ? `${base}${sat}-${secName.toUpperCase()}-${band}-${loop}.gif` : `${base}${still}.jpg`;
}
function loadSat(){ $('satWrap').classList.remove('err'); $('satImg').src=satUrl()+'?t='+Math.floor(Date.now()/300000); }
$('satImg').onerror=()=>$('satWrap').classList.add('err'); $('satImg').onload=()=>$('satWrap').classList.remove('err');
$('satSat').onchange=()=>{fillSatSectors();loadSat();}; $('satSector').onchange=loadSat; $('satBand').onchange=loadSat; $('satRefresh').onclick=loadSat;
$('satLoop').onclick=()=>{satMode='loop';$('satLoop').classList.add('on');$('satStill').classList.remove('on');loadSat();};
$('satStill').onclick=()=>{satMode='still';$('satStill').classList.add('on');$('satLoop').classList.remove('on');loadSat();};

function loadRadar(site){
  const id=site||$('radSel').value; $('radWrap').classList.remove('err');
  $('radImg').src=`https://radar.weather.gov/ridge/standard/${id}_loop.gif?t=${Math.floor(Date.now()/120000)}`;
}
$('radImg').onerror=()=>$('radWrap').classList.add('err'); $('radImg').onload=()=>$('radWrap').classList.remove('err');
$('radSel').onchange=()=>loadRadar(); $('radRefresh').onclick=()=>loadRadar($('radSite').value.trim().toUpperCase()||null);
$('radGo').onclick=()=>{const s=$('radSite').value.trim().toUpperCase(); if(s)loadRadar(s);};

/* =========================================================
   9) IMAGE GALLERIES (Analysis / Tropics / Outlooks)
   ========================================================= */
function gallery(el, items){
  const bust='?t='+Math.floor(Date.now()/600000);
  el.innerHTML=items.map(([title,src,link])=>`<div class="card"><figure><img loading="lazy" src="${src}${bust}" alt="${title}" onerror="this.outerHTML='<div class=broken>Image unavailable right now.<br>Try the source link.</div>'"><figcaption><span>${title}</span><a href="${link||src}" target="_blank" rel="noopener">source ↗</a></figcaption></figure></div>`).join('');
}
const ANALYSIS = [
  ['WPC Surface Analysis (fronts)','https://www.wpc.ncep.noaa.gov/basicwx/92fndfd.gif','https://www.wpc.ncep.noaa.gov/html/sfc-zoom.php'],
  ['WPC Surface Analysis w/ Obs','https://www.wpc.ncep.noaa.gov/sfc/namussfcwbg.gif','https://www.wpc.ncep.noaa.gov/html/sfc-zoom.php'],
  ['Observed 250 mb','https://www.spc.noaa.gov/obswx/maps/250.gif','https://www.spc.noaa.gov/obswx/maps/'],
  ['Observed 500 mb','https://www.spc.noaa.gov/obswx/maps/500.gif','https://www.spc.noaa.gov/obswx/maps/'],
  ['Observed 700 mb','https://www.spc.noaa.gov/obswx/maps/700.gif','https://www.spc.noaa.gov/obswx/maps/'],
  ['Observed 850 mb','https://www.spc.noaa.gov/obswx/maps/850.gif','https://www.spc.noaa.gov/obswx/maps/'],
  ['Weekly SST Anomaly (CPC)','https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_update/sstweek_c.gif','https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_update/sst.shtml'],
  ['National Snow Depth (NOHRSC)','https://www.nohrsc.noaa.gov/snow_model/images/full/National/nsm_depth/'+nohrscDate()+'_nsm_depth.jpg','https://www.nohrsc.noaa.gov/nsa/'],
  ['SPC Mesoanalysis','https://www.spc.noaa.gov/exper/mesoanalysis/s19/pmsl/pmsl.gif','https://www.spc.noaa.gov/exper/mesoanalysis/'],
];
function nohrscDate(){const d=new Date(Date.now()-6*3600e3);return `${d.getUTCFullYear()}${pad2(d.getUTCMonth()+1)}/nsm_depth_${d.getUTCFullYear()}${pad2(d.getUTCMonth()+1)}${pad2(d.getUTCDate())}05`;}
const TROPICS = [
  ['Atlantic 7-Day Outlook (NHC)','https://www.nhc.noaa.gov/xgtwo/two_atl_7d0.png','https://www.nhc.noaa.gov/gtwo.php?basin=atlc'],
  ['East Pacific 7-Day Outlook (NHC)','https://www.nhc.noaa.gov/xgtwo/two_pac_7d0.png','https://www.nhc.noaa.gov/gtwo.php?basin=epac'],
  ['Central Pacific 7-Day Outlook','https://www.nhc.noaa.gov/xgtwo/two_cpac_7d0.png','https://www.nhc.noaa.gov/gtwo.php?basin=cpac'],
  ['Tropical Atlantic GeoColor','https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/taw/GEOCOLOR/900x540.jpg','https://www.star.nesdis.noaa.gov/GOES/sector.php?sat=G19&sector=taw'],
  ['Caribbean GeoColor','https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/car/GEOCOLOR/1000x1000.jpg','https://www.star.nesdis.noaa.gov/GOES/sector.php?sat=G19&sector=car'],
  ['GEFS Mean MSLP, W. Atlantic (72 hr)', magUrl('gefs-mean-sprd',latestCycle([0,6,12,18],6),'west-atl','mslp',72),'https://mag.ncep.noaa.gov/'],
];
const OUTLOOKS = [
  ['WPC Day 1 Snow ≥ 4" Probability','https://www.wpc.ncep.noaa.gov/wwd/day1_psnow_gt_04_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Day 2 Snow ≥ 4" Probability','https://www.wpc.ncep.noaa.gov/wwd/day2_psnow_gt_04_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Day 3 Snow ≥ 4" Probability','https://www.wpc.ncep.noaa.gov/wwd/day3_psnow_gt_04_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Day 1 Snow ≥ 8" Probability','https://www.wpc.ncep.noaa.gov/wwd/day1_psnow_gt_08_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Day 1 Freezing Rain ≥ 0.25"','https://www.wpc.ncep.noaa.gov/wwd/day1_pice_gt_25_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Day 4 Winter Outlook','https://www.wpc.ncep.noaa.gov/wwd/pwpf_d47/gif/prbww_sn25_DAY4_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Day 5 Winter Outlook','https://www.wpc.ncep.noaa.gov/wwd/pwpf_d47/gif/prbww_sn25_DAY5_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Day 6 Winter Outlook','https://www.wpc.ncep.noaa.gov/wwd/pwpf_d47/gif/prbww_sn25_DAY6_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Day 7 Winter Outlook','https://www.wpc.ncep.noaa.gov/wwd/pwpf_d47/gif/prbww_sn25_DAY7_conus.gif','https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml'],
  ['WPC Days 3–7 Hazards','https://www.wpc.ncep.noaa.gov/threats/final/hazards_d3_7_contours.png','https://www.wpc.ncep.noaa.gov/threats/threats.php'],
  ['WPC Days 8–14 Hazards','https://www.cpc.ncep.noaa.gov/products/predictions/threats/hazards_d8_14_contours.png','https://www.cpc.ncep.noaa.gov/products/predictions/threats/threats.php'],
  ['WPC Day 1 QPF','https://www.wpc.ncep.noaa.gov/qpf/fill_94qwbg.gif','https://www.wpc.ncep.noaa.gov/qpf/qpf2.shtml'],
  ['WPC Day 2 QPF','https://www.wpc.ncep.noaa.gov/qpf/fill_98qwbg.gif','https://www.wpc.ncep.noaa.gov/qpf/qpf2.shtml'],
  ['WPC Day 3 QPF','https://www.wpc.ncep.noaa.gov/qpf/fill_99qwbg.gif','https://www.wpc.ncep.noaa.gov/qpf/qpf2.shtml'],
  ['WPC 7-Day Total QPF','https://www.wpc.ncep.noaa.gov/qpf/p168i.gif','https://www.wpc.ncep.noaa.gov/qpf/qpf2.shtml'],
  ['SPC Day 1 Convective Outlook','https://www.spc.noaa.gov/products/outlook/day1otlk.gif','https://www.spc.noaa.gov/products/outlook/'],
  ['SPC Day 2 Convective Outlook','https://www.spc.noaa.gov/products/outlook/day2otlk.gif','https://www.spc.noaa.gov/products/outlook/'],
  ['SPC Day 3 Convective Outlook','https://www.spc.noaa.gov/products/outlook/day3otlk.gif','https://www.spc.noaa.gov/products/outlook/'],
  ['CPC 6–10 Day Temperature','https://www.cpc.ncep.noaa.gov/products/predictions/610day/610temp.new.gif','https://www.cpc.ncep.noaa.gov/products/predictions/610day/'],
  ['CPC 6–10 Day Precipitation','https://www.cpc.ncep.noaa.gov/products/predictions/610day/610prcp.new.gif','https://www.cpc.ncep.noaa.gov/products/predictions/610day/'],
  ['CPC 8–14 Day Temperature','https://www.cpc.ncep.noaa.gov/products/predictions/814day/814temp.new.gif','https://www.cpc.ncep.noaa.gov/products/predictions/814day/'],
  ['CPC 8–14 Day Precipitation','https://www.cpc.ncep.noaa.gov/products/predictions/814day/814prcp.new.gif','https://www.cpc.ncep.noaa.gov/products/predictions/814day/'],
  ['CPC Week 3–4 Temperature','https://www.cpc.ncep.noaa.gov/products/predictions/WK34/gifs/WK34temp.gif','https://www.cpc.ncep.noaa.gov/products/predictions/WK34/'],
  ['CPC Week 3–4 Precipitation','https://www.cpc.ncep.noaa.gov/products/predictions/WK34/gifs/WK34prcp.gif','https://www.cpc.ncep.noaa.gov/products/predictions/WK34/'],
];
async function loadActiveStorms(){
  try{
    const r=await fetch(px('https://www.nhc.noaa.gov/CurrentStorms.json')); const j=await r.json(); const s=j.activeStorms||[];
    if(!s.length){$('tcActive').innerHTML='No active tropical cyclones right now. The 7-day outlooks below show any areas NHC is watching.';return;}
    $('tcActive').innerHTML='<div class="grid g3 gal">'+s.map(st=>{
      const bin=st.binNumber, id=(st.id||'').toUpperCase();
      const cone=`https://www.nhc.noaa.gov/storm_graphics/${bin}/${id}_5day_cone_with_line_and_wind.png`;
      return `<div class="card"><h3>${st.classification||''} ${st.name} <span class="pill">${st.intensity||'?'} kt · ${st.pressure||'?'} mb</span></h3><figure><img src="${cone}" alt="cone" onerror="this.outerHTML='<div class=broken>Cone graphic unavailable</div>'"><figcaption><span>NHC 5-day cone</span><a href="https://www.nhc.noaa.gov/" target="_blank" rel="noopener">NHC ↗</a> <a href="https://www.tropicaltidbits.com/storminfo/" target="_blank" rel="noopener">spaghetti ↗</a></figcaption></figure></div>`;
    }).join('')+'</div>';
  }catch(e){$('tcActive').innerHTML='Couldn\'t reach the NHC storm list from this page. Check <a href="https://www.nhc.noaa.gov/" target="_blank" rel="noopener">nhc.noaa.gov ↗</a>.';}
}

/* =========================================================
   10) CANVAS CHARTS (no libraries)
   ========================================================= */
function setupCanvas(cv){const dpr=window.devicePixelRatio||1, w=cv.clientWidth, h=cv.clientHeight;
  cv.width=w*dpr; cv.height=h*dpr; const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,w,h); return {c,w,h};}
function niceRange(min,max,zeroBase){ if(zeroBase)min=Math.min(0,min); if(min===max){max+=1;min-=zeroBase?0:1;}
  const span=max-min, step=Math.pow(10,Math.floor(Math.log10(span/5))); const m=[1,2,2.5,5,10].map(k=>k*step).find(s=>span/s<=6)||step*10;
  return {lo:Math.floor(min/m)*m, hi:Math.ceil(max/m)*m, step:m}; }
function lineChart(cv,o){
  const {c,w,h}=setupCanvas(cv); const L=42,R=10,T=10,B=28;
  let vals=[]; o.series.forEach(s=>s.y.forEach(v=>{if(v!=null&&isFinite(v))vals.push(v)})); if(o.band)o.band.forEach(b=>{if(b){vals.push(b[0],b[1])}});
  if(!vals.length){c.fillStyle='#8fa0c0';c.fillText('No data',w/2-20,h/2);return;}
  const r=niceRange(Math.min(...vals),Math.max(...vals),o.zeroBase);
  const x0=o.x[0], x1=o.x[o.x.length-1]||x0+1;
  const X=t=>L+(t-x0)/(x1-x0||1)*(w-L-R), Y=v=>T+(r.hi-v)/(r.hi-r.lo)*(h-T-B);
  c.font='11px Segoe UI, sans-serif'; c.strokeStyle='#1e2a45'; c.fillStyle='#8fa0c0'; c.lineWidth=1;
  for(let v=r.lo; v<=r.hi+1e-9; v+=r.step){const y=Y(v); c.beginPath();c.moveTo(L,y);c.lineTo(w-R,y);c.stroke(); c.fillText((Math.abs(r.step)<1?v.toFixed(1):Math.round(v))+(o.unit||''),4,y+4);}
  // time ticks: month starts for long ranges, days otherwise
  if(o.monthly){ const d=new Date(x0); d.setDate(1); d.setHours(0,0,0,0);
    for(; d.getTime()<=x1; d.setMonth(d.getMonth()+1)){ const t=d.getTime(); if(t<x0) continue; const x=X(t);
      c.strokeStyle='#18233b'; c.beginPath();c.moveTo(x,T);c.lineTo(x,h-B);c.stroke(); c.fillStyle='#8fa0c0'; c.fillText(MON[d.getMonth()],x+3,h-10);} }
  else { const days=[]; const d0=new Date(x0); d0.setHours(0,0,0,0); for(let t=d0.getTime(); t<=x1; t+=864e5) if(t>=x0-1) days.push(t);
    const every=Math.max(1,Math.ceil(days.length/12),Math.ceil(days.length*78/(w-L-R)));
    days.forEach((t,i)=>{const x=X(t); c.strokeStyle='#18233b'; c.beginPath();c.moveTo(x,T);c.lineTo(x,h-B);c.stroke();
      if(i%every===0){const d=new Date(t); c.fillStyle='#8fa0c0'; c.fillText(`${DOW[d.getDay()]} ${d.getMonth()+1}/${d.getDate()}`,x+2,h-10);}}); }
  if(o.freeze!=null && o.freeze>r.lo && o.freeze<r.hi){c.strokeStyle='rgba(196,181,253,.7)';c.setLineDash([5,4]);c.beginPath();c.moveTo(L,Y(o.freeze));c.lineTo(w-R,Y(o.freeze));c.stroke();c.setLineDash([]);c.fillStyle='#c4b5fd';c.fillText('32°',w-R-24,Y(o.freeze)-3);}
  if(o.band){c.fillStyle=o.bandColor||'rgba(248,113,113,.22)'; c.beginPath(); let started=false;
    o.band.forEach((b,i)=>{if(!b)return; const x=X(o.x[i]); started?c.lineTo(x,Y(b[1])):(c.moveTo(x,Y(b[1])),started=true);});
    for(let i=o.band.length-1;i>=0;i--){const b=o.band[i]; if(b)c.lineTo(X(o.x[i]),Y(b[0]));} c.closePath(); c.fill();}
  o.series.forEach(s=>{c.strokeStyle=s.color; c.lineWidth=s.w||1.5; c.setLineDash(s.dash||[]); c.beginPath(); let pen=false;
    s.y.forEach((v,i)=>{if(v==null||!isFinite(v)){pen=false;return;} const x=X(o.x[i]),y=Y(v); pen?c.lineTo(x,y):c.moveTo(x,y); pen=true;}); c.stroke(); c.setLineDash([]);
    if(s.dots){c.fillStyle=s.color; s.y.forEach((v,i)=>{if(v!=null){c.beginPath();c.arc(X(o.x[i]),Y(v),2.5,0,7);c.fill();}});}});
}
function barChart(cv,o){
  const {c,w,h}=setupCanvas(cv); const L=36,R=8,T=10,B=28, n=o.labels.length, bw=(w-L-R)/n;
  c.font='11px Segoe UI, sans-serif';
  for(let v=0;v<=100;v+=25){const y=T+(100-v)/100*(h-T-B); c.strokeStyle='#1e2a45';c.beginPath();c.moveTo(L,y);c.lineTo(w-R,y);c.stroke();c.fillStyle='#8fa0c0';c.fillText(v+'%',4,y+4);}
  o.labels.forEach((lab,i)=>{const x=L+i*bw; const v=o.a[i]; if(v!=null){const y=T+(100-v)/100*(h-T-B); c.fillStyle=i>=(o.dimFrom??16)?'rgba(196,181,253,.55)':'#c4b5fd'; c.fillRect(x+bw*.15,y,bw*.7,h-B-y);}
    const v2=o.b[i]; if(v2!=null){const y=T+(100-v2)/100*(h-T-B); c.fillStyle='#f59e0b'; c.fillRect(x+bw*.35,y,bw*.3,h-B-y);}
    if(i%(o.every||Math.ceil(n/10))===0){c.fillStyle='#8fa0c0'; c.fillText(lab,x+2,h-10);}});
}

/* =========================================================
   11) LOCAL 20-DAY FORECAST
   ========================================================= */
const WMO={0:['☀️','Clear'],1:['🌤️','Mostly clear'],2:['⛅','Partly cloudy'],3:['☁️','Cloudy'],45:['🌫️','Fog'],48:['🌫️','Freezing fog'],
  51:['🌦️','Light drizzle'],53:['🌦️','Drizzle'],55:['🌧️','Heavy drizzle'],56:['🌧️','Freezing drizzle'],57:['🌧️','Freezing drizzle'],
  61:['🌧️','Light rain'],63:['🌧️','Rain'],65:['🌧️','Heavy rain'],66:['🧊','Freezing rain'],67:['🧊','Freezing rain'],
  71:['🌨️','Light snow'],73:['🌨️','Snow'],75:['❄️','Heavy snow'],77:['🌨️','Snow grains'],80:['🌦️','Showers'],81:['🌧️','Showers'],82:['⛈️','Heavy showers'],
  85:['🌨️','Snow showers'],86:['❄️','Heavy snow showers'],95:['⛈️','Thunderstorms'],96:['⛈️','T-storms w/ hail'],99:['⛈️','Severe t-storms']};
function getLoc(){try{return JSON.parse(store.get('wx.loc'))}catch(e){return null}}

async function geocodeZip(zip){
  const r=await fetch(`https://api.zippopotam.us/us/${zip}`); if(!r.ok) throw new Error('ZIP code not found.');
  const j=await r.json(); const p=j.places[0];
  return {zip, lat:+(+p.latitude).toFixed(3), lon:+(+p.longitude).toFixed(3), name:`${p['place name']}, ${p['state abbreviation']}`};
}
/* Per-day stats from ensemble members (hourly -> daily) */
function ensDaily(j){
  const time=j.hourly.time, byDay={};
  time.forEach((t,i)=>{(byDay[t.slice(0,10)]=byDay[t.slice(0,10)]||[]).push(i);});
  const T=members(j.hourly,'temperature_2m'), P=members(j.hourly,'precipitation'), S=members(j.hourly,'snowfall');
  const out={};
  for(const day in byDay){ const idx=byDay[day]; if(idx.length<12) continue;
    const per=T.map((m,k)=>{const tv=idx.map(i=>m.y[i]).filter(v=>v!=null); if(tv.length<idx.length*0.6) return null;
      const pv=P[k]?idx.reduce((s,i)=>s+(P[k].y[i]||0),0):0, sv=S[k]?idx.reduce((s,i)=>s+(S[k].y[i]||0),0):0;
      return {hi:Math.max(...tv), lo:Math.min(...tv), p:pv, s:sv};}).filter(Boolean);
    if(per.length) out[day]=per; }
  return out;
}
const pct=(arr,q)=>{const a=arr.slice().sort((x,y)=>x-y); const i=(a.length-1)*q, lo=Math.floor(i); return a[lo]+(a[Math.ceil(i)]-a[lo])*(i-lo);};
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;

async function runLocal(zip){
  zip=(zip||$('zipIn').value).trim();
  if(!/^\d{5}$/.test(zip)){$('locStatus').textContent='Enter a 5-digit US ZIP code.';return;}
  $('locStatus').innerHTML='<span class="spinner"></span> Finding location…';
  let loc; try{loc=await geocodeZip(zip);}catch(e){$('locStatus').textContent=e.message;return;}
  store.set('wx.loc',JSON.stringify(loc)); store.set('wx.zip',zip); saveLoc(loc); checkAlerts();
  $('ptLoc').textContent=loc.name; $('pmLoc').textContent=loc.name;
  $('locStatus').innerHTML='<span class="spinner"></span> Loading models &amp; ensembles…';
  const det=fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,precipitation_probability_max,wind_speed_10m_max&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&forecast_days=16&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph`).then(r=>r.ok?r.json():null).catch(()=>null);
  const vars='temperature_2m,precipitation,snowfall';
  const gefs=fetchEnsemble('gefs',loc.lat,loc.lon,vars).catch(()=>null);
  const ecm=fetchEnsemble('ecmwf',loc.lat,loc.lon,vars).catch(()=>null);
  const gem=fetchEnsemble('gem',loc.lat,loc.lon,vars).catch(()=>null);
  const nws=loadNWS(loc);
  const [D,G,E,C]=await Promise.all([det,gefs,ecm,gem]);
  if(!D&&!G){$('locStatus').textContent='Forecast data couldn\'t load. Check your connection and try again.';return;}
  const gd=G?ensDaily(G):{}, ed=E?ensDaily(E):{}, cd=C?ensDaily(C):{};
  // Build 20 days starting from today (location time)
  const startStr=(D&&D.daily.time[0])||Object.keys(gd)[0];
  const start=new Date(startStr+'T12:00'); const days=[];
  for(let i=0;i<20;i++){
    const d=new Date(start.getTime()+i*864e5); const key=`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    const di=D?D.daily.time.indexOf(key):-1; const mem=[...(gd[key]||[]),...(ed[key]||[]),...(cd[key]||[])];
    const day={date:d,key,src:di>=0?'det':'ens',n:mem.length};
    if(mem.length){ day.snowPct=Math.round(100*mem.filter(m=>m.s>=0.1).length/mem.length); day.snow1=Math.round(100*mem.filter(m=>m.s>=1).length/mem.length);
      day.rainPct=Math.round(100*mem.filter(m=>m.p>=0.01).length/mem.length); const his=mem.map(m=>m.hi); day.band=[pct(his,.1),pct(his,.9)];
      day.eHi=mean(his); day.eLo=mean(mem.map(m=>m.lo)); day.eP=mean(mem.map(m=>m.p)); day.eS=mean(mem.map(m=>m.s)); }
    if(di>=0){const x=D.daily; day.hi=x.temperature_2m_max[di]; day.lo=x.temperature_2m_min[di]; day.p=x.precipitation_sum[di]; day.s=x.snowfall_sum[di];
      day.pop=x.precipitation_probability_max[di]; day.wind=x.wind_speed_10m_max[di]; day.code=x.weather_code[di];}
    else if(mem.length){day.hi=day.eHi; day.lo=day.eLo; day.p=day.eP; day.s=day.eS; day.pop=day.rainPct; day.wind=null;
      day.code= day.snowPct>=50&&day.eS>=0.2?73 : day.snowPct>=30?71 : day.rainPct>=60?63 : day.rainPct>=35?80 : 2;}
    if(day.hi==null) continue; days.push(day);
  }
  renderLocal(loc,D,days,!!G,!!E);
  $('locStatus').textContent=`Updated ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} · ensembles: ${G?'GEFS ✓':'GEFS ✗'} ${E?'ECMWF ✓':'ECMWF ✗'} ${C?'GEPS ✓':'GEPS ✗'}`;
  await nws;
}
function renderLocal(loc,D,days,hasG,hasE){
  $('localOut').style.display='';
  $('placeName').textContent=`${loc.name} ${loc.zip}`;
  $('placeMeta').textContent=`${loc.lat}°, ${loc.lon}°${D?' · '+D.timezone:''}`;
  if(D&&D.current){const c=D.current, w=WMO[c.weather_code]||['',''];
    $('nowBox').innerHTML=`<span style="font-size:26px">${w[0]}</span> <b style="font-size:22px">${Math.round(c.temperature_2m)}°F</b> ${w[1]}<br>Feels ${Math.round(c.apparent_temperature)}° · Wind ${Math.round(c.wind_speed_10m)} mph · RH ${c.relative_humidity_2m}%`;}
  $('days').innerHTML=days.map((d,i)=>{const w=WMO[d.code]||['❔',''];
    const sp=d.snowPct!=null?d.snowPct:(d.s>0?null:0);
    return `<div class="day ${d.src==='ens'?'ens':''}" title="${w[1]}">
      <span class="tag">${d.src==='ens'?'ENS · ':''}D${i+1}</span>
      <div class="dname">${i===0?'Today':DOW[d.date.getDay()]}</div><div class="ddate">${MON[d.date.getMonth()]} ${d.date.getDate()}</div>
      <div class="ico">${w[0]}</div>
      <div><span class="hi">${Math.round(d.hi)}°</span> / <span class="lo">${Math.round(d.lo)}°</span></div>
      <div class="meta">💧 ${d.pop!=null?Math.round(d.pop)+'%':'–'} · ${(d.p||0).toFixed(2)}"<br>
      ❄️ <span class="snowpct">${sp==null?'–':sp+'%'}</span> snow${d.s>=0.05?` · ${(+d.s).toFixed(1)}"`:''}${d.snow1>0?`<br><span class="muted">≥1in: ${d.snow1}%</span>`:''}</div>
      <div class="snowbar"><i style="width:${sp||0}%"></i></div></div>`;}).join('');
  const x=days.map(d=>d.date.getTime());
  lineChart($('tChart'),{x,series:[{y:days.map(d=>d.hi),color:'#f87171',w:2.5,dots:true},{y:days.map(d=>d.lo),color:'#60a5fa',w:2.5,dots:true}],
    band:days.map(d=>d.band||null), unit:'°', freeze:32});
  barChart($('sChart'),{labels:days.map(d=>`${d.date.getMonth()+1}/${d.date.getDate()}`), a:days.map(d=>d.snowPct??null), b:days.map(d=>d.snow1??null)});
}
async function loadNWS(loc){
  $('alerts').innerHTML=''; $('nwsText').innerHTML='<span class="spinner"></span>';
  try{
    const p=await (await fetch(`https://api.weather.gov/points/${loc.lat},${loc.lon}`)).json();
    const pr=p.properties||{}; if(pr.radarStation){$('radSite').value=pr.radarStation;}
    fetch(`https://api.weather.gov/alerts/active?point=${loc.lat},${loc.lon}`).then(r=>r.json()).then(a=>{
      $('alerts').innerHTML=(a.features||[]).map(f=>`<div class="alert"><b>⚠ ${f.properties.event}</b> — ${f.properties.headline||''}</div>`).join('');}).catch(()=>{});
    const f=await (await fetch(pr.forecast)).json();
    $('nwsText').innerHTML=`<div class="muted" style="margin-bottom:6px">NWS ${pr.cwa||''} · nearest radar ${pr.radarStation||'?'} (<a href="#" id="radJump">view loop</a>)</div>`+
      f.properties.periods.slice(0,10).map(x=>`<p style="margin:4px 0"><b>${x.name}:</b> ${x.detailedForecast}</p>`).join('');
    const j=$('radJump'); if(j)j.onclick=e=>{e.preventDefault(); showTab('radar'); loadRadar(pr.radarStation);};
  }catch(e){$('nwsText').textContent='NWS forecast unavailable for this location right now.';}
}
$('zipGo').onclick=()=>runLocal(); $('zipIn').addEventListener('keydown',e=>{if(e.key==='Enter')runLocal();});


/* =========================================================
   13) POLITICS TAB
   Snapshot data: update POLITICS below as new polls come in.
   Live news headlines come from the GDELT DOC API.
   ========================================================= */
const POLITICS = {
  asOf:'Nov 20, 2026',
  approval:{approve:37.8, disapprove:59.8, note:'PollCheck average, Nov 20 (down 0.5 since Nov 13)', src:'https://www.pollcheck.com/'},
  congress:{text:'Democrats won control of both the House and the Senate in the Nov 3 midterms', src:'https://www.opb.org/article/2026/11/04/2026-midterms-democrats-win-the-senate/'},
  rep:{meta:'PollCheck avg · through Nov 20', src:'https://www.pollcheck.com/primaries/republican/', list:[
    ['JD Vance',33.3,-5.9],['Marco Rubio',32.6,14.2],['Ron DeSantis',11.3,2.3],['Donald Trump Jr.',6.1,-6.7],['Robert F. Kennedy Jr.',3.3,-1.4],['Ted Cruz',3.1,-0.3],['Nikki Haley',2.4,-1.4],['Vivek Ramaswamy',1.3,0]]},
  dem:{meta:'PollCheck avg · 17 polls · through Nov 20', src:'https://www.pollcheck.com/primaries/democratic/', list:[
    ['Kamala Harris',18.3,-7.4],['Alexandria Ocasio-Cortez',13.7,3.5],['Gavin Newsom',13.2,-2.7],['Jon Ossoff',13.2,5.8],['Pete Buttigieg',12.9,1.1],['Mark Kelly',5.6,-0.7],['Josh Shapiro',4.7,-0.1],['Andy Beshear',3.2,0.6],['JB Pritzker',2.8,0.1],['Cory Booker',2.4,-1.1]]},
  latest:[ // [party, pollster, dates, sample, result text]
    ['R','Emerson College','Nov 14–16','418 V','Rubio 44, Vance 24, DeSantis 9, Trump Jr. 6'],
    ['D','Emerson College','Nov 14–16','499 RV','Ossoff 16.5 leads field'],
    ['R','Echelon Insights','Nov 12–16','397 RV','Vance 40, Rubio 26, DeSantis 12'],
    ['D','Echelon Insights','Nov 12–16','531 LV','Harris 19 leads field'],
    ['R','Verasight','Nov 11–13','632 A','Rubio 33, Vance 27, DeSantis 19'],
    ['D','Verasight','Nov 11–13','726 A','Harris 18 leads field'],
    ['R','The Rainey Center','Nov 8–12','406 LV','Vance 36, Rubio 24, DeSantis 10'],
    ['D','Rainey Center','Nov 8–12','518 LV','Harris 17 leads field'],
    ['D','YouGov','Nov 9–11','489 A','Harris 20 leads field'],
    ['D','Cygnal','Nov 4–5','3,000 RV','Buttigieg 18.5, Ocasio-Cortez 17.9'],
  ],
  general:{avg:[['Gavin Newsom',47.0,'JD Vance',39.5,'Average of 5 polls']],
    single:[['Jon Ossoff',50,'JD Vance',37],['Gavin Newsom',51,'JD Vance',38],['Kamala Harris',50,'JD Vance',40],['Alexandria Ocasio-Cortez',49,'JD Vance',40]],
    singleNote:'On Point Polling, Nov 16 (single poll)'},
  briefs:[
    {t:'Iran war',src:'https://www.cbsnews.com/live-updates/iran-war-us-nuclear-strait-of-hormuz/',pts:[
      'The US-Israel war on Iran has run for more than eight months. Attacks on ships in and near the Strait of Hormuz continue.',
      'Oil prices are still more than 40% above their pre-war level.',
      'Nuclear proposals are moving through Qatari mediators, but the two sides remain far apart on demands.',
      'Iran warns it will strike back if attacked again. More US naval forces have arrived in the region.']},
    {t:'Russia–Ukraine war',src:'https://www.criticalthreats.org/analysis/russian-offensive-campaign-assessment-november-18-2026',pts:[
      'US-mediated three-way talks were held in Abu Dhabi on Nov 12. Russia restated its territorial demands and its demands on NATO.',
      'Russia keeps up large missile and drone strikes on Ukraine\'s energy grid. Ukraine is hitting Russian refineries and military plants.',
      'The UN reports that Ukrainian civilian casualties in October 2026 were up 95% from October 2025.']},
    {t:'Congress & 2028',src:'https://www.opb.org/article/2026/11/04/2026-midterms-democrats-win-the-senate/',pts:[
      'Democrats will control both chambers from January, so the next two years are divided government.',
      'Vance has said he would decide on a 2028 run after the midterms. On the Republican side, Rubio has tightened the primary race in November polls.']}
  ],
  links:[['RealClearPolling','https://www.realclearpolling.com/'],['PollCheck','https://www.pollcheck.com/'],['Race to the WH','https://www.racetothewh.com/president/2028/gop'],['270toWin','https://www.270towin.com/'],
    ['NYT poll averages','https://www.nytimes.com/interactive/polls/donald-trump-approval-rating-polls.html'],['Silver Bulletin','https://www.natesilver.net/'],['AP News','https://apnews.com/politics'],['Reuters World','https://www.reuters.com/world/'],
    ['ISW Ukraine updates','https://understandingwar.org/'],['Kyiv Independent','https://kyivindependent.com/'],['Al Jazeera live','https://www.aljazeera.com/'],['Fox News politics','https://www.foxnews.com/politics']]
};
const NEWS_TOPICS = {iran:['Iran','"Iran" (war OR strike OR Hormuz OR nuclear)'], ukraine:['Ukraine','(Ukraine OR Ukrainian) (Russia OR Russian) (war OR strike OR talks)'],
  y2028:['2028','"2028" (Vance OR Rubio OR Newsom OR Harris OR Ossoff OR Buttigieg) (president OR primary)'], dc:['Congress','(Congress OR Senate OR "House of Representatives") (Trump OR Democrats OR Republicans)']};
let newsTopic='iran';
const chg=v=>v>0?`<span class="chg up">▲${v.toFixed(1)}</span>`:v<0?`<span class="chg down">▼${Math.abs(v).toFixed(1)}</span>`:`<span class="chg muted">—</span>`;
function candRows(list,color){const max=Math.max(...list.map(x=>x[1]));
  return list.map(([n,v,c],i)=>`<div class="cand"><span class="rank">${i+1}</span><span>${n}</span><span class="bar"><i style="width:${v/max*100}%;background:${color}"></i></span><span class="pct">${v.toFixed(1)}%</span>${chg(c)}</div>`).join('');}
function initPolitics(){
  const P=POLITICS, net=(P.approval.approve-P.approval.disapprove).toFixed(1);
  $('polTop').innerHTML=`<div class="stat"><div class="k">Trump job approval</div><div class="v">${P.approval.approve}% <span class="small muted">approve</span></div><div class="s">${P.approval.disapprove}% disapprove · net <b class="down">${net}</b> · <a href="${P.approval.src}" target="_blank" rel="noopener">source</a></div></div>
    <div class="stat"><div class="k">GOP 2028 leader</div><div class="v" style="color:var(--rep)">${P.rep.list[0][0]} ${P.rep.list[0][1]}%</div><div class="s">${P.rep.list[1][0]} ${P.rep.list[1][1]}% · margin +${(P.rep.list[0][1]-P.rep.list[1][1]).toFixed(1)}</div></div>
    <div class="stat"><div class="k">Dem 2028 leader</div><div class="v" style="color:var(--dem)">${P.dem.list[0][0]} ${P.dem.list[0][1]}%</div><div class="s">${P.dem.list[1][0]} ${P.dem.list[1][1]}% · margin +${(P.dem.list[0][1]-P.dem.list[1][1]).toFixed(1)}</div></div>
    <div class="stat"><div class="k">Congress (from Jan 2027)</div><div class="v">Divided</div><div class="s">${P.congress.text} · <a href="${P.congress.src}" target="_blank" rel="noopener">source</a></div></div>`;
  $('repMeta').innerHTML=`<a href="${P.rep.src}" target="_blank" rel="noopener">${P.rep.meta}</a>`; $('demMeta').innerHTML=`<a href="${P.dem.src}" target="_blank" rel="noopener">${P.dem.meta}</a>`;
  $('repAvg').innerHTML=candRows(P.rep.list,'var(--rep)'); $('demAvg').innerHTML=candRows(P.dem.list,'var(--dem)');
  $('latestPolls').innerHTML='<tr><th>Race</th><th>Pollster</th><th>Dates</th><th>Sample</th><th>Result</th></tr>'+P.latest.map(([pt,n,d,sm,r])=>`<tr><td class="${pt==='R'?'r':'d'} lead">${pt==='R'?'GOP':'Dem'}</td><td>${n}</td><td>${d}</td><td>${sm}</td><td style="text-align:left">${r}</td></tr>`).join('');
  const mu=([dn,dv,rn,rv],note)=>{const sp=dv-rv; return `<div class="matchup"><span class="dside">${dn} (D) <b>${dv}</b></span><span class="sp ${sp>0?'':'down'}" style="color:${sp>0?'var(--dem)':'var(--rep)'}">${sp>0?'D':'R'}+${Math.abs(sp).toFixed(1)}</span><span class="rside"><b>${rv}</b> ${rn} (R)</span></div>${note?`<div class="small muted" style="padding:2px 12px 8px">${note}</div>`:''}`;};
  $('genElec').innerHTML=P.general.avg.map(a=>mu(a,a[4]+' · PollCheck')).join('')+`<div class="small muted" style="padding:8px 12px 2px">${P.general.singleNote}</div>`+P.general.single.map(a=>mu(a)).join('');
  $('briefs').innerHTML=P.briefs.map(b=>`<div class="brief"><h4>${b.t}</h4><ul>${b.pts.map(x=>`<li>${x}</li>`).join('')}</ul><a class="small" href="${b.src}" target="_blank" rel="noopener">Read more ↗</a></div>`).join('');
  $('polLinks').innerHTML=P.links.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join('');
  $('newsSeg').innerHTML=Object.entries(NEWS_TOPICS).map(([k,[n]])=>`<button data-n="${k}" class="${k===newsTopic?'on':''}">${n}</button>`).join('');
  $('newsSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{newsTopic=b.dataset.n; $('newsSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); loadNews();});
  loadNews();
}
const newsCache={};
async function loadNews(){
  const [name,q]=NEWS_TOPICS[newsTopic], el=$('newsList');
  el.innerHTML='<div class="news"><span class="spinner"></span> loading headlines…</div>';
  try{
    let arts=newsCache[newsTopic];
    if(!arts){
      const u=`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q+' sourcelang:english')}&mode=artlist&maxrecords=40&format=json&sort=datedesc&timespan=3d`;
      const r=await fetch(px(u)); if(!r.ok) throw 0; const j=await r.json(); const seen=new Set();
      arts=(j.articles||[]).filter(a=>{const k=a.title.toLowerCase().slice(0,60); if(seen.has(k))return false; seen.add(k); return true;}).slice(0,25);
      newsCache[newsTopic]=arts;
    }
    if(!arts.length) throw 0;
    el.innerHTML=arts.map(a=>{const d=a.seendate?new Date(a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,'$1-$2-$3T$4:$5:$6Z')):null;
      return `<a class="news" href="${a.url}" target="_blank" rel="noopener"><b>${a.title.replace(/</g,'&lt;')}</b><small>${a.domain||''}${d?' · '+d.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''}</small></a>`;}).join('');
  }catch(e){
    el.innerHTML=`<div class="news">Couldn't load live headlines for ${name} right now. Try these instead:</div>`+
      [['AP News','https://apnews.com/'],['Reuters','https://www.reuters.com/world/'],['Google News: '+name,'https://news.google.com/search?q='+encodeURIComponent(name)]].map(([n,u])=>`<a class="news" href="${u}" target="_blank" rel="noopener"><b>${n} ↗</b></a>`).join('');
  }
}


/* =========================================================
   14) SHARED: proxy hook, toast, locations, theme, alerts
   ========================================================= */
// When hosted, point this at your proxy (see server/worker.js), e.g. 'https://wx-proxy.you.workers.dev/?url='
const PROXY = window.STORMDESK_PROXY || '';
const px = u => PROXY ? PROXY + encodeURIComponent(u) : u;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(window._tt); window._tt=setTimeout(()=>t.classList.remove('show'),2200); }
const median=a=>{const s=a.filter(x=>x!=null&&isFinite(x)).sort((x,y)=>x-y); return s.length?(s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2):null;};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function getLocs(){try{return JSON.parse(store.get('wx.locs'))||[]}catch(e){return []}}
function saveLoc(loc){ const l=getLocs().filter(x=>x.zip!==loc.zip); l.unshift(loc); store.set('wx.locs',JSON.stringify(l.slice(0,8))); renderLocChip(); }
function useLoc(loc){ store.set('wx.loc',JSON.stringify(loc)); store.set('wx.zip',loc.zip); saveLoc(loc); location.reload(); }
function renderLocChip(){
  const L=getLoc(); $('locChip').innerHTML=`📍 <span>${L?esc(L.name):'Set location'}</span> ▾`;
  const others=getLocs();
  $('locMenu').innerHTML=(others.length?others.map(l=>`<button class="ditem" data-zip="${l.zip}"><span class="dic">${L&&l.zip===L.zip?'✅':'📍'}</span><span><b>${esc(l.name)}</b><small>${l.zip}</small></span></button>`).join(''):'<p class="small muted" style="padding:8px">No saved places yet.</p>')+
    `<div class="row" style="padding:8px;border-top:1px solid var(--line)"><input type="text" id="locAdd" placeholder="Add ZIP" maxlength="5" inputmode="numeric" style="width:110px"><button class="btn" id="locAddGo">Add &amp; switch</button></div>
     ${others.length>1?'<button class="btn" id="locClear" style="margin:0 8px 8px">Clear saved places</button>':''}<div class="small muted" id="locAddMsg" style="padding:0 8px 8px"></div>`;
  $('locMenu').querySelectorAll('[data-zip]').forEach(b=>b.onclick=()=>useLoc(getLocs().find(x=>x.zip===b.dataset.zip)));
  $('locAddGo').onclick=async()=>{const z=$('locAdd').value.trim(); if(!/^\d{5}$/.test(z)){$('locAddMsg').textContent='Enter a 5-digit ZIP.';return;}
    $('locAddMsg').textContent='Looking up…'; try{useLoc(await geocodeZip(z));}catch(e){$('locAddMsg').textContent=e.message;}};
  $('locAdd').onkeydown=e=>{if(e.key==='Enter')$('locAddGo').click();};
  if($('locClear')) $('locClear').onclick=()=>{store.set('wx.locs',JSON.stringify(L?[L]:[])); renderLocChip();};
}
$('locChip').onclick=e=>{e.stopPropagation(); $('locMenu').classList.toggle('open');};
document.addEventListener('click',e=>{ if(!e.target.closest('#locMenu')&&!e.target.closest('#locChip')) $('locMenu').classList.remove('open'); });

function applyTheme(t){ document.documentElement.dataset.theme=t; $('themeBtn').textContent=t==='light'?'🌙':'☀️'; $('themeBtn').title=t==='light'?'Dark theme':'Light theme'; store.set('wx.theme',t); }
$('themeBtn').onclick=()=>applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light');
applyTheme(store.get('wx.theme')||'dark');

let ALERTS=[];
const SEV={Extreme:'#7f1d1d',Severe:'#b91c1c',Moderate:'#c2410c',Minor:'#a16207'};
async function checkAlerts(){
  const L=getLoc(); if(!L) return;
  try{
    const j=await (await fetch(`https://api.weather.gov/alerts/active?point=${L.lat},${L.lon}`)).json();
    ALERTS=(j.features||[]).map(x=>x.properties); renderAlertBar();
    if(store.get('wx.notify')==='1' && 'Notification' in window && Notification.permission==='granted'){
      const seen=new Set(JSON.parse(store.get('wx.seen')||'[]'));
      ALERTS.forEach(a=>{ if(!seen.has(a.id)){ try{ new Notification(`${a.event} · ${L.name}`,{body:a.headline||''}); }catch(e){} seen.add(a.id);} });
      store.set('wx.seen',JSON.stringify([...seen].slice(-60)));
    }
    if(inited.home) renderHomeAlerts();
  }catch(e){}
}
function renderAlertBar(){
  const bar=$('alertBar'), n=ALERTS.length; $('alertBadge').textContent=n||''; $('alertBadge').style.display=n?'':'none';
  if(!n){bar.style.display='none';return;}
  const ev=[...new Set(ALERTS.map(a=>a.event))];
  bar.style.display=''; bar.style.background=SEV[ALERTS[0].severity]||'#7f1d1d';
  bar.innerHTML=`<span>⚠ <b>${ev.map(esc).join(' · ')}</b> in effect for ${esc(getLoc().name)}</span><a href="#" data-goto="local">Details</a>`;
}
async function enableNotify(){
  if(!('Notification' in window)){ toast('This browser does not support notifications.'); return; }
  const p=await Notification.requestPermission(); store.set('wx.notify',p==='granted'?'1':'0');
  toast(p==='granted'?'Alert notifications on for this browser.':'Notifications were not allowed.'); if(p==='granted') checkAlerts();
}
setInterval(checkAlerts, 5*60e3);

/* =========================================================
   15) STORM TOTALS ENGINE (multi-model, Kuchera, ice)
   ========================================================= */
const STORM_MODELS=[['gfs_seamless','GFS'],['ecmwf_ifs025','ECMWF'],['ecmwf_aifs025_single','ECMWF AIFS'],['gem_seamless','CMC (GEM)'],['icon_seamless','ICON'],
  ['ukmo_seamless','UKMO'],['ncep_nbm_conus','NBM'],['ncep_nam_conus','NAM 3 km'],['gfs_hrrr','HRRR'],['gfs_graphcast025','GraphCast'],['jma_seamless','JMA'],['meteofrance_seamless','ARPEGE']];
function kuchRatio(temps){ const ts=temps.filter(v=>v!=null&&isFinite(v)); if(!ts.length) return 10;
  const tk=(Math.max(...ts)-32)*5/9+273.15; const r= tk>271.16 ? 12+2*(271.16-tk) : 12+(271.16-tk); return Math.max(0,Math.min(r,30)); }
const stormCache={};
async function stormData(loc){
  const k=loc.lat+','+loc.lon; if(stormCache[k]) return stormCache[k];
  const full='precipitation,rain,showers,snowfall,temperature_2m,apparent_temperature,wind_gusts_10m,temperature_925hPa,temperature_850hPa,temperature_700hPa';
  const basic='precipitation,rain,showers,snowfall,temperature_2m,apparent_temperature,wind_gusts_10m';
  const one=async(id,name)=>{ for(const vars of [full,basic]){ try{
      const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=${vars}&models=${id}&forecast_days=10&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph`);
      if(!r.ok) continue; const j=await r.json(); if(!j.hourly||!(j.hourly.precipitation||[]).some(v=>v!=null)) return null;
      const off=(j.utc_offset_seconds||0)*1000; return {id,name,h:j.hourly,ms:j.hourly.time.map(s=>Date.parse(s+'Z')-off)};
    }catch(e){} } return null; };
  const p=Promise.all(STORM_MODELS.map(([id,n])=>one(id,n))).then(r=>r.filter(Boolean));
  stormCache[k]=p; return p;
}
function stormTotals(md,t0,t1){
  const h=md.h; let s10=0,sk=0,sn=0,ice=0,p=0,tmin=Infinity,gmax=0,chill=Infinity,any=false,last=-Infinity;
  for(let i=0;i<md.ms.length;i++){ const t=md.ms[i]; if(t<t0||t>=t1) continue; const pr=h.precipitation[i]; if(pr==null) continue; any=true; last=t;
    p+=pr; const sf=h.snowfall?.[i]||0, swe=sf/7; sn+=sf; s10+=swe*10;
    sk+=swe*kuchRatio([h.temperature_2m?.[i],h.temperature_925hPa?.[i],h.temperature_850hPa?.[i],h.temperature_700hPa?.[i]]);
    const liq=(h.rain?.[i]||0)+(h.showers?.[i]||0), T=h.temperature_2m?.[i]; if(liq>0&&T!=null&&T<=32) ice+=liq;
    if(T!=null) tmin=Math.min(tmin,T); const a=h.apparent_temperature?.[i]; if(a!=null) chill=Math.min(chill,a); const g=h.wind_gusts_10m?.[i]; if(g!=null) gmax=Math.max(gmax,g); }
  return any?{s10,sk,sn,ice,p,tmin:isFinite(tmin)?tmin:null,chill:isFinite(chill)?chill:null,gmax,partial:last<t1-3*3600e3}:null;
}
function snowDayCalc(mods){
  const now=new Date(), d=new Date(now); d.setHours(7,0,0,0); if(now>d) d.setDate(d.getDate()+1);
  while(d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()+1);
  const t1=d.getTime()+3600e3, t0=Math.max(Date.now(), t1-14*3600e3);
  const tots=mods.map(m=>stormTotals(m,t0,t1)).filter(Boolean); if(!tots.length) return null;
  const snow=median(tots.map(x=>x.sk)), ice=median(tots.map(x=>x.ice)), chill=median(tots.map(x=>x.chill)), agree=tots.filter(x=>x.sk>=2).length/tots.length;
  let s= snow>=8?90: snow>=6?80: snow>=4?65: snow>=2?40: snow>=1?20: snow>=0.3?8:2;
  if(ice>=0.25) s=Math.max(s,85); else if(ice>=0.1) s=Math.max(s,55); else if(ice>=0.03) s+=15;
  if(chill!=null&&chill<=-30) s=Math.max(s,70); else if(chill!=null&&chill<=-20) s+=15;
  s=Math.round(Math.max(1,Math.min(97, s*(0.65+0.35*agree)+(agree>0.7?5:0))));
  return {date:d,score:s,snow,ice,chill,n:tots.length,agree};
}
function snowDayHTML(sd){
  if(!sd) return '<p class="muted small">Not enough model data.</p>';
  const col=sd.score>=70?'var(--hot)':sd.score>=40?'var(--accent2)':sd.score>=15?'var(--accent)':'var(--muted)';
  const word=sd.score>=70?'Good chance':sd.score>=40?'Possible':sd.score>=15?'Long shot':'Unlikely';
  return `<div class="gauge"><div class="gring" style="--p:${sd.score};--c:${col}"><span>${sd.score}%</span></div>
    <div><div style="font-weight:800;font-size:16px;color:${col}">${word}</div><div class="small muted">${DOW[sd.date.getDay()]} ${MON[sd.date.getMonth()]} ${sd.date.getDate()} morning</div>
    <div class="small" style="margin-top:6px">Overnight snow (Kuchera, middle of ${sd.n} models): <b>${sd.snow.toFixed(1)}"</b><br>Ice: <b>${sd.ice.toFixed(2)}"</b> · Lowest wind chill: <b>${sd.chill!=null?Math.round(sd.chill)+'°':'–'}</b></div></div></div>
    <p class="small muted" style="margin:6px 0 0">Just for fun: a rough score from overnight snow, ice, wind chill and how many models agree. Not an official forecast.</p>`;
}

/* =========================================================
   16) HOME DASHBOARD
   ========================================================= */
function homeCard(id,title,extra='',wide=false){return `<div class="card hcard ${wide?'wide':''}"><div class="pol-h hh"><h3>${title}</h3>${extra}</div><div id="${id}" class="hbody"><span class="spinner"></span></div></div>`;}
function renderHomeAlerts(){
  const el=$('hAlerts'); if(!el) return; const notifyOn=store.get('wx.notify')==='1';
  el.innerHTML=(ALERTS.length?ALERTS.map(a=>`<div class="alert"><b>⚠ ${esc(a.event)}</b> · ${esc(a.headline||'')}</div>`).join(''):'<p class="muted" style="margin:0">No active NWS alerts. ✅</p>')+
   `<button class="btn" id="notifyBtn" style="margin-top:8px">${notifyOn?'🔔 Notifications on':'🔔 Notify me of new alerts'}</button>`;
  $('notifyBtn').onclick=enableNotify;
}
function polHome(){ const P=POLITICS;
  return `<div class="tick"><span>Trump approval <b>${P.approval.approve}%</b> / ${P.approval.disapprove}%</span><span style="color:#fca5a5">GOP: ${P.rep.list[0][0]} ${P.rep.list[0][1]} · ${P.rep.list[1][0]} ${P.rep.list[1][1]}</span><span style="color:#93c5fd">Dem: ${P.dem.list[0][0]} ${P.dem.list[0][1]} · ${P.dem.list[1][0]} ${P.dem.list[1][1]}</span><a href="#" data-goto="politics">Politics →</a></div>`; }
async function initHome(){
  const L=getLoc(), H=$('homeGrid');
  const links=`<div class="qlinks">${SECTIONS.flatMap(([,it])=>it).filter(x=>x[0]!=='home').map(([id,ic,n])=>`<button class="chip" data-goto="${id}">${ic} ${n}</button>`).join('')}</div>`;
  if(!L){
    H.innerHTML=`<div class="card hcard wide"><h3 style="margin-top:0">Welcome to StormDesk</h3><p class="muted">Enter your ZIP to set up your dashboard: current weather, alerts, model snow totals and snow-day odds.</p>
      <div class="zipbar"><input type="text" id="homeZip" placeholder="ZIP code" maxlength="5" inputmode="numeric"><button class="btn on" id="homeZipGo">Set location</button><span class="small muted" id="homeZipMsg"></span></div></div>
      <div class="card hcard wide">${links}</div><div class="card hcard wide">${polHome()}</div>`;
    $('homeZipGo').onclick=async()=>{const z=$('homeZip').value.trim(); if(!/^\d{5}$/.test(z)){$('homeZipMsg').textContent='Enter a 5-digit ZIP.';return;} try{useLoc(await geocodeZip(z));}catch(e){$('homeZipMsg').textContent=e.message;}};
    $('homeZip').onkeydown=e=>{if(e.key==='Enter')$('homeZipGo').click();}; return;
  }
  H.innerHTML=`<div class="card hcard wide">${polHome()}</div>`+homeCard('hNow',`Now · ${esc(L.name)}`,'<a href="#" data-goto="local" class="small">20-day →</a>')+homeCard('hAlerts','Alerts')+
    homeCard('hSnow','Snow Next 7 Days · by Model','<a href="#" data-goto="winter" class="small">Winter Desk →</a>')+homeCard('hSnowDay','Snow Day Odds')+
    homeCard('hRadar','Radar','<a href="#" data-goto="radar" class="small">Full radar →</a>')+homeCard('hRuns','Model Run Status','<button class="btn" id="hRunsGo">Check now</button>')+
    `<div class="card hcard wide">${links}</div>`;
  renderHomeAlerts(); checkAlerts();
  $('hRuns').innerHTML='<p class="small muted" style="margin:0">Checks which forecast hours of the latest runs are out. Takes a few seconds.</p>'; $('hRunsGo').onclick=()=>renderRuns($('hRuns'));
  // now + 5 days
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum&forecast_days=6&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph`)
   .then(r=>r.json()).then(D=>{ const c=D.current, w=WMO[c.weather_code]||['',''];
     $('hNow').innerHTML=`<div class="nowbig"><span class="ico">${w[0]}</span><span class="t">${Math.round(c.temperature_2m)}°</span><span>${w[1]}<br><span class="small muted">Feels ${Math.round(c.apparent_temperature)}° · Wind ${Math.round(c.wind_speed_10m)} G${Math.round(c.wind_gusts_10m)} mph · RH ${c.relative_humidity_2m}%</span></span></div>
      <div class="mini5">${D.daily.time.slice(0,6).map((t,i)=>{const d=new Date(t+'T12:00'),x=D.daily,ww=WMO[x.weather_code[i]]||['',''];
        return `<div><b>${i?DOW[d.getDay()]:'Today'}</b><span class="ico">${ww[0]}</span><span><span class="hi">${Math.round(x.temperature_2m_max[i])}°</span> <span class="lo">${Math.round(x.temperature_2m_min[i])}°</span></span><small>💧${x.precipitation_probability_max[i]??'–'}%${x.snowfall_sum[i]>=0.1?` ❄${x.snowfall_sum[i].toFixed(1)}"`:''}</small></div>`;}).join('')}</div>`; })
   .catch(()=>$('hNow').textContent='Current conditions unavailable.');
  // radar
  (async()=>{ let st=L.radar; if(!st){ try{ const p=await (await fetch(`https://api.weather.gov/points/${L.lat},${L.lon}`)).json(); st=p.properties.radarStation; if(st){ L.radar=st; store.set('wx.loc',JSON.stringify(L)); } }catch(e){} }
    $('hRadar').innerHTML=st?`<img src="https://radar.weather.gov/ridge/standard/${st}_loop.gif?t=${Math.floor(Date.now()/120000)}" alt="Radar" style="width:100%;border-radius:6px" onerror="this.outerHTML='<p class=muted>Radar loop unavailable.</p>'"><div class="small muted">${st} loop</div>`:'<p class="muted">Radar site not found.</p>'; })();
  // snow totals + snow day
  stormData(L).then(mods=>{
    const t0=Date.now(), t1=t0+7*864e5; const rows=mods.map(m=>({n:m.name,t:stormTotals(m,t0,t1)})).filter(r=>r.t).sort((a,b)=>b.t.sk-a.t.sk);
    const max=Math.max(1,...rows.map(r=>r.t.sk));
    $('hSnow').innerHTML=rows.length?rows.map(r=>`<div class="hbar"><span>${r.n}</span><span class="bar"><i style="width:${r.t.sk/max*100}%"></i></span><b>${r.t.sk.toFixed(1)}"</b></div>`).join('')+`<p class="small muted" style="margin:6px 0 0">Kuchera snowfall (adjusts snow ratio for temperature). Middle of models: <b>${median(rows.map(r=>r.t.sk)).toFixed(1)}"</b>. Short-range models (HRRR, NAM) only cover 2–3 days.</p>`:'<p class="muted">No model data right now.</p>';
    $('hSnowDay').innerHTML=snowDayHTML(snowDayCalc(mods));
  }).catch(()=>{$('hSnow').textContent='Model data unavailable.';});
}

/* =========================================================
   17) MODEL RUN STATUS (probes NCEP MAG folders + ECMWF)
   ========================================================= */
function imgExists(u){return new Promise(res=>{const i=new Image(); const to=setTimeout(()=>res(false),9000); i.onload=()=>{clearTimeout(to);res(true)}; i.onerror=()=>{clearTimeout(to);res(false)}; i.src=u;});}
const RUN_CHECK=[['gfs','500_vort_ht'],['aigfs','500_vort_ht'],['hrrr','500_vort_ht'],['rrfs','500_vort_ht'],['rap','500_vort_ht'],['nbm','2m_temp_10m_wnd']];
let runCache=null, runCacheT=0;
async function runOne(key,param){
  const m=MODELS[key]; const area=Object.keys(m.areas)[0];
  const cands=m.cycles.slice().sort((a,b)=>cycleDate(b,0.5)-cycleDate(a,0.5)).slice(0,2);
  for(const c of cands){ const hrs=m.hours(c), u=fh=>magUrl(m.dir,c,area,param,fh);
    if(!await imgExists(u(hrs[0]))) continue;
    if(await imgExists(u(hrs[hrs.length-1]))) return {name:m.name,c,fh:hrs[hrs.length-1],max:hrs[hrs.length-1],done:true};
    let lo=0,hi=hrs.length-1; while(hi-lo>1){const mid=(lo+hi)>>1; if(await imgExists(u(hrs[mid]))) lo=mid; else hi=mid;}
    return {name:m.name,c,fh:hrs[lo],max:hrs[hrs.length-1],done:false}; }
  return {name:m.name,none:true};
}
async function runEcmwf(){
  const c=[0,12].sort((a,b)=>cycleDate(b,6)-cycleDate(a,6))[0], base=cycleDate(c,6), iso=d=>d.toISOString().slice(0,19)+'Z';
  const ok=async fh=>{ try{ const r=await fetch(px(`https://charts.ecmwf.int/opencharts-api/v1/products/medium-z500-t850/?base_time=${iso(base)}&valid_time=${iso(new Date(base.getTime()+fh*3600e3))}&projection=opencharts_north_america`)); return r.ok; }catch(e){ return null; } };
  for(const fh of [360,240,144,72,24,0]){ const r=await ok(fh); if(r===null) return {name:'ECMWF',none:true,err:true}; if(r) return {name:'ECMWF',c,fh,max:360,done:fh===360}; }
  return {name:'ECMWF',none:true};
}
async function renderRuns(el){
  if(runCache&&Date.now()-runCacheT<10*60e3){ el.innerHTML=runCache; return; }
  el.innerHTML='<span class="spinner"></span> checking model folders…';
  const res=await Promise.all([...RUN_CHECK.map(([k,p])=>runOne(k,p)), runEcmwf()]);
  const html=`<table class="t"><tr><th>Model</th><th>Run</th><th>Out to</th><th></th></tr>`+res.map(r=>r.none?`<tr><td>${r.name}</td><td colspan="3" class="muted">${r.err?'could not check from this page':'no recent run found'}</td></tr>`:
    `<tr><td><b>${r.name}</b></td><td>${pad2(r.c)}Z</td><td>f${pad3(r.fh)} / f${pad3(r.max)}</td><td><span class="runbar"><i style="width:${Math.round(r.fh/r.max*100)}%;background:${r.done?'var(--good)':'var(--accent2)'}"></i></span> ${r.done?'✓':Math.round(r.fh/r.max*100)+'%'}</td></tr>`).join('')+
    `</table><p class="small muted" style="margin:6px 0 0">Checked ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}. A folder can briefly still hold yesterday's run of the same hour, so a "✓" right at run time may be the old one.</p>`;
  runCache=html; runCacheT=Date.now(); el.innerHTML=html;
}

/* =========================================================
   18) WINTER DESK
   ========================================================= */
const WD={win:'5d'}; const WINS={'24h':1,'48h':2,'3d':3,'5d':5,'7d':7,'10d':10};
const ROADS={IA:'https://511ia.org/',MN:'https://511mn.org/',WI:'https://511wi.gov/',IL:'https://www.gettingaroundillinois.com/',PA:'https://www.511pa.com/',NY:'https://511ny.org/',
  CO:'https://www.cotrip.org/',TX:'https://drivetexas.org/',OH:'https://www.ohgo.com/',NE:'https://511.nebraska.gov/',SD:'https://www.sd511.org/',KS:'https://www.kandrive.gov/'};
async function initWinter(){
  const L=getLoc(), M=$('winterMain');
  if(!L){ M.innerHTML=`<div class="card"><h3>Set your location first</h3><p class="muted">Pick a ZIP from 📍 at the top, or on the <a href="#" data-goto="home">Home</a> tab.</p></div>`; return; }
  const st=(L.name.split(', ')[1]||'').trim();
  M.innerHTML=`
  <div class="viewer-head"><div><div class="viewer-title">Winter Desk · ${esc(L.name)}</div><div class="small muted">Every model's snow, ice and cold for your ZIP, side by side.</div></div>
    <div class="seg" id="wdWin">${Object.keys(WINS).map(k=>`<button data-w="${k}" class="${k===WD.win?'on':''}">${k}</button>`).join('')}</div></div>
  <div class="pol-top" id="wdStats"></div>
  <div class="grid g2">
    <div class="card pol"><div class="pol-h"><h3>Storm Totals by Model</h3><span class="pill">from now</span></div><div class="scrollx"><table class="t" id="wdTable"><tr><td><span class="spinner"></span> loading ${STORM_MODELS.length} models…</td></tr></table></div>
      <p class="small muted" style="padding:0 12px">Kuchera adjusts the snow ratio for how cold the air column is: fluffier snow in very cold air, wetter near freezing. 10:1 assumes 10" of snow per 1" of water. Ice is freezing rain liquid (rain with the surface at or below 32°F); actual ice buildup is usually a bit less.</p></div>
    <div>
      <div class="card pol"><div class="pol-h"><h3>Kuchera Snow by Model</h3></div><div id="wdBars" style="padding:8px 12px"></div></div>
      <div class="card pol"><div class="pol-h"><h3>Ensemble Snow Odds</h3><span class="pill">GEFS · ECMWF · GEPS</span></div><div id="wdEns" style="padding:8px 12px"><span class="spinner"></span></div></div>
      <div class="card pol"><div class="pol-h"><h3>Snow Day Odds</h3></div><div id="wdSnowDay" style="padding:8px 12px"><span class="spinner"></span></div></div>
    </div>
  </div>
  <div class="card pol"><div class="pol-h"><h3>Model Trend (run-to-run)</h3><span class="pill">same window, earlier runs</span></div><div id="wdTrend" style="padding:8px 12px"><span class="spinner"></span></div></div>
  <div class="card pol"><div class="pol-h"><h3>Run-to-Run Maps</h3><div class="row"><select id="rrModel"><option value="gfs">GFS</option><option value="aigfs">AIGFS</option><option value="gefsmean">GEFS mean</option></select><select id="rrParam"></select><select id="rrValid"></select></div></div>
    <div class="grid g2 gal" id="rrGal" style="padding:10px"></div><p class="small muted" style="padding:0 12px 10px">The last 4 runs for the same valid time. Watch how the storm shifts from run to run.</p></div>
  <div class="grid g3">
    <div class="card pol"><div class="pol-h"><h3>Storm Tracks</h3></div><div style="padding:10px 12px" class="small">
      <p style="margin-top:0">See where the ensemble members put the low-pressure center:</p>
      <button class="btn" id="wdTracks">GEFS sea-level pressure spaghetti →</button>
      <p><a href="https://charts.ecmwf.int/products/medium-mslp-wind850" target="_blank" rel="noopener">ECMWF pressure charts ↗</a> · <a href="https://www.wpc.ncep.noaa.gov/medr/medr.shtml" target="_blank" rel="noopener">WPC days 3–7 fronts ↗</a></p></div></div>
    <div class="card pol"><div class="pol-h"><h3>Ice Threat (WPC)</h3></div><div class="gal" id="wdIce" style="padding:10px"></div></div>
    <div class="card pol"><div class="pol-h"><h3>Roads &amp; Cameras · ${esc(st)}</h3></div><div style="padding:10px 12px" class="small">
      ${ROADS[st]?`<p style="margin-top:0"><a class="btn" href="${ROADS[st]}" target="_blank" rel="noopener">${st} 511 road conditions &amp; cameras ↗</a></p>`:''}
      <p><a href="https://www.google.com/search?q=${encodeURIComponent(st+' 511 road conditions traffic cameras')}" target="_blank" rel="noopener">Find ${esc(st)} road conditions ↗</a></p>
      <p><a href="https://www.fhwa.dot.gov/trafficinfo/" target="_blank" rel="noopener">FHWA traffic &amp; road info by state ↗</a></p>
      <p><a href="https://www.weather.gov/wwamap/" target="_blank" rel="noopener">NWS national alerts map ↗</a></p></div></div>
  </div>`;
  $('wdWin').querySelectorAll('button').forEach(b=>b.onclick=()=>{WD.win=b.dataset.w; $('wdWin').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); renderWinterTables(); renderEnsOdds(); renderTrend();});
  $('wdTracks').onclick=()=>{ showTab('spaghetti'); setTimeout(()=>{ $('spParam').value='mslp_1000_1040_iso'; spLoop.go(spLoop.idx); },50); };
  const ice=[1,2,3].map(d=>[`Day ${d} freezing rain ≥ 0.25"`,`https://www.wpc.ncep.noaa.gov/wwd/day${d}_pice_gt_25_conus.gif`,'https://www.wpc.ncep.noaa.gov/wwd/winter_wx.shtml']);
  gallery($('wdIce'),ice);
  // run-to-run maps
  const fillRR=()=>{ const m=MODELS[$('rrModel').value]||ENS_MODELS[$('rrModel').value]; const all=Object.assign({},...Object.values(m.params));
    const pref=['precip_p06','precip_ptot','1000_500_thick','500_vort_ht','mslp','snodpth_chng'];
    $('rrParam').innerHTML=Object.entries(all).map(([p,l])=>`<option value="${p}">${l}</option>`).join(''); $('rrParam').value=pref.find(p=>all[p])||Object.keys(all)[0];
    const now=new Date(); now.setUTCMinutes(0,0,0); now.setUTCHours(Math.ceil(now.getUTCHours()/6)*6);
    $('rrValid').innerHTML=range(1,40).map(k=>{const v=new Date(now.getTime()+k*6*3600e3); return `<option value="${v.getTime()}" ${k===8?'selected':''}>Valid ${fmtZ(v)}</option>`;}).join('');
    drawRR(); };
  const drawRR=()=>{ const key=$('rrModel').value, m=MODELS[key]||ENS_MODELS[key], valid=+$('rrValid').value, area=Object.keys(m.areas)[0];
    const cyc=m.cycles.slice().sort((a,b)=>cycleDate(b,m.latency)-cycleDate(a,m.latency)).slice(0,4);
    const items=cyc.map(c=>{ const init=cycleDate(c,m.latency), fh=Math.round((valid-init)/3600e3); return {c,init,fh,ok:m.hours(c).includes(fh)}; });
    $('rrGal').innerHTML=items.map((it,k)=>it.ok?`<div class="card"><figure><img src="${magUrl(m.dir,it.c,area,$('rrParam').value,it.fh)}" alt="run" onerror="this.outerHTML='<div class=broken>Not available yet</div>'"><figcaption><span><b>${k===0?'Newest':k===1?'Previous':k+' runs back'}</b> · ${fmtZ(it.init)} run · f${pad3(it.fh)}</span></figcaption></figure></div>`:
      `<div class="card"><div class="broken">${fmtZ(it.init)} run doesn't reach this time (f${pad3(it.fh)}).</div></div>`).join(''); };
  $('rrModel').onchange=fillRR; $('rrParam').onchange=drawRR; $('rrValid').onchange=drawRR; fillRR();
  try{ WD.mods=await stormData(L); }catch(e){ WD.mods=[]; }
  renderWinterTables(); $('wdSnowDay').innerHTML=snowDayHTML(snowDayCalc(WD.mods)); renderEnsOdds(); renderTrend();
}
function wdWindow(){ const t0=Date.now(); return [t0, t0+WINS[WD.win]*864e5]; }
function renderWinterTables(){
  const mods=WD.mods||[]; const [t0,t1]=wdWindow();
  const rows=mods.map(m=>({n:m.name,t:stormTotals(m,t0,t1)})).filter(r=>r.t).sort((a,b)=>b.t.sk-a.t.sk);
  if(!rows.length){ $('wdTable').innerHTML='<tr><td>Model data unavailable right now.</td></tr>'; $('wdStats').innerHTML=''; $('wdBars').innerHTML=''; return; }
  const f=(v,d=1)=>v==null?'–':v.toFixed(d);
  $('wdTable').innerHTML=`<tr><th>Model</th><th>Kuchera</th><th>10:1</th><th>Model snow</th><th>Ice</th><th>Precip</th><th>Low</th><th>Wind chill</th><th>Gust</th></tr>`+
    rows.map(r=>`<tr><td><b>${r.n}</b>${r.t.partial?' <span class="muted" title="Model run ends before this window does">*</span>':''}</td><td class="lead" style="color:var(--snow)">${f(r.t.sk)}"</td><td>${f(r.t.s10)}"</td><td>${f(r.t.sn)}"</td>
      <td ${r.t.ice>=0.25?'style="color:var(--hot);font-weight:800"':''}>${f(r.t.ice,2)}"${r.t.ice>=0.25?' ⚠':''}</td><td>${f(r.t.p,2)}"</td><td>${r.t.tmin!=null?Math.round(r.t.tmin)+'°':'–'}</td><td>${r.t.chill!=null?Math.round(r.t.chill)+'°':'–'}</td><td>${Math.round(r.t.gmax)}</td></tr>`).join('');
  const ks=rows.map(r=>r.t.sk), ices=rows.map(r=>r.t.ice), maxI=Math.max(...ices);
  $('wdStats').innerHTML=`<div class="stat"><div class="k">Consensus snow (middle model)</div><div class="v" style="color:var(--snow)">${median(ks).toFixed(1)}"</div><div class="s">Kuchera · next ${WD.win}</div></div>
    <div class="stat"><div class="k">Model range</div><div class="v">${Math.min(...ks).toFixed(1)}–${Math.max(...ks).toFixed(1)}"</div><div class="s">${rows[rows.length-1].n} low · ${rows[0].n} high</div></div>
    <div class="stat"><div class="k">Models with 1"+ / 6"+</div><div class="v">${ks.filter(x=>x>=1).length} / ${ks.filter(x=>x>=6).length}</div><div class="s">of ${rows.length} models</div></div>
    <div class="stat"><div class="k">Ice threat</div><div class="v" style="color:${maxI>=0.25?'var(--hot)':maxI>=0.1?'var(--accent2)':'var(--text)'}">${maxI>=0.25?'⚠ Significant':maxI>=0.1?'Moderate':maxI>=0.01?'Light':'None'}</div><div class="s">Highest model: ${maxI.toFixed(2)}" freezing rain</div></div>`;
  const max=Math.max(1,...ks);
  $('wdBars').innerHTML=rows.map(r=>`<div class="hbar"><span>${r.n}</span><span class="bar"><i style="width:${r.t.sk/max*100}%"></i></span><b>${r.t.sk.toFixed(1)}"</b></div>`).join('')+(rows.some(r=>r.t.partial)?'<p class="small muted">* that model\'s run ends before this window does.</p>':'');
}
async function renderEnsOdds(){
  const L=getLoc(), el=$('wdEns'); if(!el) return; const [t0,t1]=wdWindow();
  const res=await Promise.all(['gefs','ecmwf','gem'].map(k=>fetchEnsemble(k,L.lat,L.lon,'temperature_2m,precipitation,snowfall').then(j=>({k,j})).catch(()=>null)));
  const rows=[]; let all=[];
  res.filter(Boolean).forEach(({k,j})=>{ const off=(j.utc_offset_seconds||0)*1000, ms=j.hourly.time.map(s=>Date.parse(s+'Z')-off); const S=members(j.hourly,'snowfall');
    const tots=S.map(m=>{let s=0,n=0; ms.forEach((t,i)=>{ if(t>=t0&&t<t1&&m.y[i]!=null){s+=m.y[i]; n++;} }); return n?s:null;}).filter(v=>v!=null);
    if(!tots.length) return; all=all.concat(tots); rows.push([ENS_IDS[k].label,tots]); });
  if(!all.length){ el.innerHTML='<p class="muted small">Ensemble data unavailable.</p>'; return; }
  const pr=(a,th)=>Math.round(100*a.filter(x=>x>=th).length/a.length);
  el.innerHTML=`<table class="t"><tr><th>Ensemble</th><th>Runs</th><th>≥1"</th><th>≥3"</th><th>≥6"</th><th>≥12"</th><th>Middle run</th></tr>`+
    [...rows,['All combined',all]].map(([n,a])=>`<tr><td>${n}</td><td>${a.length}</td>${[1,3,6,12].map(th=>`<td class="snowpct">${pr(a,th)}%</td>`).join('')}<td>${median(a).toFixed(1)}"</td></tr>`).join('')+
    `</table><p class="small muted" style="margin:6px 0 0">Share of ensemble runs with at least that much snow in the window (model snowfall). ECMWF runs to 15 days, GEPS to 16.</p>`;
}
const trendCache={};
async function renderTrend(){
  const L=getLoc(), el=$('wdTrend'); if(!el) return; const [t0,t1]=wdWindow();
  const ids=[['gfs_seamless','GFS'],['ecmwf_ifs025','ECMWF'],['gem_seamless','CMC'],['icon_seamless','ICON']];
  const vars=['snowfall','precipitation'].flatMap(v=>[v,...[1,2,3].map(d=>`${v}_previous_day${d}`)]).join(',');
  const res=await Promise.all(ids.map(async([id,n])=>{ const k=id+L.lat+L.lon; try{ if(!trendCache[k]){ const r=await fetch(`https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&hourly=${vars}&models=${id}&past_days=1&forecast_days=10&timezone=auto&precipitation_unit=inch`); if(!r.ok) return null; trendCache[k]=await r.json(); }
    const j=trendCache[k], off=(j.utc_offset_seconds||0)*1000, ms=j.hourly.time.map(s=>Date.parse(s+'Z')-off);
    const sum=key=>{ const a=j.hourly[key]; if(!a) return null; let s=0,any=false; ms.forEach((t,i)=>{ if(t>=t0&&t<t1&&a[i]!=null){s+=a[i]; any=true;} }); return any?s:null; };
    return {n, snow:['snowfall',...[1,2,3].map(d=>'snowfall_previous_day'+d)].map(sum), pcp:['precipitation',...[1,2,3].map(d=>'precipitation_previous_day'+d)].map(sum)}; }catch(e){ return null; } }));
  const ok=res.filter(Boolean); if(!ok.length){ el.innerHTML='<p class="muted small">Trend data unavailable right now.</p>'; return; }
  const cell=(arr,i,d)=>{ const v=arr[i]; if(v==null) return '<td class="muted">–</td>'; const prev=arr[i+1]; const ch=prev!=null?v-prev:null;
    return `<td>${v.toFixed(d)}"${i===0&&prev!=null&&Math.abs(ch)>=(d===1?0.5:0.05)?` <span class="${ch>0?'up':'down'}">${ch>0?'▲':'▼'}</span>`:''}</td>`; };
  el.innerHTML=`<div class="scrollx"><table class="t"><tr><th>Model</th><th>Latest run</th><th>1 day ago</th><th>2 days ago</th><th>3 days ago</th><th></th><th>Precip latest</th><th>1 day ago</th><th>2 days ago</th></tr>`+
    ok.map(r=>`<tr><td><b>${r.n}</b></td>${[0,1,2,3].map(i=>cell(r.snow,i,1)).join('')}<td></td>${[0,1,2].map(i=>cell(r.pcp,i,2)).join('')}</tr>`).join('')+
    `</table></div><p class="small muted" style="margin:6px 0 0">Model snowfall for the same ${WD.win} window, as forecast by the newest run versus runs from 1–3 days earlier. ▲/▼ shows the latest change. Steady numbers mean the models are locking in.</p>`;
}

/* =========================================================
   19) SOUNDINGS (Skew-T from model pressure levels)
   ========================================================= */
const LEVELS=[1000,975,950,925,900,850,800,750,700,650,600,550,500,450,400,350,300,250,200];
const SND_MODELS=[['gfs_seamless','GFS'],['ecmwf_ifs025','ECMWF IFS'],['gem_seamless','CMC (GEM)'],['icon_seamless','ICON'],['ncep_nam_conus','NAM 3 km'],['gfs_hrrr','HRRR'],['ukmo_seamless','UKMO'],['ecmwf_aifs025_single','ECMWF AIFS'],['meteofrance_seamless','ARPEGE'],['jma_seamless','JMA']];
const SD={model:'gfs_seamless',idx:0,data:{},timer:null};
function initSounding(){
  const L=getLoc(), M=$('sndMain');
  if(!L){ M.innerHTML=`<div class="card"><h3>Set your location first</h3><p class="muted">Pick a ZIP from 📍 at the top.</p></div>`; return; }
  M.innerHTML=`<div class="viewer-head"><div><div class="viewer-title">Model Sounding · ${esc(L.name)}</div><div class="small muted">Temperature and dewpoint up through the atmosphere. Shows whether snow, sleet, freezing rain or rain is likely.</div></div>
    <div class="row"><label class="lbl">Model<select id="sndModel">${SND_MODELS.map(([id,n])=>`<option value="${id}">${n}</option>`).join('')}</select></label></div></div>
   <div class="snd-grid"><div class="card" style="padding:6px"><canvas id="sndCv" style="width:100%;height:620px;display:block"></canvas></div>
     <div><div class="card"><h3>Precip-type read</h3><div id="sndRead"><span class="spinner"></span></div></div>
       <div class="card" style="margin-top:12px"><h3>Levels</h3><div class="scrollx"><table class="t" id="sndTable"></table></div></div></div></div>
   <div class="timebar"><div class="row"><button class="btn" id="sndPrev">◀</button><button class="btn play" id="sndPlay">▶ Play</button><button class="btn" id="sndNext">▶</button></div><div class="tl" id="sndHours"></div></div>
   <div class="validline" id="sndValid"></div>
   <p class="small muted">Red = temperature, green = dewpoint, blue dashed = 0 °C (32 °F). Data comes from model pressure levels via Open-Meteo, so it's smoother than a full-resolution sounding.</p>`;
  $('sndModel').value=SD.model; $('sndModel').onchange=()=>{SD.model=$('sndModel').value; loadSounding();};
  $('sndPrev').onclick=()=>{sndStop(); sndGo(SD.idx-1);}; $('sndNext').onclick=()=>{sndStop(); sndGo(SD.idx+1);};
  $('sndPlay').onclick=()=>{ if(SD.timer) return sndStop(); $('sndPlay').textContent='❚❚ Pause'; SD.timer=setInterval(()=>sndGo(SD.idx+1),500); };
  loadSounding();
}
function sndStop(){clearInterval(SD.timer); SD.timer=null; const b=$('sndPlay'); if(b) b.textContent='▶ Play';}
async function loadSounding(){
  const L=getLoc(); sndStop(); $('sndRead').innerHTML='<span class="spinner"></span> loading…';
  const key=SD.model+L.lat+L.lon;
  if(!SD.data[key]){
    const vars=['temperature_2m','dew_point_2m','surface_pressure','precipitation','snowfall','wind_speed_10m','wind_direction_10m',
      ...LEVELS.flatMap(p=>[`temperature_${p}hPa`,`dew_point_${p}hPa`,`wind_speed_${p}hPa`,`wind_direction_${p}hPa`,`geopotential_height_${p}hPa`])].join(',');
    try{ const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${L.lat}&longitude=${L.lon}&hourly=${vars}&models=${SD.model}&forecast_days=7&timezone=auto&wind_speed_unit=kn&precipitation_unit=inch`);
      const j=await r.json(); if(!r.ok||!j.hourly) throw new Error(j.reason||'unavailable'); SD.data[key]=j; }
    catch(e){ $('sndRead').textContent='This model\'s sounding data is unavailable right now. Try another model.'; return; }
  }
  const j=SD.data[key], H=j.hourly; SD.cur=j;
  let last=H.time.length-1; while(last>0&&H.temperature_850hPa[last]==null) last--;
  SD.n=last+1; const off=(j.utc_offset_seconds||0)*1000; SD.ms=H.time.map(s=>Date.parse(s+'Z')-off);
  const nowI=Math.max(0,SD.ms.findIndex(t=>t>=Date.now()-1800e3));
  let chips='',ld=''; for(let i=0;i<SD.n;i++){const d=new Date(SD.ms[i]); const k=d.toDateString(); if(k!==ld){ld=k; chips+=`<button data-i="${i}">${DOW[d.getDay()]} ${d.getDate()}</button>`;}}
  $('sndHours').innerHTML=`<div class="slider"><input type="range" min="0" max="${SD.n-1}" value="${nowI}"><span class="fh"></span></div><div class="daychips">${chips}</div>`;
  $('sndHours').querySelector('input').oninput=e=>{sndStop(); sndGo(+e.target.value);};
  $('sndHours').querySelectorAll('.daychips button').forEach(b=>b.onclick=()=>{sndStop(); sndGo(+b.dataset.i);});
  sndGo(nowI);
}
function sndProfile(H,i){
  const ps=H.surface_pressure?.[i]||1013; const pts=[{p:ps,t:H.temperature_2m[i],td:H.dew_point_2m[i],ws:H.wind_speed_10m?.[i],wd:H.wind_direction_10m?.[i],z:null,sfc:true}];
  LEVELS.forEach(p=>{ if(p>=ps-5) return; const t=H[`temperature_${p}hPa`]?.[i]; if(t==null) return;
    pts.push({p,t,td:H[`dew_point_${p}hPa`]?.[i],ws:H[`wind_speed_${p}hPa`]?.[i],wd:H[`wind_direction_${p}hPa`]?.[i],z:H[`geopotential_height_${p}hPa`]?.[i]}); });
  return pts;
}
function sndRead(pts,H,i){
  const sfc=pts[0], below500=pts.filter(x=>x.p>=500), warm=below500.filter(x=>!x.sfc&&x.t>0), warmMax=warm.length?Math.max(...warm.map(x=>x.t)):null;
  const coldBelow=warm.length?below500.filter(x=>x.p>Math.max(...warm.map(w=>w.p))&&x.t<=0).length:0;
  const pr=H.precipitation?.[i]||0, sn=H.snowfall?.[i]||0, sfcF=sfc.t*9/5+32;
  let type, why;
  if(sfc.t>1.5 && (!warmMax||warmMax>0)){ type='🌧️ Rain'; why=`Surface is ${Math.round(sfcF)}°F, above freezing.`; }
  else if(warmMax!=null && warmMax>0.5){
    if(sfc.t<=0 && coldBelow>=2){ type='🧊 Sleet'; why=`Warm layer up to +${warmMax.toFixed(1)}°C melts the snow, then a deep cold layer below refreezes it into ice pellets.`; }
    else if(sfc.t<=0.5){ type='⚠️ Freezing rain'; why=`Warm layer up to +${warmMax.toFixed(1)}°C melts the snow, and the shallow cold layer at the surface (${Math.round(sfcF)}°F) can't refreeze it, so it freezes on contact.`; }
    else { type='🌧️ Rain / mix'; why=`Warm layer aloft (+${warmMax.toFixed(1)}°C) and a surface near freezing.`; }
  } else if(sfc.t<=1.5){ type='❄️ Snow'; why=`The whole column is at or below freezing (surface ${Math.round(sfcF)}°F).`; }
  else { type='🌧️ Rain'; why='Above-freezing air through the low levels.'; }
  // freezing level
  let fz=null; for(let k=1;k<pts.length;k++){ const a=pts[k-1], b=pts[k]; if(a.t>0&&b.t<=0&&b.z!=null){ const za=a.z??0, f=a.t/(a.t-b.t); fz=za+(b.z-za)*f; break; } }
  const kr=kuchRatio(pts.filter(x=>x.p>=500).map(x=>x.t*9/5+32));
  return `<div style="font-size:20px;font-weight:800;margin-bottom:4px">${type}${pr<0.005?' <span class="small muted">(if precip falls)</span>':''}</div><p class="small" style="margin:0 0 8px">${why}</p>
   <div class="small">Precip this hour: <b>${pr.toFixed(2)}"</b>${sn>0?` · model snow ${sn.toFixed(1)}"`:''}<br>Surface: <b>${Math.round(sfcF)}°F</b>, dewpoint ${sfc.td!=null?Math.round(sfc.td*9/5+32)+'°F':'–'}<br>
   850 mb: <b>${(()=>{const x=pts.find(p=>p.p===850); return x?`${x.t.toFixed(1)}°C (${Math.round(x.t*9/5+32)}°F)`:'below ground';})()}</b><br>
   Freezing level: <b>${fz!=null?Math.round(fz*3.281).toLocaleString()+' ft':(sfc.t<=0?'at the surface':'–')}</b><br>Kuchera snow ratio: <b>${kr.toFixed(0)}:1</b></div>`;
}
function sndGo(i){
  if(!SD.cur) return; SD.idx=(i+SD.n)%SD.n; const H=SD.cur.hourly, pts=sndProfile(H,SD.idx);
  const rg=$('sndHours').querySelector('input'); rg.value=SD.idx; const d=new Date(SD.ms[SD.idx]);
  $('sndHours').querySelector('.fh').textContent=`${DOW[d.getDay()]} ${d.toLocaleTimeString([],{hour:'numeric'})}`;
  $('sndValid').innerHTML=`<b>${SND_MODELS.find(x=>x[0]===SD.model)[1]}</b> · Valid ${d.toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric'})} (${esc(getLoc().name)} time)`;
  drawSkewT($('sndCv'),pts); $('sndRead').innerHTML=sndRead(pts,H,SD.idx);
  $('sndTable').innerHTML='<tr><th>mb</th><th>Height</th><th>Temp</th><th>Dewpt</th><th>Wind</th></tr>'+pts.map(x=>`<tr><td>${x.sfc?'Sfc':x.p}</td><td>${x.z!=null?Math.round(x.z*3.281).toLocaleString()+' ft':'–'}</td><td style="color:${x.t>0?'#fca5a5':'#93c5fd'}">${x.t.toFixed(1)}°C</td><td>${x.td!=null?x.td.toFixed(1)+'°C':'–'}</td><td>${x.ws!=null?`${Math.round(x.wd)}° @ ${Math.round(x.ws)} kt`:'–'}</td></tr>`).join('');
}
function drawSkewT(cv,pts){
  const dpr=window.devicePixelRatio||1, W=cv.clientWidth, Hh=cv.clientHeight; cv.width=W*dpr; cv.height=Hh*dpr; const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  const L=44,R=70,T=12,B=26, pw=W-L-R, ph=Hh-T-B, P0=1050,P1=200, Tl=-40, Tr=40;
  const Y=p=>T+ph*(Math.log(P0)-Math.log(p))/(Math.log(P0)-Math.log(P1));
  const X=(t,p)=>L+(t-Tl)/(Tr-Tl)*pw+(T+ph-Y(p))*0.9;
  c.fillStyle='#0a1020'; c.fillRect(0,0,W,Hh); c.save(); c.beginPath(); c.rect(L,T,pw,ph); c.clip();
  c.font='10px Segoe UI, sans-serif';
  for(let t=-120;t<=50;t+=10){ c.strokeStyle=t===0?'rgba(96,165,250,.95)':'rgba(143,160,192,.18)'; c.lineWidth=t===0?2:1; c.setLineDash(t===0?[6,4]:[]); c.beginPath(); c.moveTo(X(t,P0),Y(P0)); c.lineTo(X(t,P1),Y(P1)); c.stroke(); }
  c.setLineDash([]);
  for(let th=-30;th<=170;th+=10){ c.strokeStyle='rgba(245,158,11,.14)'; c.beginPath(); let f=true; for(let p=P0;p>=P1;p-=10){ const t=(th+273.15)*Math.pow(p/1000,0.286)-273.15; const x=X(t,p),y=Y(p); f?c.moveTo(x,y):c.lineTo(x,y); f=false;} c.stroke(); }
  const line=(key,color)=>{ c.strokeStyle=color; c.lineWidth=3; c.beginPath(); let f=true; pts.forEach(q=>{ if(q[key]==null) return; const x=X(q[key],q.p),y=Y(q.p); f?c.moveTo(x,y):c.lineTo(x,y); f=false; }); c.stroke();
    c.fillStyle=color; pts.forEach(q=>{ if(q[key]==null) return; c.beginPath(); c.arc(X(q[key],q.p),Y(q.p),2.5,0,7); c.fill(); }); };
  line('td','#22c55e'); line('t','#ef4444'); c.restore();
  c.fillStyle='#8fa0c0'; c.strokeStyle='rgba(143,160,192,.25)';
  [1000,925,850,700,500,400,300,250,200].forEach(p=>{ const y=Y(p); c.beginPath(); c.moveTo(L,y); c.lineTo(L+pw,y); c.stroke(); c.fillText(p,6,y+4); });
  for(let t=-40;t<=40;t+=10){ const x=X(t,P0); if(x>L&&x<L+pw) c.fillText(`${t}°`,x-8,Hh-8); }
  // winds
  pts.forEach(q=>{ if(q.ws==null||q.wd==null) return; const y=Y(q.p), x=W-R+30, a=(q.wd+180)*Math.PI/180, len=Math.min(24,8+q.ws/4);
    c.strokeStyle='#e6ecf7'; c.lineWidth=1.5; c.beginPath(); c.moveTo(x,y); const ex=x+Math.sin(a)*len, ey=y-Math.cos(a)*len; c.lineTo(ex,ey); c.stroke();
    c.beginPath(); c.arc(ex,ey,2,0,7); c.fillStyle='#e6ecf7'; c.fill(); c.fillStyle='#8fa0c0'; c.fillText(Math.round(q.ws),W-R+44,y+4); });
  c.fillStyle='#8fa0c0'; c.fillText('kt',W-R+44,T+8);
}

/* =========================================================
   20) MODEL VIEWER EXTRAS: compare, share link, open image
   ========================================================= */
const CMP={on:false, model:'ecmwf_oc', param:null};
const cmpList=()=>Object.entries(MODELS).filter(([,v])=>v.kind==='mag'||v.kind==='ecmwf');
function cmpGuess(all){ const p=(MV.param||'').toLowerCase(); const keys=Object.keys(all);
  const tests=[[/snow|snod/,/snow|snod/],[/precip|rain|pcpn/,/precip|rain/],[/thick/,/thick|mslp/],[/mslp/,/mslp/],[/500/,/500/],[/850/,/850/],[/250|200|jet/,/250|200/],[/2m|2t/,/2m|2t/],[/cape/,/cape/],[/radar/,/radar|rain-rate/]];
  for(const [a,b] of tests) if(a.test(p)){ const k=keys.find(x=>b.test(x.toLowerCase())); if(k) return k; }
  return keys[0]; }
function fillCmp(){ $('cmpModel').innerHTML=cmpList().map(([k,v])=>`<option value="${k}" ${k===CMP.model?'selected':''}>${v.name}</option>`).join('');
  const m=MODELS[CMP.model], all=Object.assign({},...Object.values(m.params)); if(!all[CMP.param]) CMP.param=cmpGuess(all);
  $('cmpParam').innerHTML=Object.entries(all).map(([p,l])=>`<option value="${p}" ${p===CMP.param?'selected':''}>${l}</option>`).join(''); }
async function ecFetch(param,base,fh,area){ const [slug,level]=param.split('|'), iso=d=>d.toISOString().slice(0,19)+'Z', valid=new Date(base.getTime()+fh*3600e3);
  const key=`${slug}|${level}|${iso(base)}|${fh}|${area}`; if(ecCache[key]) return ecCache[key];
  const r=await fetch(px(`https://charts.ecmwf.int/opencharts-api/v1/products/${slug}/?base_time=${iso(base)}&valid_time=${iso(valid)}&projection=${area}${level?'&level='+level:''}`)); if(!r.ok) throw 0; const j=await r.json(); return ecCache[key]=j.data.link.href; }
function updateCmp(){
  if(!CMP.on) return; const main=MODELS[MV.model];
  if(!(main.kind==='mag'||main.kind==='ecmwf')||!mvLoop.hours){ $('cmpInfo').textContent='Compare works with the GFS, HRRR, RRFS, RAP, NBM, AIGFS and ECMWF image viewers.'; $('cmpWrap').classList.add('err'); return; }
  const fh=mvLoop.hours[mvLoop.idx], valid=cycleDate(+$('mvCycle').value,main.latency).getTime()+fh*3600e3;
  const m=MODELS[CMP.model], c=latestCycle(m.cycles,m.latency), init=cycleDate(c,m.latency), want=Math.round((valid-init.getTime())/3600e3);
  const hrs=m.hours(c); let h=hrs.includes(want)?want:null;
  if(h==null){ $('cmpWrap').classList.add('err'); $('cmpInfo').textContent=`${m.name} ${pad2(c)}Z run has no map at exactly that time (would be f${pad3(want)}).`; return; }
  $('cmpInfo').innerHTML=`<b>${m.name}</b> ${pad2(c)}Z run · f${pad3(h)} · same valid time`; $('cmpWrap').classList.remove('err');
  if(m.kind==='mag'){ const area=m.areas[MV.area]?MV.area:Object.keys(m.areas)[0]; $('cmpImg').src=magUrl(m.dir,c,area,CMP.param,h); }
  else ecFetch(CMP.param,init,h,Object.keys(m.areas)[0]).then(u=>{$('cmpImg').src=u;}).catch(()=>$('cmpWrap').classList.add('err'));
}
$('cmpImg').onload=()=>$('cmpWrap').classList.remove('err'); $('cmpImg').onerror=()=>$('cmpWrap').classList.add('err');
$('cmpBtn').onclick=()=>{ CMP.on=!CMP.on; $('cmpBtn').classList.toggle('on',CMP.on); $('viewPair').classList.toggle('two',CMP.on); $('cmpBox').style.display=CMP.on?'':'none';
  if(CMP.on){ if(CMP.model===MV.model) CMP.model=MV.model==='gfs'?'ecmwf_oc':'gfs'; CMP.param=null; fillCmp(); updateCmp(); } };
$('cmpModel').onchange=()=>{CMP.model=$('cmpModel').value; CMP.param=null; fillCmp(); updateCmp();};
$('cmpParam').onchange=()=>{CMP.param=$('cmpParam').value; updateCmp();};
{ const oc=mvLoop.onChange; mvLoop.onChange=fh=>{ oc(fh); updateCmp(); }; }

function permalink(){ const m=MODELS[MV.model], q=new URLSearchParams({m:MV.model});
  q.set('p', m.kind==='grid'?G.var : m.kind==='windy'?MV.windyLayer : MV.param); if(MV.area) q.set('a', m.kind==='grid'?G.region:MV.area);
  if(m.kind==='mag'||m.kind==='ecmwf'){ q.set('c',$('mvCycle').value); if(mvLoop.hours) q.set('h',mvLoop.hours[mvLoop.idx]); }
  return location.href.split('#')[0]+'#models?'+q.toString(); }
$('shareBtn').onclick=async()=>{ const u=permalink(); try{ await navigator.clipboard.writeText(u); toast('Link copied: opens this exact model, map and hour.'); }catch(e){ $('shareOut').style.display=''; $('shareOut').value=u; $('shareOut').select(); toast('Copy the link from the box.'); } };
$('openImgBtn').onclick=()=>{ const m=MODELS[MV.model];
  if(m.kind==='grid'){ $('gCanvas').toBlob(b=>{ if(b) window.open(URL.createObjectURL(b),'_blank'); }); return; }
  if(m.kind==='windy'){ toast('Interactive maps cannot be saved as an image.'); return; }
  const src=$('mvImg').src; if(src) window.open(src,'_blank'); };
function applyPermalink(){
  const h=location.hash.slice(1); if(!h.startsWith('models?')) return false; const q=new URLSearchParams(h.split('?')[1]), k=q.get('m'); if(!MODELS[k]) return false; const m=MODELS[k];
  if(m.kind==='grid'){ if(q.get('p')) G.var=q.get('p'); if(q.get('a')) G.region=q.get('a'); }
  else if(m.kind==='windy'){ if(q.get('p')) MV.windyLayer=q.get('p'); }
  else { if(q.get('p')) MV.paramFor[k]=q.get('p'); if(q.get('a')) MV.area=q.get('a'); }
  selectModel(k);
  if((m.kind==='mag'||m.kind==='ecmwf')&&q.get('c')!=null){ $('mvCycle').value=q.get('c'); updateModel(); const i=mvLoop.hours.indexOf(+q.get('h')); if(i>=0) mvLoop.go(i); }
  return true;
}

/* ---- polls file (when hosted) ---- */
async function loadPolls(){ if(!/^https?:/.test(location.protocol)) return; try{ const r=await fetch('data/polls.json',{cache:'no-cache'}); if(r.ok) Object.assign(POLITICS, await r.json()); }catch(e){} }

/* =========================================================
   12) BOOT + LAZY TAB INIT
   ========================================================= */
const inited={};
function lazyInit(t){
  if(inited[t]) return; inited[t]=true;
  if(t==='ensembles') initEns();
  if(t==='longrange'){ renderLrSide(); renderLr(); }
  if(t==='politics') loadPolls().then(initPolitics);
  if(t==='home') initHome();
  if(t==='winter') initWinter();
  if(t==='sounding') initSounding();
  if(t==='spaghetti') initSpag();
  if(t==='pointmodels' && getLoc()) loadDet();
  if(t==='satellite'){fillSatSectors(); loadSat();}
  if(t==='radar') loadRadar($('radSite').value||null);
  if(t==='analysis') gallery($('anaGal'),ANALYSIS);
  if(t==='tropics'){gallery($('tcGal'),TROPICS); loadActiveStorms();}
  if(t==='outlooks') gallery($('outGal'),OUTLOOKS);
  if(t==='local'){const z=store.get('wx.zip'); if(z){$('zipIn').value=z; runLocal(z);} else $('zipIn').focus();}
}
renderLocChip(); checkAlerts();
if(!applyPermalink()) selectModel(store.get('wx.model')&&MODELS[store.get('wx.model')]?store.get('wx.model'):'gfs');
const startTab=(location.hash||'#home').slice(1).split('?')[0]; showTab(document.getElementById('tab-'+startTab)?startTab:'home');
window.addEventListener('resize',()=>{clearTimeout(window._rz); window._rz=setTimeout(()=>{if(detData)drawDet();},250);});
