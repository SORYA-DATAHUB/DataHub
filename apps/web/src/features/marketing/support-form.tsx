"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/ui/overlays";
import { Alert, Card, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { wait } from "@/lib/demo";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  topic: z.string().min(1, "Choose a topic."),
  datasetId: z.string().trim().regex(/^(DS-\d{4,6})?$/, "Use the format DS-10482.").optional(),
  message: z.string().trim().min(20, "Please write at least 20 characters.").max(2000, "Maximum 2,000 characters.")
});
type Values = z.infer<typeof schema>;

export function SupportForm() {
  const { toast } = useUI();
  const [ticket, setTicket] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { topic: "", datasetId: "" } });

  const onSubmit = async (v: Values) => {
    setFailed(false);
    await wait(900);
    if (/fail/i.test(v.message)) { setFailed(true); toast("Could not send your message.", "error"); return; }
    setTicket(`SUP-${Math.floor(1000 + Math.random() * 9000)}`);
    toast("Message recorded in demo mode.");
  };

  if (ticket) return (
    <Card className="p-8 text-center">
      <CheckCircle2 className="mx-auto text-success" size={36} aria-hidden />
      <h3 className="mt-4 text-lg font-semibold">Message received (demo)</h3>
      <p className="mt-1 text-sm text-muted">Reference <span className="font-mono">{ticket}</span>. In production you would get a reply by email within two business days. Nothing was actually sent.</p>
      <Button className="mt-6" variant="outline" onClick={() => { reset(); setTicket(null); }}>Send another message</Button>
    </Card>
  );

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {failed && <Alert tone="danger" title="Sending failed">This was a simulated failure. Remove the word &quot;fail&quot; from your message and try again.</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} autoComplete="name" {...register("name")} />}</Field>
          <Field label="Email" error={errors.email?.message} required>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" autoComplete="email" {...register("email")} />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Topic" error={errors.topic?.message} required>{(id, d) => (
            <Select id={id} aria-describedby={d} aria-invalid={!!errors.topic} {...register("topic")}>
              <option value="">Select a topic</option><option>Upload problem</option><option>Review decision</option><option>Earnings and payouts</option><option>Account and verification</option><option>Other</option>
            </Select>)}</Field>
          <Field label="Dataset ID (optional)" error={errors.datasetId?.message}>{(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.datasetId} placeholder="DS-10482" {...register("datasetId")} />}</Field>
        </div>
        <Field label="Message" error={errors.message?.message} required>{(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.message} rows={6} {...register("message")} />}</Field>
        <Button type="submit" loading={isSubmitting}>{isSubmitting ? "Sending…" : "Send message"}</Button>
      </form>
    </Card>
  );
}
