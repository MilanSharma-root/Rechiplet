import axios from 'axios'
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://127.0.0.1:8000/api',timeout:30000})
export type Chiplet={id:number;name:string;category:string;process_node_nm:number;area_mm2:number;power_w:number;unit_cost_usd:number;performance_score:number;thermal_limit_c:number;interface:string;maturity:string;notes:string}
export type Product={id:number;name:string;market_segment:string;target_performance:number;max_power_w:number;max_area_mm2:number;max_cost_usd:number;max_junction_temp_c:number;min_yield_pct:number;annual_volume:number}
export type Solution={chiplet_ids:number[];chiplet_names:string[];strategy:string;estimated_cost_usd:number;estimated_power_w:number;estimated_area_mm2:number;performance_score:number;feasible:boolean;reuse_count:number}
