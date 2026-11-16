import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  falhou: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { falhou: false };

  static getDerivedStateFromError(): State {
    return { falhou: true };
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", erro, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.falhou) return this.props.children;
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] font-medium text-ink">Algo deu errado</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    );
  }
}
