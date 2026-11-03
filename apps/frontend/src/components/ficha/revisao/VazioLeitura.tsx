export default function VazioLeitura({ texto }: { texto: string }) {
  return (
    <p className="rounded-card border border-line-soft bg-raised px-4 py-8 text-center text-[13px] text-ink-faint">
      {texto}
    </p>
  );
}
