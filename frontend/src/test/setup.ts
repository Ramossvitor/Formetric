import '@testing-library/jest-dom/vitest'

// O jsdom não implementa rolagem e imprime "Not implemented: Window's scrollTo()" toda vez que o
// layout autenticado volta ao topo numa troca de rota. O aviso não reprova nada, mas enche a saída
// da suíte e treina quem lê a ignorar — e é assim que um aviso de verdade passa despercebido.
// A implementação vazia é fiel: numa página sem layout calculado, rolar não tem o que fazer.
window.scrollTo = () => {}
