export default function ChipsLeitura({ valores }: { valores: ReadonlyArray<string> }) {
  if (valores.length === 0) return <span className="text-[13.5px] text-ink-faint">—</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {valores.map((v) => (
        <li key={v} className="rounded-pill bg-prof-tint px-2.5 py-1 text-[12px] font-medium text-prof">
          {v}
        </li>
      ))}
    </ul>
  );
}
