type Confirmador = () => Promise<boolean>;

let confirmador: Confirmador | null = null;
let emCurso: Promise<boolean> | null = null;

export function registrarConfirmadorInvalidacao(fn: Confirmador): () => void {
  confirmador = fn;
  return () => {
    if (confirmador === fn) confirmador = null;
  };
}

export function confirmarInvalidacaoAssinatura(): Promise<boolean> {
  if (!confirmador) return Promise.resolve(false);
  if (!emCurso) {
    emCurso = confirmador().finally(() => {
      emCurso = null;
    });
  }
  return emCurso;
}
