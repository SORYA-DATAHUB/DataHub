export function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}
export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const gb = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} GB`;
export const num = (n: number) => n.toLocaleString("en-US");
export const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
