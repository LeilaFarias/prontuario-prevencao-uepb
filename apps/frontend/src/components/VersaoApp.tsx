export default function VersaoApp({ compacta = false }: { compacta?: boolean }) {
  return (
    <p className="text-xs text-ink-faint">
      Prontuário Digital beta v{__APP_VERSION__}
      {!compacta && ` · ${__BUILD_DATE__}`}
    </p>
  );
}