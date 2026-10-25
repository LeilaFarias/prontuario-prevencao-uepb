export const TAMANHO_MAX_ORIGINAL = 10 * 1024 * 1024;
const LARGURA_MAX = 800;
const QUALIDADE = 0.8;
const ALVO_MAX_BYTES = 700 * 1024;

export class ErroImagem extends Error {}

function lerComoDataURL(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new ErroImagem("Não foi possível ler o arquivo selecionado."));
    leitor.readAsDataURL(arquivo);
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ErroImagem("Não foi possível abrir a imagem. Tente outro arquivo."));
    img.src = src;
  });
}

function bytesDaDataURL(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}


export async function comprimirImagem(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith("image/")) {
    throw new ErroImagem("O arquivo selecionado não é uma imagem.");
  }
  if (arquivo.size > TAMANHO_MAX_ORIGINAL) {
    throw new ErroImagem("A imagem é muito grande (máximo de 10 MB). Escolha outra foto.");
  }

  const original = await lerComoDataURL(arquivo);
  const img = await carregarImagem(original);

  const largura = Math.min(LARGURA_MAX, img.naturalWidth);
  const altura = Math.max(1, Math.round((img.naturalHeight * largura) / img.naturalWidth));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ErroImagem("Seu navegador não conseguiu processar a imagem.");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(img, 0, 0, largura, altura);

  let qualidade = QUALIDADE;
  let resultado = canvas.toDataURL("image/jpeg", qualidade);
  while (bytesDaDataURL(resultado) > ALVO_MAX_BYTES && qualidade > 0.4) {
    qualidade -= 0.1;
    resultado = canvas.toDataURL("image/jpeg", qualidade);
  }
  return resultado;
}
