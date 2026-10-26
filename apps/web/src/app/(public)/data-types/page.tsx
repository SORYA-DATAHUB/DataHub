import { Database, FileText, Image as ImageIcon, PenLine, ScanLine, ScrollText, Type, FileType2, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { PageHero, Section, SectionHeading } from "@/features/marketing/sections";
import { ACCEPTED_FORMATS, CATEGORIES } from "@/mock/data";

export const metadata: Metadata = { title: "Data types" };

const meta: Array<{ icon: LucideIcon; formats: string[]; desc: string }> = [
  { icon: FileText, formats: ["PDF"], desc: "Text-based or mixed PDFs: reports, theses, laws and publications." },
  { icon: FileType2, formats: ["DOCX"], desc: "Word documents with readable structure and text." },
  { icon: ScanLine, formats: ["PDF", "TIFF", "JPG", "PNG"], desc: "Scans at 200 DPI or higher, legible and upright." },
  { icon: PenLine, formats: ["JPG", "PNG", "TIFF", "PDF"], desc: "Handwriting pages with consistent lighting and no cropping." },
  { icon: ScrollText, formats: ["PDF", "TIFF", "JPG"], desc: "Archival material you are authorized to share." },
  { icon: ImageIcon, formats: ["JPG", "PNG", "TIFF"], desc: "Photographs of documents, inscriptions and signage." },
  { icon: Type, formats: ["TXT", "ZIP"], desc: "UTF-8 plain text, including Khmer Unicode." },
  { icon: Database, formats: ["CSV", "JSON", "ZIP"], desc: "Structured tables with headers and documented columns." }
];
const limits = [["Max file size", "2 GB"], ["Max dataset size", "50 GB"], ["Max files per dataset", "10,000"], ["Encoding for text", "UTF-8"], ["Minimum scan resolution", "200 DPI"], ["Archive nesting", "1 level of ZIP"]];

export default function DataTypesPage() {
  return (
    <>
      <PageHero eyebrow="Data types" title="What you can contribute" description="Eight supported categories. Content must be authorized for contribution and unique." />
      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => { const m = meta[i]; return (
            <li key={c}><Card className="h-full p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand"><m.icon size={18} aria-hidden /></span>
              <h2 className="mt-4 font-semibold">{c}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">{m.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{m.formats.map((f) => <Badge key={f}>{f}</Badge>)}</div>
            </Card></li>
          ); })}
        </ul>
      </Section>
      <Section tinted>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading title="Accepted formats" description="Files in other formats are rejected at upload." />
            <div className="flex flex-wrap gap-2">{ACCEPTED_FORMATS.map((f) => <span key={f} className="rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-sm">.{f.toLowerCase()}</span>)}</div>
          </div>
          <div>
            <SectionHeading title="Limits" />
            <dl className="divide-y divide-line rounded-xl border border-line bg-bg">{limits.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm"><dt className="text-muted">{k}</dt><dd className="tabular font-medium">{v}</dd></div>)}</dl>
          </div>
        </div>
      </Section>
      <Section><div className="text-center"><Button href="/register" size="lg">Start contributing</Button></div></Section>
    </>
  );
}
