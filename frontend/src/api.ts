import axios from 'axios'
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://127.0.0.1:8000/api',timeout:120000})
export type Chiplet={id:number;name:string;category:string;process_node_nm:number;area_mm2:number;power_w:number;unit_cost_usd:number;performance_score:number;thermal_limit_c:number;interface:string;maturity:string;notes:string}
export type Product={id:number;name:string;market_segment:string;target_performance:number;max_power_w:number;max_area_mm2:number;max_cost_usd:number;max_junction_temp_c:number;min_yield_pct:number;annual_volume:number}
export type Solution={chiplet_ids:number[];chiplet_names:string[];strategy:string;estimated_cost_usd:number;estimated_power_w:number;estimated_area_mm2:number;performance_score:number;feasible:boolean;reuse_count:number}
export type PortfolioArchitecture={product_id:number;product_name:string;market_segment:string;feasible:boolean;message?:string;solution:Solution|null}
export type PortfolioScenario={key:'lowest_cost'|'balanced'|'highest_performance';label:string;description:string;architectures:PortfolioArchitecture[];summary:{product_count:number;feasible_product_count:number;total_estimated_cost_usd:number;total_estimated_power_w:number;total_estimated_area_mm2:number;shared_chiplet_count:number};shared_chiplets:{chiplet_id:number;chiplet_name:string;product_count:number;products:string[]}[]}
export type PortfolioResult={run_id:number;feasible:boolean;scenarios:PortfolioScenario[];message:string;model_note:string}
